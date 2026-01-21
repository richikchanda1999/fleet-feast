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
    start_serving,
    DispatchTruckSchema,
    GetZoneForecastSchema,
    HoldPositionSchema,
    RestockInventorySchema,
    StartServingSchema,
)
from ollama import AsyncClient, Message, ChatResponse
from logger import get_logger

logger = get_logger("agent_decision_loop")
MODEL = "qwen3-coder:30b"


def format_time(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02}:{m:02}"


def get_zone_demand_value(zone: Zone, current_time: int) -> float:
    """Get actual demand value for the zone at current time."""
    if current_time < len(zone.demand):
        return zone.demand[current_time]
    return 0.0


def generate_user_prompt(state: State) -> Message:
    """Generate compact, token-optimized status report."""
    lines = [f"T={format_time(state.current_time)}"]

    # Zone status: compact format
    # Format: zone_id:demand_value(PEAK/off)
    zone_info = {}
    zone_line = "ZONES:"
    for z in state.zones:
        demand_val = get_zone_demand_value(z, state.current_time)
        is_peak = z.is_peak_hour(state.current_time)
        peak_marker = "PEAK" if is_peak else "off"
        zone_info[z.id] = {"demand": demand_val, "is_peak": is_peak}
        zone_line += f" {z.id}={demand_val:.1f}({peak_marker})"
    lines.append(zone_line)

    # Truck status: compact table format
    # Only show trucks that need decisions (IDLE or SERVING)
    lines.append("TRUCKS:")
    for t in state.trucks:
        inv_pct = int((t.inventory / t.max_inventory) * 100)
        z_info = zone_info.get(t.current_zone, {"demand": 0, "is_peak": False})

        # Compact format: id|status|zone|inv%|demand_at_zone
        if t.status == TruckStatus.IDLE:
            # IDLE trucks need action!
            lines.append(f"  {t.id}|IDLE|{t.current_zone}|inv={inv_pct}%|zone_demand={z_info['demand']:.1f} ← NEEDS ACTION")
        elif t.status == TruckStatus.SERVING:
            lines.append(f"  {t.id}|SERVING|{t.current_zone}|inv={inv_pct}%|zone_demand={z_info['demand']:.1f}")
        elif t.status == TruckStatus.MOVING:
            lines.append(f"  {t.id}|MOVING→{t.destination_zone}|ETA={format_time(t.arrival_time)}|inv={inv_pct}%")
        elif t.status == TruckStatus.RESTOCKING:
            lines.append(f"  {t.id}|RESTOCKING|done={format_time(t.restocking_finish_time or 0)}|inv={inv_pct}%")

    # Travel times only for available trucks (compact)
    available = [t for t in state.trucks if t.status in [TruckStatus.IDLE, TruckStatus.SERVING]]
    if available:
        lines.append("TRAVEL:")
        for t in available:
            z = next((z for z in state.zones if z.id == t.current_zone), None)
            if z:
                costs = ",".join([f"{k}:{v}m" for k, v in z.costs.items()])
                lines.append(f"  from {t.current_zone}: {costs}")

    return Message(role="user", content="\n".join(lines))


def get_system_prompt() -> Message:
    return Message(
        role="system",
        content="""You are the Fleet Manager AI. Goal: maximize revenue.

STATE MACHINE (critical to understand):
- IDLE: Truck exists but NOT earning. Must call start_serving to begin earning!
- SERVING: Truck is selling food and earning revenue (if demand > 0)
- MOVING: Truck traveling, earns $0
- RESTOCKING: Truck resupplying, earns $0

DECISION RULES (in priority order):

1. IDLE truck + demand > 0 at current zone → start_serving (ALWAYS do this first!)
   An IDLE truck earns NOTHING. If there's any demand, start serving immediately.

2. IDLE truck + demand = 0 at current zone + demand > 0 elsewhere → dispatch_truck
   Move to where there IS demand. Don't sit idle in an empty zone.

3. SERVING truck + low inventory (<30%) + low demand at zone → restock_inventory
   Restock when you can afford the downtime.

4. SERVING truck + demand = 0 at zone + demand > 0 elsewhere → dispatch_truck
   If your zone dried up, move to where demand exists.

5. SERVING truck in high demand zone + another truck's inventory critically low (<15%)
   → Consider dispatching to that zone as backup before stockout occurs.

6. SERVING truck + good inventory + demand > 0 → hold_position
   Keep earning. Don't move unnecessarily.

NEVER DO:
- restock_inventory on full inventory (100%)
- dispatch_truck when current zone has higher demand than destination
- leave a truck IDLE when it could be SERVING

Output ONE tool call per truck that needs action. Trucks that are MOVING or RESTOCKING need no action.""",
    )


def get_tool_definitions():
    return [
        {
            "type": "function",
            "function": {
                "name": "start_serving",
                "description": "Transition IDLE truck to SERVING. Use when truck is IDLE and zone has demand > 0. IDLE trucks earn nothing!",
                "parameters": StartServingSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "dispatch_truck",
                "description": "Move truck to another zone. Use when current zone demand is 0 but destination has demand > 0.",
                "parameters": DispatchTruckSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "restock_inventory",
                "description": "Restock truck supplies. Use when inventory < 30% AND zone demand is low. NEVER use on full inventory.",
                "parameters": RestockInventorySchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "hold_position",
                "description": "Keep SERVING truck at current position. Use when already serving in a zone with demand.",
                "parameters": HoldPositionSchema.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_zone_forecast",
                "description": "Check future demand for planning. Returns forecasted demand for 'n' number of hours in the future",
                "parameters": GetZoneForecastSchema.model_json_schema(),
            },
        },
    ]


async def agent_decision_loop():
    redis_client = await get_redis()
    ollama_client = AsyncClient()  # Use async client to avoid blocking event loop
    logger.info("Agent decision loop started")

    MAX_TOOL_ITERATIONS = 10  # Prevent infinite loops

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
                await asyncio.sleep(5)  # Short sleep before checking again
                continue

            state = await redis_client.get(config.game_state_key)
            if not state:
                logger.debug("No game state found, skipping decision cycle")
                await asyncio.sleep(5)
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
                "start_serving": start_serving,
            }

            tool_call_count = 0
            iteration_count = 0

            while iteration_count < MAX_TOOL_ITERATIONS:
                iteration_count += 1
                logger.debug("Sending request to LLM", model=MODEL, iteration=iteration_count)

                # Use async chat to avoid blocking the event loop
                response: ChatResponse = await ollama_client.chat(
                    model=MODEL,
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
                        iterations=iteration_count,
                        final_response=(response.message.content[:200] if response.message.content else None),
                    )
                    break

            if iteration_count >= MAX_TOOL_ITERATIONS:
                logger.warning(
                    "Agent decision cycle hit max iterations",
                    tool_calls_made=tool_call_count,
                    max_iterations=MAX_TOOL_ITERATIONS,
                )

        except Exception as e:
            logger.error("Error in agent decision loop", exc_info=True, error=str(e))

        finally:
            await asyncio.sleep(30)  # Agent thinks every 30 seconds
