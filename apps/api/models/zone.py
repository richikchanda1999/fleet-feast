from pydantic import BaseModel
from enum import Enum

class ZoneType(str, Enum):
    DOWNTOWN = "downtown"
    UNIVERSITY = "university"
    PARK = "park"
    STADIUM = "stadium"
    RESIDENTIAL = "residential"


class Zone(BaseModel):
    id: str
    type: ZoneType
    base_demand: float

    costs: dict[str, int]
    num_of_parking_spots: int

    demand: list[float] = [-1] * (24 * 60)
    max_orders: int
    peak_hours: list[tuple[int, int]]
