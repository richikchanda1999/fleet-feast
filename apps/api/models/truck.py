from pydantic import BaseModel
from enum import Enum
from typing import Optional

class TruckStatus(str, Enum):
    IDLE = "IDLE"           # Sitting doing nothing (rare)
    SERVING = "SERVING"     # At a zone, selling food
    MOVING = "MOVING"       # On the road (earning $0)
    RESTOCKING = "RESTOCKING" # Waiting for inventory

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
    
    total_revenue: float = 0.0

    @property
    def is_available(self):
        return self.status == TruckStatus.SERVING or self.status == TruckStatus.IDLE
    
