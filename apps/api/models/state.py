from pydantic import BaseModel
from .truck import Truck
from .zone import Zone, ZoneType
from utils import to_seconds


class State(BaseModel):
    current_time: int = 0

    zones: list[Zone] = [
        Zone(
            id="downtown-1",
            type=ZoneType.DOWNTOWN,
            base_demand=1.0,
            costs={
                "university-1": to_seconds(minutes=10),
                "park-1": to_seconds(minutes=15),
                "residential-1": to_seconds(minutes=30),
            },
            num_of_parking_spots=2,
        ),
        Zone(
            id="university-1",
            type=ZoneType.UNIVERSITY,
            base_demand=0.6,
            costs={
                "downtown-1": to_seconds(minutes=10),
                "residential-1": to_seconds(minutes=15),
            },
            num_of_parking_spots=1,
        ),
        Zone(
            id="park-1",
            type=ZoneType.PARK,
            base_demand=0.4,
            costs={
                "downtown-1": to_seconds(minutes=15),
                "residential-1": to_seconds(minutes=10),
                "stadium-1": to_seconds(minutes=20),
            },
            num_of_parking_spots=1,
        ),
        Zone(
            id="residential-1",
            type=ZoneType.RESIDENTIAL,
            base_demand=0.8,
            costs={
                "park-1": to_seconds(minutes=10),
                "university-1": to_seconds(minutes=15),
                "downtown-1": to_seconds(minutes=30),
            },
            num_of_parking_spots=2,
        ),
        Zone(
            id="stadium-1",
            type=ZoneType.STADIUM,
            base_demand=0.0,
            costs={"park-1": to_seconds(minutes=20)},
            num_of_parking_spots=1,
        ),
    ]

    trucks: list[Truck] = [
        Truck(
            id="truck-1",
            current_zone="downtown-1",
            inventory=150,
            max_inventory=200,
            speed_multiplier=0.5,
            arrival_time=to_seconds(hours=9, minutes=30),
        ),
        Truck(
            id="truck-2",
            current_zone="university-1",
            inventory=70,
            max_inventory=100,
            speed_multiplier=1.0,
            arrival_time=to_seconds(hours=7, minutes=00),
        ),
        Truck(
            id="truck-3",
            current_zone="residential-1",
            inventory=50,
            max_inventory=50,
            speed_multiplier=0.8,
            arrival_time=to_seconds(hours=8, minutes=00),
        ),
    ]
