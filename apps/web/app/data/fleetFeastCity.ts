/**
 * Fleet Feast City Configuration
 *
 * A pre-designed city for the Fleet Feast demo showcasing AI-coordinated food trucks.
 * The city has 5 distinct zones with different demand patterns, connected by a road network.
 *
 * Grid: 48x48 cells (each cell is 44x22 pixels in isometric projection)
 * Roads: 4x4 segment system for clean intersections
 */

// Import only types and utilities - avoid importing the full pogicity which includes Phaser
import { TileType, GridCell, Direction, GRID_WIDTH, GRID_HEIGHT } from "pogicity/types";
import {
  ROAD_SEGMENT_SIZE,
  getRoadConnections,
  getSegmentType,
  generateRoadPattern,
} from "pogicity/roadUtils";
import { getBuilding, getBuildingFootprint } from "pogicity/buildings";

// ============================================================================
// ZONE DEFINITIONS
// ============================================================================

export type ZoneType = "downtown" | "university" | "park" | "stadium" | "residential";

export interface DemandPattern {
  peakHours: number[]; // Hours of day (0-23) when demand is highest
  baseMultiplier: number; // Base demand multiplier (0-1)
  peakMultiplier: number; // Peak demand multiplier (0-1)
  description: string;
}

export interface ParkingSpot {
  x: number;
  y: number;
  name: string;
  capacity: number; // Max trucks that can park here
}

export interface Zone {
  id: ZoneType;
  name: string;
  description: string;
  color: string; // For visualization overlays
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  demandPattern: DemandPattern;
  parkingSpots: ParkingSpot[];
}

export const ZONES: Zone[] = [
  {
    id: "downtown",
    name: "Downtown Office District",
    description: "Dense office buildings with high lunch rush demand",
    color: "#3B82F6", // Blue
    bounds: { x: 17, y: 17, width: 14, height: 14 },
    demandPattern: {
      peakHours: [11, 12, 13], // 11am-2pm lunch rush
      baseMultiplier: 0.2,
      peakMultiplier: 1.0,
      description: "Heavy lunch rush from office workers",
    },
    parkingSpots: [
      { x: 20, y: 20, name: "Office Plaza", capacity: 2 },
      { x: 26, y: 26, name: "Corporate Corner", capacity: 1 },
    ],
  },
  {
    id: "university",
    name: "University Campus",
    description: "Academic buildings with student-driven demand",
    color: "#DC2626", // Red (brick)
    bounds: { x: 2, y: 2, width: 14, height: 14 },
    demandPattern: {
      peakHours: [11, 12, 13, 18, 19, 20], // Lunch and dinner
      baseMultiplier: 0.3,
      peakMultiplier: 0.85,
      description: "Students hungry at lunch and dinner",
    },
    parkingSpots: [
      { x: 8, y: 8, name: "Library Quad", capacity: 2 },
      { x: 12, y: 4, name: "Student Center", capacity: 1 },
    ],
  },
  {
    id: "park",
    name: "Central Park",
    description: "Green space with recreational visitors",
    color: "#22C55E", // Green
    bounds: { x: 32, y: 2, width: 14, height: 14 },
    demandPattern: {
      peakHours: [12, 17, 18, 19], // Lunch and after-work
      baseMultiplier: 0.15,
      peakMultiplier: 0.7,
      description: "Picnickers and joggers",
    },
    parkingSpots: [
      { x: 38, y: 8, name: "Pavilion Area", capacity: 2 },
    ],
  },
  {
    id: "stadium",
    name: "Sports Stadium",
    description: "Large arena with event-driven demand spikes",
    color: "#F97316", // Orange
    bounds: { x: 2, y: 32, width: 14, height: 14 },
    demandPattern: {
      peakHours: [18, 19, 20, 21], // Evening events
      baseMultiplier: 0.05, // Almost no demand without events
      peakMultiplier: 1.0, // Massive demand during events
      description: "Sporadic but intense event crowds",
    },
    parkingSpots: [
      { x: 8, y: 36, name: "Stadium Gate", capacity: 3 },
    ],
  },
  {
    id: "residential",
    name: "Residential Area",
    description: "Homes and apartments with evening dinner demand",
    color: "#A855F7", // Purple
    bounds: { x: 32, y: 32, width: 14, height: 14 },
    demandPattern: {
      peakHours: [17, 18, 19, 20], // Dinner time
      baseMultiplier: 0.25,
      peakMultiplier: 0.8,
      description: "Families wanting dinner convenience",
    },
    parkingSpots: [
      { x: 38, y: 38, name: "Community Corner", capacity: 1 },
      { x: 42, y: 34, name: "Apartment Complex", capacity: 1 },
    ],
  },
];

