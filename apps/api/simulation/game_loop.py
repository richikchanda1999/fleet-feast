import asyncio

from utils import from_seconds, get_demand
from redis_client import get_redis, queue_length, dequeue
from config import config
from models import State, TruckStatus


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

            # TODO: Update game state with pending decisions from LLM
            pending_actions_length = await queue_length(config.pending_actions_queue)
            for i in range(0, pending_actions_length):
                pending_action = await dequeue(config.pending_actions_queue)
                if not pending_action:
                    continue
                
                action = pending_action['action']
                current_time = pending_action['current_time']

                if not current_time:
                    continue
                
                if action == "dispatch_truck":
                    pass
                elif action == "get_zone_forecast":
                    pass
                elif action == "restock_inventory":
                    pass
                elif action == "hold_position":
                    pass

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
                # Deplete Inventory (if status == 'serving')
                if truck.status == TruckStatus.SERVING:
                    if truck.inventory > 0:
                        truck.inventory -= 1  # TODO: Make this variable
                        truck.total_revenue += 100  # TODO: Make this variable

                # Check for 'Arrivals'
                if (
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
