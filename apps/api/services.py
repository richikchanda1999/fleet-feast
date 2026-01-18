import json

from fastapi import HTTPException

from config import config
from data import DEFAULT_ZONES, DEFAULT_ROAD_SEGMENTS, DEFAULT_BUILDING_PLACEMENTS
from models import CityStructure, GameState
from redis_client import get_redis


async def seed_city_data():
    """Seed Redis with default city data if not already present."""
    client = await get_redis()

    exists = await client.exists(config.city_key)
    if not exists:
        city_data = {
            "zones": DEFAULT_ZONES,
            "roadSegments": DEFAULT_ROAD_SEGMENTS,
            "buildingPlacements": DEFAULT_BUILDING_PLACEMENTS,
        }
        await client.set(config.city_key, json.dumps(city_data))
        print("City data seeded to Redis")

    game_state_exists = await client.exists(config.game_state_key)
    if not game_state_exists:
        default_game_state = {
            "trucks": [],
            "orders": [],
            "decisions": [],
            "zoneDemands": [],
            "simulationTime": 0,
            "score": 0,
        }
        await client.set(config.game_state_key, json.dumps(default_game_state))
        print("Game state initialized in Redis")


async def get_city_data() -> CityStructure:
    """Retrieve city data from Redis."""
    client = await get_redis()
    data = await client.get(config.city_key)
    if not data:
        raise HTTPException(status_code=500, detail="City data not found in Redis")
    return CityStructure.model_validate(json.loads(data))


async def get_game_state() -> GameState:
    """Retrieve game state from Redis."""
    client = await get_redis()
    data = await client.get(config.game_state_key)
    if not data:
        return GameState()
    return GameState.model_validate(json.loads(data))


async def save_game_state(state: GameState):
    """Save game state to Redis."""
    client = await get_redis()
    await client.set(config.game_state_key, state.model_dump_json())
