/**
 * Fleet Feast City Configuration
 *
 * A pre-designed city for the Fleet Feast demo showcasing AI-coordinated food trucks.
 * The city has 5 distinct zones with different demand patterns, connected by a road network.
 *
 * Grid: 48x48 cells (each cell is 44x22 pixels in isometric projection)
 * Roads: 4x4 segment system for clean intersections
 *
 * Road Layout:
 * - Main vertical arteries at x=16 and x=32 (each 4 cells wide: 16-19, 32-35)
 * - Main horizontal arteries at y=16 and y=32 (each 4 cells wide: 16-19, 32-35)
 *
 * This creates 4 corner zones + 1 center zone:
 * - University (top-left): x=0-15, y=0-15
 * - Park (top-right): x=36-47, y=0-15
 * - Stadium (bottom-left): x=0-15, y=36-47
 * - Residential (bottom-right): x=36-47, y=36-47
 * - Downtown (center): x=20-31, y=20-31
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
  tileType: TileType; // Ground tile type for this zone
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
    tileType: TileType.Tile, // Concrete/pavement feel
    bounds: { x: 20, y: 20, width: 12, height: 12 },
    demandPattern: {
      peakHours: [11, 12, 13], // 11am-2pm lunch rush
      baseMultiplier: 0.2,
      peakMultiplier: 1.0,
      description: "Heavy lunch rush from office workers",
    },
    parkingSpots: [
      { x: 22, y: 22, name: "Office Plaza", capacity: 2 },
      { x: 28, y: 28, name: "Corporate Corner", capacity: 1 },
    ],
  },
  {
    id: "university",
    name: "University Campus",
    description: "Academic buildings with student-driven demand",
    color: "#DC2626", // Red (brick)
    tileType: TileType.Grass, // Campus green
    bounds: { x: 0, y: 0, width: 16, height: 16 },
    demandPattern: {
      peakHours: [11, 12, 13, 18, 19, 20], // Lunch and dinner
      baseMultiplier: 0.3,
      peakMultiplier: 0.85,
      description: "Students hungry at lunch and dinner",
    },
    parkingSpots: [
      { x: 6, y: 6, name: "Library Quad", capacity: 2 },
      { x: 10, y: 2, name: "Student Center", capacity: 1 },
    ],
  },
  {
    id: "park",
    name: "Central Park",
    description: "Green space with recreational visitors",
    color: "#22C55E", // Green
    tileType: TileType.Grass, // Park green
    bounds: { x: 36, y: 0, width: 12, height: 16 },
    demandPattern: {
      peakHours: [12, 17, 18, 19], // Lunch and after-work
      baseMultiplier: 0.15,
      peakMultiplier: 0.7,
      description: "Picnickers and joggers",
    },
    parkingSpots: [
      { x: 40, y: 6, name: "Pavilion Area", capacity: 2 },
    ],
  },
  {
    id: "stadium",
    name: "Sports Stadium",
    description: "Large arena with event-driven demand spikes",
    color: "#F97316", // Orange
    tileType: TileType.Asphalt, // Parking lot feel
    bounds: { x: 0, y: 36, width: 16, height: 12 },
    demandPattern: {
      peakHours: [18, 19, 20, 21], // Evening events
      baseMultiplier: 0.05, // Almost no demand without events
      peakMultiplier: 1.0, // Massive demand during events
      description: "Sporadic but intense event crowds",
    },
    parkingSpots: [
      { x: 6, y: 40, name: "Stadium Gate", capacity: 3 },
    ],
  },
  {
    id: "residential",
    name: "Residential Area",
    description: "Homes and apartments with evening dinner demand",
    color: "#A855F7", // Purple
    tileType: TileType.Grass, // Suburban grass
    bounds: { x: 36, y: 36, width: 12, height: 12 },
    demandPattern: {
      peakHours: [17, 18, 19, 20], // Dinner time
      baseMultiplier: 0.25,
      peakMultiplier: 0.8,
      description: "Families wanting dinner convenience",
    },
    parkingSpots: [
      { x: 40, y: 40, name: "Community Corner", capacity: 1 },
      { x: 44, y: 38, name: "Apartment Complex", capacity: 1 },
    ],
  },
];

// ============================================================================
// ROAD NETWORK
// ============================================================================

/**
 * Road segments are placed at 4x4 aligned positions.
 * Main arteries at x=16, x=32 (vertical) and y=16, y=32 (horizontal)
 */
