from pydantic import BaseModel, Field
from redis_client import enqueue


class HoldPositionSchema(BaseModel):
    reasoning: str = Field(
        ...,
        description="Why is the current fleet configuration optimal? (e.g., 'All trucks are positioned in high-demand zones and have sufficient inventory.')",
    )


async def hold_position(reasoning: str):
    return await enqueue(
        "pending_actions",
        {
            "action": "hold_position",
            "reasoning": reasoning,
        },
    )
