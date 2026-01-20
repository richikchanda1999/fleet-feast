import asyncio

from contextlib import asynccontextmanager
from typing import Awaitable
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import config
from models import State
from redis_client import get_redis, close_redis
from simulation import game_loop, agent_decision_loop
from logger import get_logger

from dotenv import load_dotenv

load_dotenv()

logger = get_logger("main")


def handle_task_exception(task):
    if task.cancelled():
        logger.warning("Task cancelled", task_name=task.get_name())
        return
    if exc := task.exception():
        logger.error("Task failed", task_name=task.get_name(), error=str(exc))

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up")

    sim_task = asyncio.create_task(game_loop(), name="game_loop")
    sim_task.add_done_callback(handle_task_exception)
    logger.info("Game loop task started")

    agent_decision_task = asyncio.create_task(agent_decision_loop(), name="agent_decision_loop")
    agent_decision_task.add_done_callback(handle_task_exception)
    logger.info("Agent decision loop task started")

    yield

    logger.info("Application shutting down")
    sim_task.cancel()
    agent_decision_task.cancel()

    await close_redis()
    logger.info("Application shutdown complete")


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


@app.get("/get_state", response_model=State)
async def get_state():
    """Initialize the game by returning current state."""
    try:
        client = await get_redis()
        state = State.model_validate_json(await client.get(config.game_state_key))
        logger.debug("State retrieved", current_time=state.current_time)
        return state
    except Exception as e:
        logger.error("Failed to get state", exc_info=True, error=str(e))
        raise HTTPException(
            status_code=503, detail=f"Unable to get state: {str(e)}"
        )


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        client = await get_redis()
        ping_response = client.ping()
        if isinstance(ping_response, Awaitable):
            ping_response = await ping_response

        status = "healthy" if ping_response else "unhealthy"
        logger.debug("Health check", status=status)
        return {
            "status": status,
            "redis": "connected" if ping_response else "not_connected",
        }
    except Exception as e:
        logger.error("Health check failed", exc_info=True, error=str(e))
        raise HTTPException(
            status_code=503, detail=f"Redis connection failed: {str(e)}"
        )
