"use client";

import dynamic from "next/dynamic";
import Dashboard from "./components/Dashboard";
import { useGameState } from "./hooks/useGameState";
import { useGameStore } from "@/lib/game-store-provider";

// GameBoard includes Phaser which needs browser APIs - must load dynamically
const GameBoard = dynamic(() => import("pogicity").then((m) => m.GameBoard), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-white text-lg">Loading Fleet Feast City...</div>
  ),
});

export default function Home() {
  const { isConnected, error } = useGameState();
  const { city, trucks, currentTime } = useGameStore((state) => state);

  const truckStates = trucks
    .filter((truck) => truck.status !== undefined)
    .map((truck) => ({
      id: truck.id,
      status: truck.status!, // Safe due to filter above
      current_zone: truck.current_zone,
      destination_zone: truck.destination_zone,
      arrival_time: truck.arrival_time,
    }));

  return (
    <div className="flex h-screen w-screen">
      <div className="w-3/4 h-full">
        {city && (
          <GameBoard
            initialGrid={city.grid}
            zones={city.ZONE_CONFIGS}
            trucks={truckStates}
            currentTime={currentTime}
            handleBuildingClick={(
              buildingId: string | null,
              originX: number,
              originY: number,
              screenX: number,
              screenY: number,
            ) => {
              if (buildingId) {
                console.log("Building clicked:", buildingId, originX, originY, screenX, screenY);
              }
            }}
            handleCarClick={(carId: string) => {
              console.log("Car clicked:", carId);
            }}
          />
        )}
      </div>
      <div className="w-1/4 h-full p-4 overflow-y-auto">
        <Dashboard isConnected={isConnected} error={error} />
      </div>
    </div>
  );
}
