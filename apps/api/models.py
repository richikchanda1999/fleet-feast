from enum import Enum

from pydantic import BaseModel


class ZoneType(str, Enum):
    DOWNTOWN = "downtown"
    UNIVERSITY = "university"
    PARK = "park"
    STADIUM = "stadium"
    RESIDENTIAL = "residential"


class TileType(str, Enum):
    GRASS = "Grass"
    TILE = "Tile"
    ASPHALT = "Asphalt"
    ROAD = "Road"
    BUILDING = "Building"
    SNOW = "Snow"


class Direction(str, Enum):
    UP = "Up"
    DOWN = "Down"
    LEFT = "Left"
    RIGHT = "Right"


class VehicleStatus(str, Enum):
    IDLE = "idle"
    EN_ROUTE = "en-route"
    DELIVERING = "delivering"
    RETURNING = "returning"


class OrderStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"


class DecisionType(str, Enum):
    DISPATCH = "dispatch"
    REROUTE = "reroute"
    WAIT = "wait"


class DemandTrend(str, Enum):
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


class DemandPattern(BaseModel):
    peakHours: list[int]
    baseMultiplier: float
    peakMultiplier: float
    description: str


class ParkingSpot(BaseModel):
    x: int
    y: int
    name: str
    capacity: int


class ZoneBounds(BaseModel):
    x: int
    y: int
    width: int
    height: int


class Zone(BaseModel):
    id: ZoneType
    name: str
    description: str
    color: str
    tileType: TileType
    bounds: ZoneBounds
    demandPattern: DemandPattern
    parkingSpots: list[ParkingSpot]


class RoadSegment(BaseModel):
    x: int
    y: int


class BuildingPlacement(BaseModel):
    buildingId: str
    x: int
    y: int
    orientation: Direction


class CityStructure(BaseModel):
    zones: list[Zone]
    roadSegments: list[RoadSegment]
    buildingPlacements: list[BuildingPlacement]


class FleetVehicle(BaseModel):
    id: str
    name: str
    status: VehicleStatus
    currentZone: str | None = None
    destination: str | None = None
    x: int | None = None
    y: int | None = None


class Order(BaseModel):
    id: str
    zoneId: str
    status: OrderStatus
    assignedTruckId: str | None = None


class Decision(BaseModel):
    id: str
    timestamp: str  # ISO format string
    type: DecisionType
    description: str


class ZoneDemand(BaseModel):
    id: str
    name: str
    demand: int  # 0-100
    trend: DemandTrend


class GameState(BaseModel):
    trucks: list[FleetVehicle] = []
    orders: list[Order] = []
    decisions: list[Decision] = []
    zoneDemands: list[ZoneDemand] = []
    simulationTime: int = 0
    score: int = 0


class InitResponse(BaseModel):
    city: CityStructure
    gameState: GameState