// ============================================================================
// ROAD NETWORK
// ============================================================================

/**
 * Road segments are placed at 4x4 aligned positions.
 * This creates a grid connecting all zones with intersections.
 */
export const ROAD_SEGMENTS: Array<{ x: number; y: number }> = [
  // Main horizontal artery at y=16 (top of downtown)
  { x: 4, y: 16 },
  { x: 8, y: 16 },
  { x: 12, y: 16 },
  { x: 16, y: 16 }, // Intersection
  { x: 20, y: 16 },
  { x: 24, y: 16 },
  { x: 28, y: 16 }, // Intersection
  { x: 32, y: 16 },
  { x: 36, y: 16 },
  { x: 40, y: 16 },

  // Main horizontal artery at y=28 (bottom of downtown)
  { x: 4, y: 28 },
  { x: 8, y: 28 },
  { x: 12, y: 28 },
  { x: 16, y: 28 }, // Intersection
  { x: 20, y: 28 },
  { x: 24, y: 28 },
  { x: 28, y: 28 }, // Intersection
  { x: 32, y: 28 },
  { x: 36, y: 28 },
  { x: 40, y: 28 },

  // Main vertical artery at x=16 (left of downtown)
  { x: 16, y: 4 },
  { x: 16, y: 8 },
  { x: 16, y: 12 },
  // { x: 16, y: 16 }, // Already added above
  { x: 16, y: 20 },
  { x: 16, y: 24 },
  // { x: 16, y: 28 }, // Already added above
  { x: 16, y: 32 },
  { x: 16, y: 36 },
  { x: 16, y: 40 },

  // Main vertical artery at x=28 (right of downtown)
  { x: 28, y: 4 },
  { x: 28, y: 8 },
  { x: 28, y: 12 },
  // { x: 28, y: 16 }, // Already added above
  { x: 28, y: 20 },
  { x: 28, y: 24 },
  // { x: 28, y: 28 }, // Already added above
  { x: 28, y: 32 },
  { x: 28, y: 36 },
  { x: 28, y: 40 },

  // Downtown internal roads (center cross)
  { x: 20, y: 20 },
  { x: 24, y: 20 },
  { x: 20, y: 24 },
  { x: 24, y: 24 },

  // University campus access roads
  { x: 8, y: 4 },
  { x: 8, y: 8 },
  { x: 8, y: 12 },
  { x: 4, y: 8 },
  { x: 12, y: 8 },

  // Park access roads
  { x: 36, y: 4 },
  { x: 36, y: 8 },
  { x: 36, y: 12 },
  { x: 40, y: 8 },

  // Stadium access roads
  { x: 8, y: 32 },
  { x: 8, y: 36 },
  { x: 8, y: 40 },
  { x: 4, y: 36 },
  { x: 12, y: 36 },

  // Residential area access roads
  { x: 36, y: 32 },
  { x: 36, y: 36 },
  { x: 36, y: 40 },
  { x: 40, y: 36 },
  { x: 32, y: 36 },
];

// ============================================================================
// BUILDING PLACEMENTS
// ============================================================================

export interface BuildingPlacement {
  buildingId: string;
  x: number;
  y: number;
  orientation: Direction;
}