export const ROAD_SEGMENTS: Array<{ x: number; y: number }> = [
  // ===== MAIN HORIZONTAL ARTERY at y=16 (top road) =====
  { x: 0, y: 16 },
  { x: 4, y: 16 },
  { x: 8, y: 16 },
  { x: 12, y: 16 },
  { x: 16, y: 16 }, // Intersection with left vertical
  { x: 20, y: 16 },
  { x: 24, y: 16 },
  { x: 28, y: 16 },
  { x: 32, y: 16 }, // Intersection with right vertical
  { x: 36, y: 16 },
  { x: 40, y: 16 },
  { x: 44, y: 16 },

  // ===== MAIN HORIZONTAL ARTERY at y=32 (bottom road) =====
  { x: 0, y: 32 },
  { x: 4, y: 32 },
  { x: 8, y: 32 },
  { x: 12, y: 32 },
  { x: 16, y: 32 }, // Intersection with left vertical
  { x: 20, y: 32 },
  { x: 24, y: 32 },
  { x: 28, y: 32 },
  { x: 32, y: 32 }, // Intersection with right vertical
  { x: 36, y: 32 },
  { x: 40, y: 32 },
  { x: 44, y: 32 },

  // ===== MAIN VERTICAL ARTERY at x=16 (left road) =====
  { x: 16, y: 0 },
  { x: 16, y: 4 },
  { x: 16, y: 8 },
  { x: 16, y: 12 },
  // { x: 16, y: 16 }, // Already added (intersection)
  { x: 16, y: 20 },
  { x: 16, y: 24 },
  { x: 16, y: 28 },
  // { x: 16, y: 32 }, // Already added (intersection)
  { x: 16, y: 36 },
  { x: 16, y: 40 },
  { x: 16, y: 44 },

  // ===== MAIN VERTICAL ARTERY at x=32 (right road) =====
  { x: 32, y: 0 },
  { x: 32, y: 4 },
  { x: 32, y: 8 },
  { x: 32, y: 12 },
  // { x: 32, y: 16 }, // Already added (intersection)
  { x: 32, y: 20 },
  { x: 32, y: 24 },
  { x: 32, y: 28 },
  // { x: 32, y: 32 }, // Already added (intersection)
  { x: 32, y: 36 },
  { x: 32, y: 40 },
  { x: 32, y: 44 },

  // ===== DOWNTOWN INTERNAL ROADS =====
  // Horizontal through downtown at y=24
  { x: 20, y: 24 },
  { x: 24, y: 24 },
  { x: 28, y: 24 },
  // Vertical through downtown at x=24
  { x: 24, y: 20 },
  // { x: 24, y: 24 }, // Already added
  { x: 24, y: 28 },

  // ===== UNIVERSITY CAMPUS ACCESS ROADS =====
  // Vertical road at x=8
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 8, y: 8 },
  { x: 8, y: 12 },
  // Horizontal road at y=8
  { x: 0, y: 8 },
  { x: 4, y: 8 },
  // { x: 8, y: 8 }, // Already added
  { x: 12, y: 8 },

  // ===== PARK ACCESS ROADS =====
  // Vertical road at x=40
  { x: 40, y: 0 },
  { x: 40, y: 4 },
  { x: 40, y: 8 },
  { x: 40, y: 12 },

  // ===== STADIUM ACCESS ROADS =====
  // Simple vertical road at x=8 connecting to main road
  { x: 8, y: 36 },
  { x: 8, y: 40 },
  { x: 8, y: 44 },

  // ===== RESIDENTIAL ACCESS ROADS =====
  // Vertical road at x=40
  { x: 40, y: 36 },
  { x: 40, y: 40 },
  { x: 40, y: 44 },
  // Horizontal road at y=40
  // { x: 40, y: 40 }, // Already added
  { x: 44, y: 40 },
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

/**
 * Building placements are defined by their top-left corner position.
 * Each zone has buildings that fit within its boundaries, avoiding roads.
 */
