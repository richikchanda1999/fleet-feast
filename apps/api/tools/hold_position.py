from pydantic import BaseModel, Field
from redis_client import enqueue
from config import config
from models import State


class HoldPositionSchema(BaseModel):
    truck_id: str = Field(
        ...,
        description="The ID of the truck to hold position (e.g., 'truck-1', 'truck-2')",
    )
    reasoning: str = Field(
        ...,
        description="Why is the current fleet configuration optimal? (e.g., 'All trucks are positioned in high-demand zones and have sufficient inventory.')",
    )


async def hold_position(state: State, truck_id: str, reasoning: str):
    return await enqueue(
        config.pending_actions_queue,
        {
            "action": "hold_position",
            "current_time": state.current_time,
            "truck_id": truck_id,
            "reasoning": reasoning,
        },
    )
