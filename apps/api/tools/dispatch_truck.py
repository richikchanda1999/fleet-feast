from pydantic import BaseModel, Field
from redis_client import enqueue


class DispatchTruckSchema(BaseModel):
    truck_id: str = Field(
        ..., description="The ID of the truck to move (e.g., 'truck-1', 'truck-2')"
    )
    destination_zone: str = Field(
        ..., description="The ID of the target zone (e.g., 'downtown-1', 'stadium-1')"
    )
    reasoning: str = Field(
        ...,
        description="A short, clear explanation of why this move maximizes revenue (e.g., 'Moving T1 to Stadium to catch the 6pm event rush.')",
    )


async def dispatch_truck(truck_id: str, destination_zone: str, reasoning: str):
    return await enqueue(
        "pending_actions",
        {
            "action": "dispatch_truck",
            "truck_id": truck_id,
            "destination_zone": destination_zone,
            "reasoning": reasoning,
        },
    )
