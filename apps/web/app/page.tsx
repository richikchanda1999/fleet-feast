"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { initInitGetOptions } from "@/lib/api/@tanstack/react-query.gen";
import { createFleetFeastCity } from "./data/fleetFeastCity";
import Dashboard from "./components/Dashboard";
import { useMemo } from "react";

// GameBoard includes Phaser which needs browser APIs - must load dynamically
const GameBoard = dynamic(() => import("pogicity").then((m) => m.GameBoard), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-white text-lg">Loading Fleet Feast City...</div>
  ),
});

export default function Home() {
  const { data, isLoading, error } = useQuery(initInitGetOptions());

  const initialGrid = useMemo(() => {
    if (!data?.city) return undefined;
    return () => createFleetFeastCity(data.city);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-800 text-white text-lg">
        Loading game data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-800 text-red-500 text-lg">
        Error loading game data: {error.message}
      </div>
    );
  }

  if (!initialGrid) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-800 text-white text-lg">
        No city data available
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen">
      <div className="w-3/4 h-full">
        <GameBoard
          initialGrid={initialGrid}
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
        {data && <Dashboard gameState={data.gameState} />}
      </div>
    </div>
  );
}
