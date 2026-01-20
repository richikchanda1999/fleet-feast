import { State, Zone, Truck, TruckStatus } from "@/lib/api/types.gen";

export enum DemandTrend {
  UP = "UP",
  DOWN = "DOWN",
  STABLE = "STABLE",
}

// Match backend TruckStatus exactly
export enum VehicleStatus {
  IDLE = "IDLE",
  SERVING = "SERVING",
  MOVING = "MOVING",
  RESTOCKING = "RESTOCKING",
}

export enum DecisionType {
  DISPATCH = "DISPATCH",
  REROUTE = "REROUTE",
  WAIT = "WAIT",
}

export interface ZoneDemand {
  id: string;
  name: string;
  type: string;
  demand: number;
  demandRaw: number;
  maxOrders: number;
  trend: DemandTrend;
  parkingSpots: number;
  peakHours: string[];
}

export interface DashboardTruck {
  id: string;
  name: string;
  status: VehicleStatus;
  currentZone: string;
  destinationZone: string | null;
  inventory: number;
  maxInventory: number;
  totalRevenue: number;
}

export interface Decision {
  id: string;
  type: DecisionType;
  description: string;
  timestamp: Date;
}

export interface GameStateOutput {
  currentTime: number;
  zoneDemands: ZoneDemand[];
  trucks: DashboardTruck[];
  decisions: Decision[];
}

/**
 * Calculate demand trend by comparing recent demand values
 */
function calculateTrend(demandArray: number[]): DemandTrend {
  if (demandArray.length < 2) return DemandTrend.STABLE;

  const recent = demandArray[demandArray.length - 1];
  const previous = demandArray[demandArray.length - 2];
  const diff = recent - previous;

  // Consider a change of more than 5% as a trend
  const threshold = 0.05 * Math.max(recent, previous, 1);

  if (diff > threshold) return DemandTrend.UP;
  if (diff < -threshold) return DemandTrend.DOWN;
  return DemandTrend.STABLE;
}

/**
 * Convert zone type to readable name
 */
function formatZoneName(zone: Zone): string {
  const typeName = zone.type.charAt(0).toUpperCase() + zone.type.slice(1);
  return `${typeName} (${zone.id})`;
}

/**
 * Map TruckStatus from backend to VehicleStatus for Dashboard
 */
function mapTruckStatus(status: TruckStatus): VehicleStatus {
  switch (status) {
    case TruckStatus.IDLE:
      return VehicleStatus.IDLE;
    case TruckStatus.MOVING:
      return VehicleStatus.MOVING;
    case TruckStatus.SERVING:
      return VehicleStatus.SERVING;
    case TruckStatus.RESTOCKING:
      return VehicleStatus.RESTOCKING;
    default:
      return VehicleStatus.IDLE;
  }
}

/**
 * Format peak hours tuple to readable time range
 */
function formatPeakHour(start: number, end: number): string {
  const formatMinutes = (m: number) => {
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, "0")}${period}`;
  };
  return `${formatMinutes(start)}-${formatMinutes(end)}`;
}

/**
 * Transform backend State to GameStateOutput for Dashboard
 */
export function transformStateToGameState(state: State): GameStateOutput {
  const zones = state.zones ?? [];
  const trucks = state.trucks ?? [];

  const zoneDemands: ZoneDemand[] = zones.map((zone) => {
    const demandArray = zone.demand ?? [];
    // Get the current demand value (last in the array)
    const currentDemand = demandArray.length > 0
      ? demandArray[demandArray.length - 1]
      : 0;
    // Normalize to percentage (0-100), handle division by zero
    const demandPercentage = zone.max_orders > 0
      ? Math.min(100, Math.round((currentDemand / zone.max_orders) * 100))
      : 0;

    return {
      id: zone.id,
      name: formatZoneName(zone),
      type: zone.type,
      demand: demandPercentage,
      demandRaw: Math.round(currentDemand * 10) / 10,
      maxOrders: zone.max_orders,
      trend: calculateTrend(demandArray),
      parkingSpots: zone.num_of_parking_spots,
      peakHours: zone.peak_hours.map(([start, end]) => formatPeakHour(start, end)),
    };
  });

  const dashboardTrucks: DashboardTruck[] = trucks.map((truck) => ({
    id: truck.id,
    name: `Truck ${truck.id}`,
    status: mapTruckStatus(truck.status ?? TruckStatus.IDLE),
    currentZone: truck.current_zone,
    destinationZone: truck.destination_zone ?? null,
    inventory: truck.inventory,
    maxInventory: truck.max_inventory,
    totalRevenue: Math.round((truck.total_revenue ?? 0) * 100) / 100,
  }));

  return {
    currentTime: state.current_time ?? 0,
    zoneDemands,
    trucks: dashboardTrucks,
    decisions: [], // Decisions would come from a separate source (agent logs)
  };
}
