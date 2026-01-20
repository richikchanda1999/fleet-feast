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

    def _get_demand(self, minute_of_the_day: int, start: int, end: int):
        if end < start:
            end_adjusted = end + 1440
        else:
            end_adjusted = end

        peak_time = ((start + end_adjusted) / 2) % (24 * 60)

        diff = abs(minute_of_the_day - peak_time)
        distance = min(diff, (24 * 60) - diff)  # Shortest path around the clock

        sigma = (end_adjusted - start) / 4
        gaussian_demand = self.max_orders * np.exp(-(distance**2) / (2 * sigma**2))

        noise_amplitude = 0.05 * gaussian_demand  # 5% variation
        smooth_noise = noise_amplitude * np.sin(minute_of_the_day * 0.05 + hash(self.id) % 100)
        return max(0, gaussian_demand + smooth_noise)

    def get_demands(self, current_time: int):
        return [self._get_demand(current_time, start, end) for (start, end) in self.peak_hours]

    def update_demand(self, current_time: int):
        net_demand = sum(self.get_demands(current_time))
        self.demand[current_time] = net_demand

    def is_peak_hour(self, current_time: int) -> bool:
        for start, end in self.peak_hours:
            if start <= current_time <= end:
                return True
        return False
