import asyncio

from contextlib import asynccontextmanager
from typing import Awaitable
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import config
from models.state import State
from redis_client import get_redis, close_redis
from simulation import game_loop, agent_decision_loop

from dotenv import load_dotenv

load_dotenv()

def handle_task_exception(task):                                                                                                                                   
      if task.cancelled():                                                                                                                                           
          return                                                                                                                                                     
      if exc := task.exception():                                                                                                                                    
          print(f"Task failed: {exc}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    sim_task = asyncio.create_task(game_loop())
    sim_task.add_done_callback(handle_task_exception)

    agent_decision_task = asyncio.create_task(agent_decision_loop())
    agent_decision_task.add_done_callback(handle_task_exception)

    yield
    sim_task.cancel()
    agent_decision_task.cancel()

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


@app.get("/get_state", response_model=State)
async def get_state():
    """Initialize the game by returning current state."""
    try:
        client = await get_redis()
        return State.model_validate_json(await client.get(config.game_state_key))
    except Exception as e:
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

        return {
            "status": "healthy" if ping_response else "unhealthy",
            "redis": "connected" if ping_response else "not_connected",
        }
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Redis connection failed: {str(e)}"
        )
