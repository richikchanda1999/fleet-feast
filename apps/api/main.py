from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import InitResponse, GameState
from redis_client import get_redis, close_redis
from services import seed_city_data, get_city_data, get_game_state, save_game_state
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_city_data()
    yield
    await close_redis()


app = FastAPI(
    title="Fleet Feast API",
    description="Backend API for Fleet Feast food truck coordination game",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/init", response_model=InitResponse)
async def init():
    """Initialize the game by returning city structure and saved game state."""
    city = await get_city_data()
    game_state = await get_game_state()
    return InitResponse(city=city, gameState=game_state)


@app.get("/game-state", response_model=GameState)
async def game_state(state: GameState):
    """Save the current game state to Redis."""
    game_state = await get_game_state()
    return game_state


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        client = await get_redis()
        await client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Redis connection failed: {str(e)}")
