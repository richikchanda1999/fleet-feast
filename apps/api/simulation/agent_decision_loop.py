import asyncio
from redis_client import get_redis, queue_length
from config import config
from utils import from_seconds
from models import State, Zone, TruckStatus
from tools import (
    dispatch_truck,
    get_zone_forecast,
    hold_position,
    restock_inventory,
    DispatchTruckSchema,
    GetZoneForecastSchema,
    HoldPositionSchema,
    RestockInventorySchema,
)
from ollama import chat, Message, ChatResponse
from logger import get_logger

logger = get_logger("agent_decision_loop")


def format_time(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02}:{m:02}"


def get_current_demand(zone: Zone, current_time: int) -> str:
    # Simple logic to tell LLM if it's currently hot
    return "HIGH (Peak Hour)" if zone.is_peak_hour(current_time) else "LOW (Off-peak)"


def get_inventory_status(truck) -> str:
    """Return inventory status with clear warning labels."""
    percentage = (truck.inventory / truck.max_inventory) * 100
    if percentage >= 100:
        return "FULL (DO NOT RESTOCK)"
    elif percentage >= 70:
        return "Good"
    elif percentage >= 30:
        return "Moderate"
    else:
        return "LOW (Consider restocking)"


def generate_user_prompt(state: State) -> Message:
    report = [f"CURRENT TIME: {format_time(state.current_time)}", ""]

    # Zone conditions first - so LLM sees demand before making decisions
    report.append("ZONE CONDITIONS (Check demand before moving trucks!):")
    zone_demands = {}
    for z in state.zones:
        demand = get_current_demand(z, state.current_time)
        zone_demands[z.id] = demand
        report.append(f"  - {z.id}: {demand}")

    report.append("")
    report.append("FLEET STATUS:")
    for t in state.trucks:
        inv_status = get_inventory_status(t)
        inv_pct = int((t.inventory / t.max_inventory) * 100)
        current_zone_demand = zone_demands.get(t.current_zone, "Unknown")

        # Build status line
        status_parts = [f"  - {t.id}:"]
        status_parts.append(f"Zone={t.current_zone} ({current_zone_demand})")
        status_parts.append(f"Inventory={t.inventory}/{t.max_inventory} ({inv_pct}%) [{inv_status}]")
        status_parts.append(f"Status={t.status}")

        if t.status == TruckStatus.MOVING:
            status_parts.append(f"ETA={format_time(t.arrival_time)}")
        elif t.status == TruckStatus.RESTOCKING and t.restocking_finish_time:
            status_parts.append(f"Restock ETA={format_time(t.restocking_finish_time)}")

        status_parts.append(f"Revenue=${t.total_revenue:.2f}")

        # Only show restocking cost if inventory is not full
        if t.inventory < t.max_inventory:
            status_parts.append(f"Restock cost=${t.get_restocking_cost():.2f}")

        report.append(" | ".join(status_parts))

    report.append("")
    report.append("TRAVEL TIMES (minutes) - Remember: travel time = lost serving time:")
    for t in state.trucks:
        if t.status in [TruckStatus.IDLE, TruckStatus.SERVING]:
            current_z = next(z for z in state.zones if z.id == t.current_zone)
            connections = ", ".join([f"{k}={v}m" for k, v in current_z.costs.items()])
            report.append(f"  From {t.current_zone}: [{connections}]")

    report.append("")
    report.append("DECISION REQUIRED: For each IDLE or SERVING truck, decide: hold_position, dispatch_truck, or restock_inventory.")
    report.append("Remember: Do NOT restock full inventory trucks. Do NOT move unless destination has higher demand.")
    return Message(role="user", content="\n".join(report))


def get_system_prompt() -> Message:
    return Message(
        role="system",
        content="""
You are the AI Fleet Manager for "Fleet Feast," a food truck logistics simulation.
Your Goal: Maximize revenue by positioning trucks in high-demand zones and preventing inventory stockouts.

CRITICAL RULES:
1. NEVER restock a truck that has full inventory (100%). Restocking a full truck wastes time and provides zero benefit.
2. NEVER move a truck unless the destination zone has HIGHER demand than the current zone. Moving wastes time when the truck could be serving customers.
3. If a truck is in a HIGH demand zone with sufficient inventory, use hold_position. Staying put and serving is better than moving.
4. Only dispatch a truck to a new zone if:
   - The destination is currently in HIGH demand (Peak Hour), AND
   - The current zone is in LOW demand (Off-peak)
5. If inventory is < 30%, consider restocking ONLY if current zone demand is LOW.

TRUCK MECHANICS:
- Speed multiplier affects travel time: 0.5x = 2x slower, 1.5x = 1.5x faster
- Trucks cannot serve while moving or restocking
- Every minute spent traveling is lost revenue opportunity

ZONE PEAK HOURS:
- Downtown (Lunch peak)
- University (Late night/Afternoon peak)
- Park (Afternoon peak)
- Residential (Dinner peak)
- Stadium (Event only)

DECISION PRIORITY:
1. If inventory is full AND current zone is HIGH demand → hold_position
2. If inventory is low AND current zone is LOW demand → restock_inventory
3. If current zone is LOW demand AND another zone is HIGH demand → dispatch_truck
4. Otherwise → hold_position (do not make unnecessary moves)

Output ONE decision using the available tools. Prefer hold_position when uncertain.
""",
    )


