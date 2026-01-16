"use client";

import dynamic from "next/dynamic";
import { createFleetFeastCity } from "./data/fleetFeastCity";

// GameBoard includes Phaser which needs browser APIs - must load dynamically
const GameBoard = dynamic(() => import("pogicity").then((m) => m.GameBoard), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-white text-lg">
      Loading Fleet Feast City...
    </div>
  ),
});

export default function Home() {
  return (
    <div className="h-screen w-screen">
      <GameBoard initialGrid={createFleetFeastCity} />
    </div>
  );
}