import asyncio
from utils import from_seconds
from redis_client import get_redis
from config import config
from models.state import State


async def game_loop():
    try:
        client = await get_redis()
        if not await client.exists(config.game_state_key):
            await client.set(config.game_state_key, State().model_dump_json())

        state = State.model_validate_json(await client.get(config.game_state_key))

        while True:
            # 1. Update Game Time
            # 2. Update Demand Curves (based on new time)
            # 3. Deplete Inventory (if status == 'serving')

            # 4. Check for 'Arrivals'
            # for truck in GAME_STATE['trucks'].values():
            #     if truck['status'] == 'moving' and current_time >= truck['arrival_time']:
            #          truck['status'] = 'serving'
            #          truck['zone'] = truck['target']

            print("In game loop!", from_seconds(state.current_time * 60))

            state.current_time = (state.current_time + 1) % (
                24 * 60
            )  # 1 second in real world is 1 minute in the simulation
            await client.set(config.game_state_key, state.model_dump_json())

            # Run 1 tick per second
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Error in game_loop: {e}")
