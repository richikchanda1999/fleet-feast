from pydantic import BaseModel, Field
from redis_client import enqueue
from config import config
from models import State


class StartServingSchema(BaseModel):
    truck_id: str = Field(
        ..., description="The ID of the truck that should start serving (e.g., 'truck-1', 'truck-2')"
    )
    reasoning: str = Field(
        ...,
        description="A short, clear explanation of why the truck starting to serve maximizes revenue (e.g., 'Serving university-1 as demand is slowly increasing here')",
    )


async def start_serving(
    state: State, truck_id: str, reasoning: str
):
    return await enqueue(
        config.pending_actions_queue,
        {
            "action": "start_serving",
            "current_time": state.current_time,
            "truck_id": truck_id,
            "reasoning": reasoning,
        },
    )