export const BUILDING_PLACEMENTS: BuildingPlacement[] = [
  // ========== DOWNTOWN OFFICE DISTRICT ==========
  // Large office buildings
  { buildingId: "palo-alto-wide-office", x: 18, y: 18, orientation: Direction.Down },
  { buildingId: "palo-alto-office-center", x: 25, y: 18, orientation: Direction.Down },
  { buildingId: "magicpath-office", x: 18, y: 25, orientation: Direction.Down },
  { buildingId: "general-intelligence-office", x: 25, y: 25, orientation: Direction.Down },

  // Commercial/retail ground floor
  { buildingId: "dunkin", x: 17, y: 17, orientation: Direction.Down },
  { buildingId: "popeyes", x: 29, y: 17, orientation: Direction.Down },

  // ========== UNIVERSITY CAMPUS ==========
  // Main academic buildings
  { buildingId: "internet-archive", x: 4, y: 4, orientation: Direction.Down }, // Library
  { buildingId: "private-school", x: 11, y: 4, orientation: Direction.Down }, // Lecture hall
  { buildingId: "bookstore", x: 4, y: 11, orientation: Direction.Down },

  // Student housing
  { buildingId: "80s-apartment", x: 12, y: 11, orientation: Direction.Down },
  { buildingId: "row-houses", x: 12, y: 14, orientation: Direction.Down },

  // Campus decorations
  { buildingId: "fountain", x: 9, y: 9, orientation: Direction.Down },
  { buildingId: "statue", x: 7, y: 5, orientation: Direction.Down },
  { buildingId: "tree-1", x: 5, y: 10, orientation: Direction.Down },
  { buildingId: "tree-2", x: 10, y: 5, orientation: Direction.Down },
  { buildingId: "modern-bench", x: 8, y: 10, orientation: Direction.Down },

  // ========== CENTRAL PARK ==========
  // Pavilion/gazebo area (using trees and benches for now)
  { buildingId: "fountain", x: 38, y: 6, orientation: Direction.Down },
  { buildingId: "tree-1", x: 34, y: 4, orientation: Direction.Down },
  { buildingId: "tree-2", x: 36, y: 4, orientation: Direction.Down },
  { buildingId: "tree-3", x: 38, y: 4, orientation: Direction.Down },
  { buildingId: "tree-4", x: 40, y: 4, orientation: Direction.Down },
  { buildingId: "tree-1", x: 42, y: 4, orientation: Direction.Down },
  { buildingId: "tree-2", x: 44, y: 4, orientation: Direction.Down },
  { buildingId: "tree-3", x: 34, y: 6, orientation: Direction.Down },
  { buildingId: "tree-4", x: 42, y: 6, orientation: Direction.Down },
  { buildingId: "tree-1", x: 34, y: 10, orientation: Direction.Down },
  { buildingId: "tree-2", x: 40, y: 10, orientation: Direction.Down },
  { buildingId: "tree-3", x: 44, y: 10, orientation: Direction.Down },
  { buildingId: "tree-4", x: 34, y: 14, orientation: Direction.Down },
  { buildingId: "tree-1", x: 38, y: 14, orientation: Direction.Down },
  { buildingId: "tree-2", x: 42, y: 14, orientation: Direction.Down },

  // Park benches and tables
  { buildingId: "victorian-bench", x: 36, y: 6, orientation: Direction.Down },
  { buildingId: "victorian-bench", x: 40, y: 6, orientation: Direction.Left },
  { buildingId: "park-table", x: 36, y: 10, orientation: Direction.Down },
  { buildingId: "park-table", x: 38, y: 10, orientation: Direction.Down },
  { buildingId: "modern-bench", x: 36, y: 14, orientation: Direction.Down },

  // ========== STADIUM AREA ==========
  // Main stadium (using large landmark building)
  { buildingId: "schwab-mansion", x: 4, y: 34, orientation: Direction.Down }, // Stadium

  // Parking area buildings
  { buildingId: "checkers", x: 12, y: 34, orientation: Direction.Down }, // Food vendor
  { buildingId: "bus-shelter", x: 4, y: 42, orientation: Direction.Down },

  // ========== RESIDENTIAL AREA ==========
  // Houses and apartments
  { buildingId: "sf-victorian", x: 34, y: 34, orientation: Direction.Down },
  { buildingId: "sf-victorian-2", x: 37, y: 34, orientation: Direction.Down },
  { buildingId: "full-house", x: 40, y: 34, orientation: Direction.Down },
  { buildingId: "blue-painted-lady", x: 43, y: 34, orientation: Direction.Down },

  { buildingId: "english-townhouse", x: 34, y: 38, orientation: Direction.Down },
  { buildingId: "sf-marina-house", x: 37, y: 38, orientation: Direction.Down },
  { buildingId: "limestone", x: 40, y: 38, orientation: Direction.Down },
  { buildingId: "yellow-apartments", x: 43, y: 38, orientation: Direction.Down },

  { buildingId: "brownstone", x: 34, y: 41, orientation: Direction.Down },
  { buildingId: "romanesque-2", x: 37, y: 41, orientation: Direction.Down },
  { buildingId: "romanesque-3", x: 40, y: 41, orientation: Direction.Down },
  { buildingId: "strange-townhouse", x: 43, y: 41, orientation: Direction.Down },

  // Residential amenities
  { buildingId: "martini-bar", x: 34, y: 44, orientation: Direction.Down }, // Corner store
  { buildingId: "tree-1", x: 45, y: 34, orientation: Direction.Down },
  { buildingId: "tree-2", x: 45, y: 38, orientation: Direction.Down },
  { buildingId: "tree-3", x: 45, y: 42, orientation: Direction.Down },
];

// ============================================================================
// CITY INITIALIZATION
// ============================================================================

/**
 * Creates the initial grid with all roads, buildings, and decorations
 * for the Fleet Feast demo city.
 */
