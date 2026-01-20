import asyncio
from utils import from_seconds
from redis_client import get_redis, queue_length, dequeue
from config import config
from models import State, TruckStatus
from tools import DispatchTruckSchema, RestockInventorySchema, HoldPositionSchema
from logger import get_logger

logger = get_logger("game_loop")


def process_action(state: State, action: str, action_time: int, payload: dict):
    logger.info(
        "Processing action",
        action=action,
        action_time=action_time,
        current_time=state.current_time,
        payload=payload,
    )
    if abs(state.current_time - action_time) > 5:
        logger.warning(
            "Skipping stale action",
            action=action,
            action_time=action_time,
            current_time=state.current_time,
            staleness=abs(state.current_time - action_time),
        )
        return

    if action == "dispatch_truck":
        args = DispatchTruckSchema.model_validate(payload)
        truck = next((t for t in state.trucks if t.id == args.truck_id), None)
        if not truck:
            logger.warning("Truck not found for dispatch", truck_id=args.truck_id)
            return

        travel_time = state.get_travel_time(truck.current_zone, args.destination_zone)
        truck.dispatch(args.destination_zone, state.current_time + travel_time)

        logger.info(
            "Truck dispatched",
            truck_id=truck.id,
            from_zone=truck.current_zone,
            to_zone=args.destination_zone,
            travel_time=travel_time,
            arrival_time=truck.arrival_time,
        )

    elif action == "restock_inventory":
        args = RestockInventorySchema.model_validate(payload)
        truck = next((t for t in state.trucks if t.id == args.truck_id), None)
        if not truck:
            logger.warning("Truck not found for restock", truck_id=args.truck_id)
            return

        truck.start_restocking(state.current_time)
        logger.info(
            "Truck restocking started",
            truck_id=truck.id,
            current_inventory=truck.inventory,
            finish_time=truck.restocking_finish_time,
        )
    elif action == "hold_position":
        args = HoldPositionSchema.model_validate(payload)
        logger.debug(
            "Truck holding position",
            truck_id=args.truck_id,
        )


async def game_loop():
    client = await get_redis()
    if not await client.exists(config.game_state_key):
        await client.set(config.game_state_key, State().model_dump_json())
        logger.info("Initialized new game state")

    logger.info("Game loop started")

    while True:
        try:
            state = State.model_validate_json(await client.get(config.game_state_key))

            logger.info(
                "Game tick",
                game_time=from_seconds(state.current_time * 60),
                current_time=state.current_time,
            )

            # Update Game Time
            state.current_time = state.current_time + 1
            if (
                state.current_time == 24 * 60
            ):  # 1 second in real world is 1 minute in the simulation
                total_revenue = sum(t.total_revenue for t in state.trucks)
                logger.info(
                    "Day ended - resetting game state",
                    total_revenue=round(total_revenue, 2),
                    trucks_summary=[
                        {
                            "id": t.id,
                            "revenue": round(t.total_revenue, 2),
                            "inventory": t.inventory,
                        }
                        for t in state.trucks
                    ],
                )
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
                zone.update_demand(state.current_time)

            for truck in state.trucks:
                if (
                    truck.status == TruckStatus.RESTOCKING
                    and truck.restocking_finish_time
                    and state.current_time >= truck.restocking_finish_time
                ):
                    units_restocked, cost = truck.restock()
                    if units_restocked > 0:
                        logger.info(
                            "Truck restocking completed",
                            truck_id=truck.id,
                            units_restocked=units_restocked,
                            cost=round(cost, 2),
                            new_inventory=truck.inventory,
                        )
                    else:
                        logger.warning(
                            "Truck restocking failed - insufficient funds",
                            truck_id=truck.id,
                            current_revenue=truck.total_revenue,
                        )

                    truck.complete_restocking()

                # Deplete Inventory (if status == 'serving')
                elif truck.status == TruckStatus.SERVING:
                    zone = next(
                        (z for z in state.zones if z.id == truck.current_zone), None
                    )
                    if zone:
                        truck.process_sales(
                            zone.demand[state.current_time], zone.base_demand
                        )

                # Check for 'Arrivals'
                elif (
                    truck.status == TruckStatus.MOVING
                    and state.current_time >= truck.arrival_time
                ):
                    previous_zone = truck.current_zone
                    truck.status = TruckStatus.SERVING
                    if truck.destination_zone is not None:
                        truck.current_zone = truck.destination_zone
                    truck.destination_zone = None
                    logger.info(
                        "Truck arrived at destination",
                        truck_id=truck.id,
                        from_zone=previous_zone,
                        arrived_zone=truck.current_zone,
                    )

            await client.set(config.game_state_key, state.model_dump_json())
            await client.publish("game:tick", str(state.current_time))
        except Exception as e:
            logger.error("Error in game loop", exc_info=True, error=str(e))
        finally:
            # Run 1 tick per second
            await asyncio.sleep(1)
