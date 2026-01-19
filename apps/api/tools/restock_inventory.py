from pydantic import BaseModel, Field
from redis_client import enqueue


class RestockInventorySchema(BaseModel):
    truck_id: str = Field(..., description="The ID of the truck that needs supplies")
    reasoning: str = Field(
        ...,
        description="Why is restocking necessary now? (e.g., 'Inventory is at 10% and a demand spike is forecasted.')",
    )


async def restock_inventory(truck_id: str, reasoning: str):
    return await enqueue(
        "pending_actions",
        {
            "action": "restock_inventory",
            "truck_id": truck_id,
            "reasoning": reasoning,
        },
    )