def get_tool_definitions():
    return [
        {
            "type": "function",
            "function": {
                "name": "dispatch_truck",
                "description": "Move a truck to a new zone. ONLY use when destination zone has HIGH demand and current zone has LOW demand. Moving wastes time that could be spent serving.",
                "parameters": DispatchTruckSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "restock_inventory",
                "description": "Send a truck to restock supplies. NEVER use on trucks with full inventory. Only use when inventory is low AND current zone demand is low.",
                "parameters": RestockInventorySchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_zone_forecast",
                "description": "Check future demand multipliers for a specific zone. Use to plan ahead.",
                "parameters": GetZoneForecastSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "hold_position",
                "description": "Keep truck at current position. Use this when: (1) truck is in HIGH demand zone, (2) truck has full inventory, or (3) no better option exists. This is the safest default action.",
                "parameters": HoldPositionSchema.model_json_schema(),
            },
        },
    ]


async def agent_decision_loop():
    client = await get_redis()
    logger.info("Agent decision loop started")

    while True:
        # 1. Snapshot the current GAME_STATE
        # 2. Send to LLM: "Here is the state, what should we do?"
        # 3. Parse Tool Call (e.g., "move_truck(t1, 'stadium')")

        try:
            pending_actions_length = await queue_length(config.pending_actions_queue)
            if pending_actions_length > 0:
                logger.debug(
                    "Skipping decision cycle - pending actions in queue",
                    pending_actions_count=pending_actions_length,
                )
                continue

            state = await client.get(config.game_state_key)
            if not state:
                logger.debug("No game state found, skipping decision cycle")
                continue

            state = State.model_validate_json(state)
            logger.info(
                "Starting agent decision cycle",
                game_time=from_seconds(state.current_time * 60),
                current_time=state.current_time,
                fleet_status=[
                    {
                        "id": t.id,
                        "zone": t.current_zone,
                        "status": t.status.value,
                        "inventory": t.inventory,
                        "revenue": round(t.total_revenue, 2),
                    }
                    for t in state.trucks
                ],
            )

            messages: list[Message] = [get_system_prompt(), generate_user_prompt(state)]

            available_functions = {
                "dispatch_truck": dispatch_truck,
                "get_zone_forecast": get_zone_forecast,
                "hold_position": hold_position,
                "restock_inventory": restock_inventory,
            }

            tool_call_count = 0
            while True:
                logger.debug("Sending request to LLM", model="qwen3-coder:30b")
                response: ChatResponse = chat(
                    model="qwen3-coder:30b",
                    messages=messages,
                    tools=get_tool_definitions(),
                    stream=False
                )

                messages.append(response.message)

                if response.message.tool_calls:
                    for tc in response.message.tool_calls:
                        if tc.function.name in available_functions:
                            tool_call_count += 1
                            logger.info(
                                "LLM tool call",
                                function=tc.function.name,
                                arguments=tc.function.arguments,
                            )
                            result = await available_functions[tc.function.name](
                                state=state, **tc.function.arguments
                            )

                            logger.info(
                                "Tool call result",
                                function=tc.function.name,
                                result=str(result),
                            )
                            # add the tool result to the messages
                            messages.append(
                                Message(
                                    role="tool",
                                    tool_name=tc.function.name,
                                    content=str(result),
                                )
                            )
                        else:
                            logger.warning(
                                "Unknown function called by LLM",
                                function=tc.function.name,
                            )
                else:
                    logger.info(
                        "Agent decision cycle completed",
                        tool_calls_made=tool_call_count,
                        final_response=(
                            response.message.content[:200]
                            if response.message.content
                            else None
                        ),
                    )
                    break

        except Exception as e:
            logger.error("Error in agent decision loop", exc_info=True, error=str(e))

        finally:
            await asyncio.sleep(30)  # Agent thinks every 30 seconds
