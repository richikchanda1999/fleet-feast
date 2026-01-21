/**
 * Fleet Feast City Configuration
 *
 * Defines the city layout based on backend zone structure from apps/api/models/state.py
 * Travel costs determine zone adjacency:
 * - downtown-1 ↔ university-1: 10 min (adjacent)
 * - downtown-1 ↔ park-1: 15 min (one zone away)
 * - downtown-1 ↔ residential-1: 30 min (far corners)
 * - university-1 ↔ residential-1: 15 min (one zone away)
 * - park-1 ↔ residential-1: 10 min (adjacent)
 * - park-1 ↔ stadium-1: 20 min (stadium is isolated)
 *
 * Parking spots per zone (from backend):
 * - downtown-1: 2
 * - university-1: 1
 * - park-1: 1
 * - residential-1: 2
 * - stadium-1: 1
 */

import { TileType, GridCell, ZoneConfig, Direction, GRID_WIDTH, GRID_HEIGHT } from "pogicity/types";
import { ROAD_SEGMENT_SIZE, getRoadConnections, getSegmentType, generateRoadPattern } from "pogicity/roadUtils";
import { getBuilding, getBuildingFootprint } from "pogicity/buildings";
import { PriorityQueue } from "@datastructures-js/priority-queue";

// Zone colors for boundary overlays (RGB format for Phaser)
const ZONE_COLORS = {
  downtown: 0xff4444, // Red - commercial/busy
  university: 0x4488ff, // Blue - academic
  park: 0x44ff44, // Green - nature
  residential: 0xffaa44, // Orange - housing
  stadium: 0xaa44ff, // Purple - sports/events
};

// Road segments connecting zones (origin coordinates, 4x4 segments)
const ROAD_SEGMENTS: Array<{ x: number; y: number }> = [
  // Horizontal road at y=20 connecting park to residential
  { x: 16, y: 20 },
  { x: 20, y: 20 },
  { x: 24, y: 20 },
  { x: 28, y: 20 },
  { x: 32, y: 20 },
  { x: 36, y: 20 },
  { x: 40, y: 20 },
  { x: 44, y: 20 },

  // Vertical road at x=12 connecting stadium to downtown
  { x: 12, y: 0 },
  { x: 12, y: 4 },
  { x: 12, y: 8 },
  { x: 12, y: 12 },
  { x: 12, y: 16 },
  { x: 12, y: 20 },
  { x: 12, y: 24 },
  { x: 12, y: 28 },
  { x: 12, y: 32 },
  { x: 12, y: 36 },
  { x: 12, y: 40 },
  { x: 12, y: 44 },

  // Vertical road at x=32 connecting residential/park to university
  { x: 32, y: 0 },
  { x: 32, y: 4 },
  { x: 32, y: 8 },
  { x: 32, y: 12 },
  { x: 32, y: 16 },
  { x: 32, y: 24 },
  { x: 32, y: 28 },
  { x: 32, y: 32 },
  { x: 32, y: 36 },
  { x: 32, y: 40 },
  { x: 32, y: 44 },

  // Horizontal road at y=24 connecting downtown to university area
  { x: 0, y: 24 },
  { x: 4, y: 24 },
  { x: 8, y: 24 },
  { x: 16, y: 24 },
  { x: 20, y: 24 },
  { x: 24, y: 24 },
  { x: 28, y: 24 },
  { x: 36, y: 24 },
  { x: 40, y: 24 },
  { x: 44, y: 24 },
];

// Building placements per zone
interface BuildingPlacement {
  buildingId: string;
  x: number; // Origin X (top-left of building footprint)
  y: number; // Origin Y
  orientation?: Direction;
}

const BUILDING_PLACEMENTS: Record<string, BuildingPlacement[]> = {
  "stadium-1": [
    // Stadium zone - sports/events area (small, mostly empty for events)
    { buildingId: "ice-skating-rink", x: 2, y: 2, orientation: Direction.Down },
  ],
  "park-1": [
    // Park zone - green space with trees and recreational buildings
    { buildingId: "fountain", x: 22, y: 8 },
    { buildingId: "tree-1", x: 18, y: 4 },
    { buildingId: "tree-2", x: 26, y: 4 },
    { buildingId: "tree-3", x: 18, y: 12 },
    { buildingId: "tree-4", x: 28, y: 12 },
    { buildingId: "park-table", x: 20, y: 6 },
    { buildingId: "park-table", x: 24, y: 6 },
    { buildingId: "victorian-bench", x: 21, y: 14, orientation: Direction.Down },
    { buildingId: "victorian-bench", x: 25, y: 14, orientation: Direction.Down },
    { buildingId: "flower-bush", x: 19, y: 2 },
    { buildingId: "flower-bush", x: 27, y: 2 },
  ],
  "residential-1": [
    // Residential zone - housing
    { buildingId: "sf-victorian", x: 40, y: 2, orientation: Direction.Left },
    { buildingId: "english-townhouse", x: 42, y: 8, orientation: Direction.Left },
    { buildingId: "brownstone", x: 40, y: 16, orientation: Direction.Left },
    { buildingId: "tree-1", x: 38, y: 1 },
    { buildingId: "flower-bush", x: 45, y: 5 },
  ],
  "downtown-1": [
    // Downtown zone - commercial/busy area
    { buildingId: "checkers", x: 2, y: 32, orientation: Direction.Down },
    { buildingId: "popeyes", x: 6, y: 32, orientation: Direction.Down },
    { buildingId: "dunkin", x: 2, y: 38, orientation: Direction.Down },
    { buildingId: "martini-bar", x: 6, y: 38, orientation: Direction.Down },
    { buildingId: "bookstore", x: 24, y: 32, orientation: Direction.Down },
    { buildingId: "80s-apartment", x: 2, y: 44, orientation: Direction.Up },
    { buildingId: "medium-apartments", x: 18, y: 40, orientation: Direction.Down },
    { buildingId: "bus-shelter", x: 10, y: 28 },
  ],
  "university-1": [
    // University zone - academic buildings
    { buildingId: "private-school", x: 45, y: 32, orientation: Direction.Left },
    { buildingId: "internet-archive", x: 42, y: 42, orientation: Direction.Left },
    { buildingId: "tree-2", x: 36, y: 30 },
    { buildingId: "tree-3", x: 36, y: 46 },
    { buildingId: "modern-bench", x: 38, y: 34, orientation: Direction.Down },
    { buildingId: "flower-bush", x: 42, y: 34 },
  ],
};

