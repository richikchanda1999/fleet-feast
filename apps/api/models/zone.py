from pydantic import BaseModel
from enum import Enum
import numpy as np


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

    def _get_demand(self, minute_of_the_day: int, peak_time: int):
        gaussian_demand = self.max_orders * np.exp(-((minute_of_the_day - peak_time) ** 2) / (2 * self.base_demand**2))
        noise = max(np.random.normal(0, 2, 24).mean(), 0)

        return gaussian_demand + noise

    def get_demands(self, current_time: int):
        return [self._get_demand(minute_of_the_day=current_time, peak_time=int((start + end) / 2)) for (start, end) in self.peak_hours]

    def update_demand(self, current_time: int):
        net_demand = sum(self.get_demands(current_time))
        self.demand[current_time] = net_demand

    def is_peak_hour(self, current_time: int) -> bool:
        for start, end in self.peak_hours:
            if start <= current_time <= end:
                return True
        return False
