from pydantic import BaseModel, Field
from redis_client import get_redis
from models import State
from config import config
from utils import get_demand
from statistics import mean


class GetZoneForecastSchema(BaseModel):
    zone_id: str = Field(..., description="The zone to analyze")
    hours_ahead: int = Field(
        1, description="How many hours into the future to look (1-3)"
    )


async def get_zone_forecast(state: State, zone_id: str, hours_ahead: int):
    zone = next((z for z in state.zones if z.id == zone_id), None)
    if not zone:
        return []

    demands = [-1] * (hours_ahead * 60)

    demands = [
        sum(
            get_demand(
                minute_of_the_day=minute + state.current_time,
                peak_time=(start + end) // 2,
                max_orders=zone.max_orders,
                base_demand=zone.base_demand,
            )
            for (start, end) in zone.peak_hours
        )
        for minute in range(hours_ahead * 60)
    ]

    hourly_demands = [mean(demands[i : i + 60]) for i in range(0, len(demands), 60)]

    return hourly_demands
