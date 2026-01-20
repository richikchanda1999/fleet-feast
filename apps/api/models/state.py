from pydantic import BaseModel, model_validator
from .truck import Truck
from .zone import Zone, ZoneType
from utils import to_minutes


class State(BaseModel):
    current_time: int = 0
    shortest_paths: dict[str, dict[str, int]] = {}

    zones: list[Zone] = [
        Zone(
            id="downtown-1",
            type=ZoneType.DOWNTOWN,
            base_demand=1.0,
            costs={
                "university-1": to_minutes(minutes=10),
                "park-1": to_minutes(minutes=15),
                "residential-1": to_minutes(minutes=30),
            },
            num_of_parking_spots=2,
            max_orders=300,
            peak_hours=[
                (to_minutes(hours=11, minutes=30), to_minutes(hours=14, minutes=00))
            ],
        ),
        Zone(
            id="university-1",
            type=ZoneType.UNIVERSITY,
            base_demand=0.6,
            costs={
                "downtown-1": to_minutes(minutes=10),
                "residential-1": to_minutes(minutes=15),
            },
            num_of_parking_spots=1,
            max_orders=200,
            peak_hours=[
                (to_minutes(hours=22, minutes=00), to_minutes(hours=1, minutes=00)),
                (to_minutes(hours=15, minutes=00), to_minutes(hours=17, minutes=00)),
            ],
        ),
        Zone(
            id="park-1",
            type=ZoneType.PARK,
            base_demand=0.4,
            costs={
                "downtown-1": to_minutes(minutes=15),
                "residential-1": to_minutes(minutes=10),
                "stadium-1": to_minutes(minutes=20),
            },
            num_of_parking_spots=1,
            max_orders=200,
            peak_hours=[
                (to_minutes(hours=16, minutes=00), to_minutes(hours=18, minutes=00))
            ],
        ),
        Zone(
            id="residential-1",
            type=ZoneType.RESIDENTIAL,
            base_demand=0.8,
            costs={
                "park-1": to_minutes(minutes=10),
                "university-1": to_minutes(minutes=15),
                "downtown-1": to_minutes(minutes=30),
            },
            num_of_parking_spots=2,
            max_orders=200,
            peak_hours=[
                (to_minutes(hours=19, minutes=00), to_minutes(hours=21, minutes=30))
            ],
        ),
        Zone(
            id="stadium-1",
            type=ZoneType.STADIUM,
            base_demand=0.0,
            costs={"park-1": to_minutes(minutes=20)},
            num_of_parking_spots=1,
            max_orders=0,
            peak_hours=[],
        ),
    ]

    trucks: list[Truck] = [
        Truck(
            id="truck-1",
            current_zone="downtown-1",
            inventory=150,
            max_inventory=200,
            speed_multiplier=0.5,
            arrival_time=to_minutes(hours=00, minutes=00),
        ),
        Truck(
            id="truck-2",
            current_zone="university-1",
            inventory=70,
            max_inventory=100,
            speed_multiplier=1.0,
            arrival_time=to_minutes(hours=00, minutes=00),
        ),
        Truck(
            id="truck-3",
            current_zone="residential-1",
            inventory=50,
            max_inventory=50,
            speed_multiplier=0.8,
            arrival_time=to_minutes(hours=00, minutes=00),
        ),
    ]

    @model_validator(mode="after")
    def compute_paths(self) -> "State":
        if not self.shortest_paths:
            zone_ids = [z.id for z in self.zones]
            dist = {z1: {z2: 10**9 for z2 in zone_ids} for z1 in zone_ids}

            for z in zone_ids:
                dist[z][z] = 0

            for zone in self.zones:
                for neighbor, cost in zone.costs.items():
                    dist[zone.id][neighbor] = cost

            for k in zone_ids:
                for i in zone_ids:
                    for j in zone_ids:
                        if dist[i][k] + dist[k][j] < dist[i][j]:
                            dist[i][j] = dist[i][k] + dist[k][j]

            self.shortest_paths = dist
        return self

    def get_travel_time(self, from_zone: str, to_zone: str) -> int:
        """Get shortest travel time between two zones."""
        return self.shortest_paths[from_zone][to_zone]
