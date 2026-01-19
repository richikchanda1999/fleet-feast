import numpy as np


def to_seconds(hours: int = 0, minutes: int = 0, seconds: int = 0) -> int:
    return hours * 3600 + minutes * 60 + seconds


def to_minutes(hours: int = 0, minutes: int = 0) -> int:
    return int(to_seconds(hours, minutes) / 60)


def from_seconds(seconds: int = 0) -> tuple[int, int, int]:
    hours = int(seconds / 3600)
    seconds -= hours * 3600

    minutes = int(seconds / 60)
    seconds -= minutes * 60

    return (hours, minutes, seconds)


def get_demand(
    minute_of_the_day: int, peak_time: int, max_orders: int, base_demand: float
):
    gaussian_demand = max_orders * np.exp(
        -((minute_of_the_day - peak_time) ** 2) / (2 * base_demand**2)
    )
    noise = max(np.random.normal(0, 2, 24).mean(), 0)

    return gaussian_demand + noise