export function createFleetFeastCity(): GridCell[][] {
  // Initialize empty grid with grass
  const grid: GridCell[][] = Array.from({ length: GRID_HEIGHT }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => ({
      type: TileType.Grass,
      x,
      y,
      isOrigin: true,
    }))
  );

  // Place road segments
  for (const seg of ROAD_SEGMENTS) {
    // First pass: mark all cells as part of this road segment
    for (let dy = 0; dy < ROAD_SEGMENT_SIZE; dy++) {
      for (let dx = 0; dx < ROAD_SEGMENT_SIZE; dx++) {
        const px = seg.x + dx;
        const py = seg.y + dy;
        if (px < GRID_WIDTH && py < GRID_HEIGHT) {
          grid[py][px].isOrigin = dx === 0 && dy === 0;
          grid[py][px].originX = seg.x;
          grid[py][px].originY = seg.y;
          grid[py][px].type = TileType.Road; // Will be updated below
        }
      }
    }
  }

  // Second pass: update each segment with proper road patterns based on connections
  for (const seg of ROAD_SEGMENTS) {
    const connections = getRoadConnections(grid, seg.x, seg.y);
    const segmentType = getSegmentType(connections);
    const pattern = generateRoadPattern(segmentType);

    for (const tile of pattern) {
      const px = seg.x + tile.dx;
      const py = seg.y + tile.dy;
      if (px < GRID_WIDTH && py < GRID_HEIGHT) {
        grid[py][px].type = tile.type;
      }
    }
  }

  // Place buildings
  for (const placement of BUILDING_PLACEMENTS) {
    const building = getBuilding(placement.buildingId);
    if (!building) {
      console.warn(`Building not found: ${placement.buildingId}`);
      continue;
    }

    // Get footprint for the orientation
    const footprint = getBuildingFootprint(building, placement.orientation);

    // Calculate origin (buildings are placed by their SE corner in the original,
    // but we define them by top-left for simplicity)
    const originX = placement.x;
    const originY = placement.y;

    // Check if placement is valid
    let canPlace = true;
    for (let dy = 0; dy < footprint.height && canPlace; dy++) {
      for (let dx = 0; dx < footprint.width && canPlace; dx++) {
        const px = originX + dx;
        const py = originY + dy;
        if (px >= GRID_WIDTH || py >= GRID_HEIGHT) {
          canPlace = false;
        } else {
          const cell = grid[py][px];
          const isDecoration = building.category === "props" || building.isDecoration;
          if (isDecoration) {
            // Decorations can go on grass, tile, or snow
            if (cell.type !== TileType.Grass && cell.type !== TileType.Tile && cell.type !== TileType.Snow) {
              canPlace = false;
            }
          } else {
            // Regular buildings only on grass
            if (cell.type !== TileType.Grass) {
              canPlace = false;
            }
          }
        }
      }
    }

    if (!canPlace) {
      console.warn(`Cannot place building ${placement.buildingId} at (${placement.x}, ${placement.y})`);
      continue;
    }

    // Place the building
    const isDecoration = building.category === "props" || building.isDecoration;
    for (let dy = 0; dy < footprint.height; dy++) {
      for (let dx = 0; dx < footprint.width; dx++) {
        const px = originX + dx;
        const py = originY + dy;
        if (px < GRID_WIDTH && py < GRID_HEIGHT) {
          const underlyingType = isDecoration ? grid[py][px].type : undefined;
          grid[py][px].type = TileType.Building;
          grid[py][px].buildingId = placement.buildingId;
          grid[py][px].isOrigin = dx === 0 && dy === 0;
          grid[py][px].originX = originX;
          grid[py][px].originY = originY;
          if (isDecoration) {
            grid[py][px].underlyingTileType = underlyingType;
          }
          if (building.supportsRotation) {
            grid[py][px].buildingOrientation = placement.orientation;
          }
        }
      }
    }
  }

  return grid;
}

/**
 * Get all parking spots across all zones
 */
export function getAllParkingSpots(): ParkingSpot[] {
  return ZONES.flatMap(zone => zone.parkingSpots);
}

/**
 * Get the zone that contains a given point
 */
export function getZoneAtPoint(x: number, y: number): Zone | null {
  for (const zone of ZONES) {
    const { bounds } = zone;
    if (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    ) {
      return zone;
    }
  }
  return null;
}

/**
 * Calculate demand multiplier for a zone at a given hour
 */
export function getZoneDemand(zone: Zone, hour: number): number {
  const { demandPattern } = zone;
  if (demandPattern.peakHours.includes(hour)) {
    return demandPattern.peakMultiplier;
  }
  return demandPattern.baseMultiplier;
}

/**
 * Get all zones sorted by current demand (highest first)
 */
export function getZonesByDemand(hour: number): Zone[] {
  return [...ZONES].sort((a, b) => {
    const demandA = getZoneDemand(a, hour);
    const demandB = getZoneDemand(b, hour);
    return demandB - demandA;
  });
}
