"use client";

import dynamic from "next/dynamic";
import { createFleetFeastCity } from "./data/fleetFeastCity";
import Dashboard from "./components/Dashboard";

// GameBoard includes Phaser which needs browser APIs - must load dynamically
const GameBoard = dynamic(() => import("pogicity").then((m) => m.GameBoard), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-white text-lg">Loading Fleet Feast City...</div>
  ),
});

export default function Home() {
  return (
    <div className="flex h-screen w-screen">
      <div className="w-3/4 h-full">
        <GameBoard
          initialGrid={createFleetFeastCity}
          handleBuildingClick={(buildingId: string | null, originX: number, originY: number, screenX: number, screenY: number) => {
            if (buildingId) {
              console.log("Building with : {} clicked", buildingId, originX, originY, screenX, screenY);
            }
          }}
          handleCarClick={(carId: string) => {
            console.log("Car with : {} clicked", carId);
          }}
        />
      </div>
      <div className="w-1/4 h-full p-4 overflow-y-auto">
        <Dashboard />
      </div>
    </div>
  );
}