/**
 * Places a building on the grid
 */
function placeBuilding(grid: GridCell[][], placement: BuildingPlacement): void {
  const building = getBuilding(placement.buildingId);
  if (!building) {
    console.warn(`Building not found: ${placement.buildingId}`);
    return;
  }

  const orientation = placement.orientation ?? Direction.Down;
  const footprint = getBuildingFootprint(building, orientation);
  const originX = placement.x;
  const originY = placement.y;

  // Check bounds
  if (
    originX < 0 ||
    originY < 0 ||
    originX + footprint.width > GRID_WIDTH ||
    originY + footprint.height > GRID_HEIGHT
  ) {
    console.warn(`Building ${placement.buildingId} at (${originX}, ${originY}) is out of bounds`);
    return;
  }

  const isDecoration = building.category === "props" || building.isDecoration;

  // Place the building
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
          grid[py][px].buildingOrientation = orientation;
        }
      }
    }
  }
}

export class FleetFeastCity {
  readonly grid: GridCell[][];

  readonly ZONE_CONFIGS: ZoneConfig[] = [
    {
      id: "stadium-1",
      name: "Stadium",
      bounds: { x: 0, y: 0, width: 12, height: 16 },
      tileType: TileType.Asphalt,
      borderColor: ZONE_COLORS.stadium,
      parking_zones: [{ x: 14, y: 10 }],
    },
    {
      id: "park-1",
      name: "Park",
      bounds: { x: 16, y: 0, width: 20, height: 20 },
      tileType: TileType.Grass,
      borderColor: ZONE_COLORS.park,
      parking_zones: [{ x: 22, y: 22 }],
    },
    {
      id: "residential-1",
      name: "Residential",
      bounds: { x: 36, y: 0, width: 12, height: 24 },
      tileType: TileType.Tile,
      borderColor: ZONE_COLORS.residential,
      parking_zones: [
        { x: 34, y: 10 },
        { x: 38, y: 22 },
      ],
    },
    {
      id: "downtown-1",
      name: "Downtown",
      bounds: { x: 0, y: 24, width: 32, height: 24 },
      tileType: TileType.Asphalt,
      borderColor: ZONE_COLORS.downtown,
      parking_zones: [
        { x: 14, y: 30 },
        { x: 6, y: 26 },
      ],
    },
    {
      id: "university-1",
      name: "University",
      bounds: { x: 32, y: 28, width: 16, height: 20 },
      tileType: TileType.Tile,
      borderColor: ZONE_COLORS.university,
      parking_zones: [{ x: 34, y: 34 }],
    },
  ];

  constructor() {
    // Initialize grid with grass
    this.grid = Array.from({ length: GRID_HEIGHT }, (_, y) =>
      Array.from({ length: GRID_WIDTH }, (_, x) => ({
        type: TileType.Grass,
        x,
        y,
        isOrigin: true,
      })),
    );

    // Apply zone-specific ground tiles
    for (const zone of this.ZONE_CONFIGS) {
      const { bounds, tileType } = zone;
      for (let dy = 0; dy < bounds.height; dy++) {
        for (let dx = 0; dx < bounds.width; dx++) {
          const px = bounds.x + dx;
          const py = bounds.y + dy;
          if (px < GRID_WIDTH && py < GRID_HEIGHT) {
            this.grid[py][px].type = tileType;
          }
        }
      }
    }

    // Place road segments - first pass (mark as road)
    for (const seg of ROAD_SEGMENTS) {
      for (let dy = 0; dy < ROAD_SEGMENT_SIZE; dy++) {
        for (let dx = 0; dx < ROAD_SEGMENT_SIZE; dx++) {
          const px = seg.x + dx;
          const py = seg.y + dy;
          if (px < GRID_WIDTH && py < GRID_HEIGHT) {
            this.grid[py][px].isOrigin = dx === 0 && dy === 0;
            this.grid[py][px].originX = seg.x;
            this.grid[py][px].originY = seg.y;
            this.grid[py][px].type = TileType.Road;
          }
        }
      }
    }

    // Place road segments - second pass with proper patterns
    for (const seg of ROAD_SEGMENTS) {
      const connections = getRoadConnections(this.grid, seg.x, seg.y);
      const segmentType = getSegmentType(connections);
      const pattern = generateRoadPattern(segmentType);

      for (const tile of pattern) {
        const px = seg.x + tile.dx;
        const py = seg.y + tile.dy;
        if (px < GRID_WIDTH && py < GRID_HEIGHT) {
          this.grid[py][px].type = tile.type;
        }
      }
    }

    // Place buildings for each zone
    for (const zone of this.ZONE_CONFIGS) {
      const placements = BUILDING_PLACEMENTS[zone.id] || [];
      for (const placement of placements) {
        placeBuilding(this.grid, placement);
      }
    }
  }
}
