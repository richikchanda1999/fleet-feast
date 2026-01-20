from pydantic import BaseModel
from enum import Enum
from typing import Optional


class TruckStatus(str, Enum):
    IDLE = "IDLE"  # Sitting doing nothing (rare)
    SERVING = "SERVING"  # At a zone, selling food
    MOVING = "MOVING"  # On the road (earning $0)
    RESTOCKING = "RESTOCKING"  # Waiting for inventory


class RestockingCost(BaseModel):
    fixed_cost: int
    price_per_unit: int


class Truck(BaseModel):
    id: str

    status: TruckStatus = TruckStatus.IDLE
    current_zone: str
    destination_zone: Optional[str] = None

    inventory: int
    max_inventory: int

    speed_multiplier: float
    arrival_time: int

    restocking_finish_time: Optional[int] = None
    restocking_cost: RestockingCost
    sales_accummulator: float = 0.0

    total_revenue: float = 0.0

    @property
    def is_available(self):
        return self.status == TruckStatus.SERVING or self.status == TruckStatus.IDLE

    def get_max_restockable_units(self) -> int:
        units_needed = self.max_inventory - self.inventory

        if self.total_revenue < self.restocking_cost.fixed_cost or units_needed <= 0:
            return 0

        remaining = self.total_revenue - self.restocking_cost.fixed_cost
        max_affordable = int(remaining // self.restocking_cost.price_per_unit)

        return min(units_needed, max_affordable)

    def get_restocking_cost(self, units: Optional[int] = None) -> float:
        if units is None:
            units = self.max_inventory - self.inventory

        if units <= 0:
            return 0

        return self.restocking_cost.fixed_cost + (
            self.restocking_cost.price_per_unit * units
        )

    def restock(self) -> tuple[int, float]:
        """Perform restocking, returns (units_restocked, cost)."""
        units = self.get_max_restockable_units()

        if units <= 0:
            return (0, 0)

        cost = self.get_restocking_cost(units)
        self.inventory += units
        self.total_revenue -= cost

        return (units, cost)

    def start_restocking(self, current_time: int):
        self.status = TruckStatus.RESTOCKING
        self.restocking_finish_time = current_time + 10

    def complete_restocking(self):
        self.status = TruckStatus.SERVING
        self.restocking_finish_time = None

    def process_sales(self, demand: float, base_demand: float):
        if self.inventory > 0:
            depletion_rate = demand / base_demand

            self.sales_accummulator += depletion_rate

            units_to_sell = int(self.sales_accummulator)
            if units_to_sell >= 1:
                units_to_sell = min(units_to_sell, self.inventory)
                self.sales_accummulator -= units_to_sell
                self.inventory -= units_to_sell

                price_per_unit = 100 * depletion_rate
                price_per_unit = max(50, min(200, price_per_unit))
                self.total_revenue += price_per_unit * units_to_sell

    def dispatch(self, destination_zone: str, arrival_time: int):
        self.destination_zone = destination_zone
        self.arrival_time = arrival_time
        self.status = TruckStatus.MOVING
