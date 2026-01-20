"use client";

import dynamic from "next/dynamic";
import Dashboard from "./components/Dashboard";
import { useGameState } from "./hooks/useGameState";
import { createFleetFeastCity, FLEET_FEAST_ZONES } from "./data/fleetFeastCity";

// GameBoard includes Phaser which needs browser APIs - must load dynamically
const GameBoard = dynamic(() => import("pogicity").then((m) => m.GameBoard), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-white text-lg">Loading Fleet Feast City...</div>
  ),
});

export default function Home() {
  const { gameState, isConnected, error, reconnect } = useGameState();

  return (
    <div className="flex h-screen w-screen">
      <div className="w-3/4 h-full">
        <GameBoard
          initialGrid={createFleetFeastCity}
          zones={FLEET_FEAST_ZONES}
          handleBuildingClick={(buildingId: string | null, originX: number, originY: number, screenX: number, screenY: number) => {
            if (buildingId) {
              console.log("Building clicked:", buildingId, originX, originY, screenX, screenY);
            }
          }}
          handleCarClick={(carId: string) => {
            console.log("Car clicked:", carId);
          }}
        />
      </div>
      <div className="w-1/4 h-full p-4 overflow-y-auto">
        <Dashboard
          gameState={gameState}
          isConnected={isConnected}
          error={error}
          onReconnect={reconnect}
        />
      </div>
    </div>
  );
}