export const BUILDING_PLACEMENTS: BuildingPlacement[] = [
  // ========== DOWNTOWN OFFICE DISTRICT (x=20-31, y=20-31) ==========
  // Uses TileType.Tile for urban feel
  // Available space: 20-23 (before road at 24), 25-31 (after road)

  // Left side of downtown (x=20-23)
  { buildingId: "promptlayer-office", x: 20, y: 20, orientation: Direction.Down }, // 2x3
  { buildingId: "dunkin", x: 20, y: 28, orientation: Direction.Down }, // 2x2

  // Right side of downtown (x=25-31, y=20-23 and y=25-31)
  { buildingId: "palo-alto-office-center", x: 26, y: 20, orientation: Direction.Down }, // 6x5
  { buildingId: "general-intelligence-office", x: 26, y: 26, orientation: Direction.Down }, // 4x3
  { buildingId: "popeyes", x: 30, y: 29, orientation: Direction.Down }, // 2x2

  // ========== UNIVERSITY CAMPUS (x=0-15, y=0-15) ==========
  // Uses TileType.Grass for campus green
  // Roads at x=8-11 and y=8-11

  // Top-left quadrant (x=0-7, y=0-7)
  { buildingId: "internet-archive", x: 0, y: 0, orientation: Direction.Down }, // 6x6 (Library)
  { buildingId: "tree-1", x: 7, y: 0, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-2", x: 7, y: 2, orientation: Direction.Down }, // 1x1
  { buildingId: "fountain", x: 6, y: 4, orientation: Direction.Down }, // 2x2

  // Top-right quadrant (x=12-15, y=0-7)
  { buildingId: "private-school", x: 12, y: 0, orientation: Direction.Right }, // 3x6 (rotated)
  { buildingId: "tree-3", x: 15, y: 0, orientation: Direction.Down }, // 1x1

  // Bottom-left quadrant (x=0-7, y=12-15)
  { buildingId: "bookstore", x: 0, y: 12, orientation: Direction.Down }, // 4x4
  { buildingId: "modern-bench", x: 5, y: 12, orientation: Direction.Down }, // 1x1
  { buildingId: "modern-bench", x: 5, y: 14, orientation: Direction.Down }, // 1x1

  // Bottom-right quadrant (x=12-15, y=12-15)
  { buildingId: "80s-apartment", x: 12, y: 12, orientation: Direction.Down }, // 3x3 (Student housing)
  { buildingId: "tree-4", x: 15, y: 15, orientation: Direction.Down }, // 1x1

  // ========== CENTRAL PARK (x=36-47, y=0-15) ==========
  // Uses TileType.Grass for park green
  // Road at x=40-43

  // Left side of park (x=36-39, y=0-15)
  { buildingId: "fountain", x: 36, y: 2, orientation: Direction.Down }, // 2x2
  { buildingId: "tree-1", x: 36, y: 5, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-2", x: 38, y: 5, orientation: Direction.Down }, // 1x1
  { buildingId: "victorian-bench", x: 36, y: 7, orientation: Direction.Down }, // 1x1
  { buildingId: "victorian-bench", x: 38, y: 7, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-3", x: 36, y: 10, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-4", x: 38, y: 10, orientation: Direction.Down }, // 1x1
  { buildingId: "park-table", x: 36, y: 12, orientation: Direction.Down }, // 1x1
  { buildingId: "park-table", x: 38, y: 12, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-1", x: 36, y: 14, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-2", x: 38, y: 14, orientation: Direction.Down }, // 1x1

  // Right side of park (x=44-47, y=0-15)
  { buildingId: "tree-3", x: 44, y: 0, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-4", x: 46, y: 0, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-1", x: 44, y: 3, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-2", x: 46, y: 3, orientation: Direction.Down }, // 1x1
  { buildingId: "statue", x: 45, y: 6, orientation: Direction.Down }, // 1x2
  { buildingId: "tree-3", x: 44, y: 9, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-4", x: 46, y: 9, orientation: Direction.Down }, // 1x1
  { buildingId: "victorian-bench", x: 44, y: 12, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-1", x: 46, y: 12, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-2", x: 44, y: 14, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-3", x: 46, y: 14, orientation: Direction.Down }, // 1x1

  // ========== STADIUM AREA (x=0-15, y=36-47) ==========
  // Uses TileType.Asphalt for parking lot feel
  // Road at x=8-11 (vertical only)

  // Main stadium building (left side, x=0-5, y=36-43)
  { buildingId: "schwab-mansion", x: 0, y: 36, orientation: Direction.Down }, // 6x8 (Stadium)

  // Bottom left area (x=0-7, y=44-47)
  { buildingId: "bus-shelter", x: 0, y: 44, orientation: Direction.Down }, // 2x1
  { buildingId: "bus-shelter", x: 0, y: 46, orientation: Direction.Down }, // 2x1
  { buildingId: "bus-shelter", x: 4, y: 44, orientation: Direction.Down }, // 2x1
  { buildingId: "bus-shelter", x: 4, y: 46, orientation: Direction.Down }, // 2x1

  // Right side food vendors (x=12-15, y=36-47)
  { buildingId: "checkers", x: 12, y: 36, orientation: Direction.Down }, // 2x2 (Food vendor)
  { buildingId: "martini-bar", x: 14, y: 36, orientation: Direction.Down }, // 2x2
  { buildingId: "dunkin", x: 12, y: 38, orientation: Direction.Down }, // 2x2
  { buildingId: "popeyes", x: 14, y: 38, orientation: Direction.Down }, // 2x2
  { buildingId: "checkers", x: 12, y: 44, orientation: Direction.Down }, // 2x2
  { buildingId: "dunkin", x: 14, y: 44, orientation: Direction.Down }, // 2x2
  { buildingId: "popeyes", x: 12, y: 46, orientation: Direction.Down }, // 2x2
  { buildingId: "martini-bar", x: 14, y: 46, orientation: Direction.Down }, // 2x2

  // ========== RESIDENTIAL AREA (x=36-47, y=36-47) ==========
  // Uses TileType.Grass for suburban feel
  // Road at x=40-43 and y=40-43

  // Top-left quadrant (x=36-39, y=36-39)
  { buildingId: "sf-victorian", x: 36, y: 36, orientation: Direction.Down }, // 2x3
  { buildingId: "full-house", x: 38, y: 36, orientation: Direction.Down }, // 2x3

  // Top-right quadrant (x=44-47, y=36-39)
  { buildingId: "blue-painted-lady", x: 44, y: 36, orientation: Direction.Down }, // 2x3
  { buildingId: "sf-victorian-2", x: 46, y: 36, orientation: Direction.Down }, // 2x3

  // Bottom-left quadrant (x=36-39, y=44-47)
  { buildingId: "english-townhouse", x: 36, y: 44, orientation: Direction.Down }, // 2x2
  { buildingId: "yellow-apartments", x: 38, y: 44, orientation: Direction.Down }, // 2x2
  { buildingId: "tree-1", x: 36, y: 46, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-2", x: 39, y: 46, orientation: Direction.Down }, // 1x1

  // Bottom-right quadrant (x=44-47, y=44-47)
  { buildingId: "limestone", x: 44, y: 44, orientation: Direction.Down }, // 2x2
  { buildingId: "strange-townhouse", x: 46, y: 44, orientation: Direction.Down }, // 2x2
  { buildingId: "tree-3", x: 44, y: 46, orientation: Direction.Down }, // 1x1
  { buildingId: "tree-4", x: 47, y: 46, orientation: Direction.Down }, // 1x1
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

  // Apply zone-specific ground tiles
  for (const zone of ZONES) {
    const { bounds, tileType } = zone;
    for (let dy = 0; dy < bounds.height; dy++) {
      for (let dx = 0; dx < bounds.width; dx++) {
        const px = bounds.x + dx;
        const py = bounds.y + dy;
        if (px < GRID_WIDTH && py < GRID_HEIGHT) {
          grid[py][px].type = tileType;
        }
      }
    }
  }

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

    // Calculate origin (buildings are placed by their top-left corner)
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
            // Decorations can go on grass, tile, asphalt, or snow
            if (
              cell.type !== TileType.Grass &&
              cell.type !== TileType.Tile &&
              cell.type !== TileType.Asphalt &&
              cell.type !== TileType.Snow
            ) {
              canPlace = false;
            }
          } else {
            // Regular buildings can go on grass, tile, or asphalt (zone ground types)
            if (
              cell.type !== TileType.Grass &&
              cell.type !== TileType.Tile &&
              cell.type !== TileType.Asphalt
            ) {
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
