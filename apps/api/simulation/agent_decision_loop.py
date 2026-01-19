import asyncio
from redis_client import get_redis, queue_length
from config import config
from utils import from_seconds
from models import State, Zone
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


def format_time(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02}:{m:02}"


def get_current_demand(zone: Zone, current_time: int) -> str:
    # Simple logic to tell LLM if it's currently hot
    for start, end in zone.peak_hours:
        if start <= current_time <= end:
            return "HIGH (Peak Hour)"
    return "LOW (Off-peak)"


def generate_user_prompt(state: State) -> Message:
    report = [f"--- CURRENT TIME: {format_time(state.current_time)} ---", ""]

    report.append("FLEET STATUS:")
    for t in state.trucks:
        # Determine status based on arrival time
        status = "MOVING" if t.arrival_time > state.current_time else "IDLE/SERVING"
        eta = f"(ETA: {format_time(t.arrival_time)})" if status == "MOVING" else ""

        report.append(
            f"- {t.id} ({t.speed_multiplier}x speed): "
            f"Loc: {t.current_zone} | "
            f"Inv: {t.inventory}/{t.max_inventory} | "
            f"Status: {status} {eta}"
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

    while True:
        # 1. Snapshot the current GAME_STATE
        # 2. Send to LLM: "Here is the state, what should we do?"
        # 3. Parse Tool Call (e.g., "move_truck(t1, 'stadium')")

        try:
            pending_actions_length = await queue_length(config.pending_actions_queue)
            if pending_actions_length > 0:
                continue
            
            state = await client.get(config.game_state_key)
            if not state:
                continue

            state = State.model_validate_json(state)
            print(
                "In agent decision loop! Current time - ",
                from_seconds(state.current_time * 60),
            )

            messages: list[Message] = [get_system_prompt(), generate_user_prompt(state)]

            available_functions = {
                "dispatch_truck": dispatch_truck,
                "get_zone_forecast": get_zone_forecast,
                "hold_position": hold_position,
                "restock_inventory": restock_inventory,
            }

            while True:
                response: ChatResponse = chat(
                    model="qwen3-coder:30b",
                    messages=messages,
                    tools=get_tool_definitions(),
                )

                messages.append(response.message)

                if response.message.tool_calls:
                    for tc in response.message.tool_calls:
                        if tc.function.name in available_functions:
                            print(
                                f"Calling {tc.function.name} with arguments {tc.function.arguments}"
                            )
                            result = await available_functions[tc.function.name](
                                state=state, **tc.function.arguments
                            )

                            print(f"Result: {result}")
                            # add the tool result to the messages
                            messages.append(
                                Message(
                                    role="tool",
                                    tool_name=tc.function.name,
                                    content=str(result),
                                )
                            )
                else:
                    break

        except Exception as e:
            print(f"Error in agent_decision_loop: {e}")

        finally:
            await asyncio.sleep(30)  # Agent thinks every 30 seconds
