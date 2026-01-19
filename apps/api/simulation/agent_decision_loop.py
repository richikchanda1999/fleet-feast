import asyncio
from redis_client import get_redis
from config import config
from utils import from_seconds
from models.state import State


async def agent_decision_loop():
    client = await get_redis()
    while True:
        # 1. Snapshot the current GAME_STATE
        # 2. Send to LLM: "Here is the state, what should we do?"
        # 3. Parse Tool Call (e.g., "move_truck(t1, 'stadium')")
        # 4. Update GAME_STATE based on decision

        try:
            state = await client.get(config.game_state_key)
            print(f"In agent decision loop. State from Redis: {state}")
            if not state:
                continue
            state = State.model_validate_json(state)
            print(
                "In agent decision loop! Current time - ",
                from_seconds(state.current_time * 60),
            )

            await asyncio.sleep(10)  # Agent thinks every 30 seconds
        except Exception as e:
            print(f"Error in agent_decision_loop: {e}")
