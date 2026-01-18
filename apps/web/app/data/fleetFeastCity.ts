/**
 * Fleet Feast City Grid Builder
 *
 * Creates the city grid from API data using pogicity rendering utilities.
 */

import {
  TileType as PogicityTileType,
  GridCell,
  Direction as PogicityDirection,
  GRID_WIDTH,
  GRID_HEIGHT,
} from "pogicity/types";
import {
  ROAD_SEGMENT_SIZE,
  getRoadConnections,
  getSegmentType,
  generateRoadPattern,
} from "pogicity/roadUtils";
import { getBuilding, getBuildingFootprint } from "pogicity/buildings";

import {
  CityStructure,
  TileType as ApiTileType,
  Direction as ApiDirection,
} from "@/lib/api/types.gen";

/**
 * Maps API TileType to Pogicity TileType
 */
function mapTileType(apiTileType: ApiTileType): PogicityTileType {
  const mapping: Record<ApiTileType, PogicityTileType> = {
    [ApiTileType.GRASS]: PogicityTileType.Grass,
    [ApiTileType.TILE]: PogicityTileType.Tile,
    [ApiTileType.ASPHALT]: PogicityTileType.Asphalt,
    [ApiTileType.ROAD]: PogicityTileType.Road,
    [ApiTileType.BUILDING]: PogicityTileType.Building,
    [ApiTileType.SNOW]: PogicityTileType.Snow,
  };
  return mapping[apiTileType];
}

/**
 * Maps API Direction to Pogicity Direction
 */
function mapDirection(apiDirection: ApiDirection): PogicityDirection {
  const mapping: Record<ApiDirection, PogicityDirection> = {
    [ApiDirection.UP]: PogicityDirection.Up,
    [ApiDirection.DOWN]: PogicityDirection.Down,
    [ApiDirection.LEFT]: PogicityDirection.Left,
    [ApiDirection.RIGHT]: PogicityDirection.Right,
  };
  return mapping[apiDirection];
}

/**
 * Creates the city grid from API data.
 */
export function createFleetFeastCity(cityData: CityStructure): GridCell[][] {
  const { zones, roadSegments, buildingPlacements } = cityData;

  // Initialize empty grid with grass
  const grid: GridCell[][] = Array.from({ length: GRID_HEIGHT }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => ({
      type: PogicityTileType.Grass,
      x,
      y,
      isOrigin: true,
    }))
  );

  // Apply zone-specific ground tiles
  for (const zone of zones) {
    const { bounds, tileType } = zone;
    const pogicityTileType = mapTileType(tileType);
    for (let dy = 0; dy < bounds.height; dy++) {
      for (let dx = 0; dx < bounds.width; dx++) {
        const px = bounds.x + dx;
        const py = bounds.y + dy;
        if (px < GRID_WIDTH && py < GRID_HEIGHT) {
          grid[py][px].type = pogicityTileType;
        }
      }
    }
  }

  // Place road segments - first pass
  for (const seg of roadSegments) {
    for (let dy = 0; dy < ROAD_SEGMENT_SIZE; dy++) {
      for (let dx = 0; dx < ROAD_SEGMENT_SIZE; dx++) {
        const px = seg.x + dx;
        const py = seg.y + dy;
        if (px < GRID_WIDTH && py < GRID_HEIGHT) {
          grid[py][px].isOrigin = dx === 0 && dy === 0;
          grid[py][px].originX = seg.x;
          grid[py][px].originY = seg.y;
          grid[py][px].type = PogicityTileType.Road;
        }
      }
    }
  }

  // Place road segments - second pass with proper patterns
  for (const seg of roadSegments) {
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
  for (const placement of buildingPlacements) {
    const building = getBuilding(placement.buildingId);
    if (!building) {
      console.warn(`Building not found: ${placement.buildingId}`);
      continue;
    }

    const pogicityOrientation = mapDirection(placement.orientation);
    const footprint = getBuildingFootprint(building, pogicityOrientation);
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
          const validTypes = isDecoration
            ? [PogicityTileType.Grass, PogicityTileType.Tile, PogicityTileType.Asphalt, PogicityTileType.Snow]
            : [PogicityTileType.Grass, PogicityTileType.Tile, PogicityTileType.Asphalt];
          if (!validTypes.includes(cell.type)) {
            canPlace = false;
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
          grid[py][px].type = PogicityTileType.Building;
          grid[py][px].buildingId = placement.buildingId;
          grid[py][px].isOrigin = dx === 0 && dy === 0;
          grid[py][px].originX = originX;
          grid[py][px].originY = originY;
          if (isDecoration) {
            grid[py][px].underlyingTileType = underlyingType;
          }
          if (building.supportsRotation) {
            grid[py][px].buildingOrientation = pogicityOrientation;
          }
        }
      }
    }
  }

  return grid;
}
