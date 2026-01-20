import asyncio
from typing import Any
from utils import from_seconds, get_demand
from redis_client import get_redis, queue_length, dequeue
from config import config
from models import State, TruckStatus
from tools import DispatchTruckSchema, RestockInventorySchema, HoldPositionSchema


def process_action(state: State, action: str, action_time: int, payload: dict):
    print(f"Processing action: {action} (Action time: {action_time}). Payload: {payload}")
    if abs(state.current_time - action_time) > 5:
        # The action is stale, no need to process it
        return

    if action == "dispatch_truck":
        args = DispatchTruckSchema.model_validate(payload)
        truck = next((t for t in state.trucks if t.id == args.truck_id), None)
        if not truck:
            return

        truck.destination_zone = args.destination_zone
        truck.arrival_time = state.current_time + state.get_travel_time(
            truck.current_zone, truck.destination_zone
        )
        truck.status = TruckStatus.MOVING

    elif action == "restock_inventory":
        args = RestockInventorySchema.model_validate(payload)
        truck = next((t for t in state.trucks if t.id == args.truck_id), None)
        if not truck:
            return

        truck.status = TruckStatus.RESTOCKING
        truck.restocking_finish_time = state.current_time + 10
    elif action == "hold_position":
        args = HoldPositionSchema.model_validate(payload)
        # Do nothing


async def game_loop():
    client = await get_redis()
    if not await client.exists(config.game_state_key):
        await client.set(config.game_state_key, State().model_dump_json())

    while True:
        try:
            state = State.model_validate_json(await client.get(config.game_state_key))

            if state.current_time % 10 == 0:
                print("In game loop!", from_seconds(state.current_time * 60))

            # Update Game Time
            state.current_time = state.current_time + 1
            if (
                state.current_time == 24 * 60
            ):  # 1 second in real world is 1 minute in the simulation
                state = State()

            # Update game state with pending decisions from LLM
            pending_actions_length = await queue_length(config.pending_actions_queue)
            for i in range(0, pending_actions_length):
                payload = await dequeue(config.pending_actions_queue)
                if not payload:
                    continue

                action = payload["action"]
                action_time = payload["current_time"]

                if not action_time:
                    continue

                process_action(state, action, action_time, payload)

            # Update Demand Curves (based on new time)
            for zone in state.zones:
                demands = [
                    get_demand(
                        minute_of_the_day=state.current_time,
                        peak_time=int((start + end) / 2),
                        max_orders=zone.max_orders,
                        base_demand=zone.base_demand,
                    )
                    for (start, end) in zone.peak_hours
                ]
                net_demand = sum(demands)
                zone.demand[state.current_time] = net_demand

            for truck in state.trucks:
                if (
                    truck.status == TruckStatus.RESTOCKING
                    and truck.restocking_finish_time
                    and state.current_time >= truck.restocking_finish_time
                ):
                    truck.status = TruckStatus.SERVING
                    truck.restocking_finish_time = None
                    truck.inventory = truck.max_inventory

                # Deplete Inventory (if status == 'serving')
                elif truck.status == TruckStatus.SERVING:
                    if truck.inventory > 0:
                        truck.inventory -= 1  # TODO: Make this variable
                        truck.total_revenue += 100  # TODO: Make this variable

                # Check for 'Arrivals'
                elif (
                    truck.status == TruckStatus.MOVING
                    and state.current_time >= truck.arrival_time
                ):
                    truck.status = TruckStatus.SERVING
                    if truck.destination_zone is not None:
                        truck.current_zone = truck.destination_zone
                    truck.destination_zone = None

            await client.set(config.game_state_key, state.model_dump_json())
        except Exception as e:
            print(f"Error in game_loop: {e}")
        finally:
            # Run 1 tick per second
            await asyncio.sleep(1)
