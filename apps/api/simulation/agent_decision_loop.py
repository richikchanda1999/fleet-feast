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


def generate_user_prompt(state: State) -> Message:
    report = [f"--- CURRENT TIME: {format_time(state.current_time)} ---", ""]

    report.append("FLEET STATUS:")
    for t in state.trucks:
        # Determine status based on arrival time
        eta = f"(ETA: {format_time(t.arrival_time)})" if t.status == TruckStatus.MOVING else ""
        restocking_eta = f"(ETA: {format_time(t.restocking_finish_time)})" if TruckStatus.RESTOCKING and t.restocking_finish_time else ""

        report.append(
            f"- {t.id} ({t.speed_multiplier}x speed): "
            f"Loc: {t.current_zone} | "
            f"Inv: {t.inventory}/{t.max_inventory} | "
            f"Status: {t.status} {eta}"
            f"Current revenue: {t.total_revenue}"
            f"Restocking cost: {t.get_restocking_cost()} {restocking_eta}"
        )

    report.append("\nZONE CONDITIONS:")
    for z in state.zones:
        demand = get_current_demand(z, state.current_time)
        report.append(f"- {z.id}: Demand is {demand}. Base: {z.base_demand}")

    report.append("\nTRAVEL TIMES (Base Minutes from current positions):")
    # Only show relevant connections to save tokens
    for t in state.trucks:
        current_z = next(z for z in state.zones if z.id == t.current_zone)
        connections = ", ".join([f"{k}={v}m" for k, v in current_z.costs.items()])
        report.append(f"From {t.current_zone} ({t.id}): [{connections}]")

    report.append("\nFor each truck, what tools should be called? Return JSON only.")
    return Message(role="user", content="\n".join(report))


def get_system_prompt() -> Message:
    return Message(
        role="system",
        content="""
You are the AI Fleet Manager for "Fleet Feast," a food truck logistics simulation.
Your Goal: Maximize revenue by positioning trucks in high-demand zones and preventing inventory stockouts.

RULES:
1. Truck Speed: "Heavy" trucks (speed 0.5) take 2x longer to travel. "Fast" trucks (speed 1.5) take 0.6x time.
2. Inventory: If inventory is < 30%, you MUST consider restocking or holding position to conserve.
3. Travel Cost: Moving costs time (opportunity cost). Only move if the destination demand outweighs the travel downtime.
4. Output Format: You must strictly output valid JSON. No markdown, no conversational filler.

AVAILABLE ZONES:
- Downtown (Lunch peak)
- University (Late night/Afternoon peak)
- Park (Afternoon peak)
- Residential (Dinner peak)
- Stadium (Event only)

Analyze the Current State provided by the user, use tools and output ONE decision in JSON format. If using multiple tools, do them sequentially.
""",
    )


def get_tool_definitions():
    return [
        {
            "type": "function",
            "function": {
                "name": "dispatch_truck",
                "description": "Move a truck to a new zone. Costs time and fuel.",
                "parameters": DispatchTruckSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "restock_inventory",
                "description": "Send a truck to restock supplies. Truck becomes unavailable for a duration.",
                "parameters": RestockInventorySchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_zone_forecast",
                "description": "Check future demand multipliers for a specific zone.",
                "parameters": GetZoneForecastSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "hold_position",
                "description": "Do nothing this turn. Use this when the fleet is already optimized.",
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
                            result = await available_functions[tc.function.name](state=state, **tc.function.arguments)

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
                        final_response=response.message.content[:200] if response.message.content else None,
                    )
                    break

        except Exception as e:
            logger.error("Error in agent decision loop", exc_info=True, error=str(e))

        finally:
            await asyncio.sleep(30)  # Agent thinks every 30 seconds
