"use client";

import { useGameStore } from "@/lib/game-store-provider";
import { DemandTrend, DecisionType } from "../../lib/types";
import { TruckStatus } from "@/lib/api";
import { formatPeakHour } from "@/lib/utils";

interface DashboardProps {
  isConnected: boolean;
  error: Error | null;
}

/**
 * Calculate demand trend by comparing recent demand values
 */
export function calculateTrend(demandArray: number[]): DemandTrend {
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

function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2.5 bg-neutral-600 border border-t-neutral-700 border-l-neutral-700 border-b-neutral-400 border-r-neutral-400">
      <div className={`h-full transition-all duration-300 ${colorClass}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

function DemandBar({ demand, trend }: { demand: number; trend: DemandTrend }) {
  const barColorClass = demand > 70 ? "bg-red-500" : demand > 40 ? "bg-yellow-500" : "bg-green-600";
  const trendIcon = trend === DemandTrend.UP ? "▲" : trend === DemandTrend.DOWN ? "▼" : "●";
  const trendColorClass =
    trend === DemandTrend.UP ? "text-green-500" : trend === DemandTrend.DOWN ? "text-red-500" : "text-gray-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-3 bg-neutral-600 border border-t-neutral-700 border-l-neutral-700 border-b-neutral-400 border-r-neutral-400">
        <div className={`h-full transition-all duration-300 ${barColorClass}`} style={{ width: `${demand}%` }} />
      </div>
      <span className={`text-[10px] ${trendColorClass}`}>{trendIcon}</span>
      <span className="w-7 text-right text-neutral-700 text-xs">{demand}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: TruckStatus }) {
  const colorClasses: Record<TruckStatus, string> = {
    [TruckStatus.IDLE]: "bg-gray-500 text-white",
    [TruckStatus.MOVING]: "bg-blue-500 text-white",
    [TruckStatus.SERVING]: "bg-green-600 text-white",
    [TruckStatus.RESTOCKING]: "bg-yellow-500 text-neutral-800",
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border border-t-white/20 border-l-white/20 border-b-black/20 border-r-black/20 ${colorClasses[status]}`}
    >
      {status}
    </span>
  );
}

function DecisionIcon({ type }: { type: DecisionType }) {
  const config: Record<DecisionType, { symbol: string; colorClass: string }> = {
    [DecisionType.DISPATCH]: { symbol: "→", colorClass: "bg-green-600" },
    [DecisionType.REROUTE]: { symbol: "↻", colorClass: "bg-yellow-500" },
    [DecisionType.WAIT]: { symbol: "◼", colorClass: "bg-gray-500" },
  };

  const { symbol, colorClass } = config[type];

  return (
    <span
      className={`inline-flex items-center justify-center w-4.5 h-4.5 text-white font-bold text-xs border border-t-white/20 border-l-white/20 border-b-black/20 border-r-black/20 ${colorClass}`}
    >
      {symbol}
    </span>
  );
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

export default function Dashboard({ isConnected, error }: DashboardProps) {
  const decisions = []; // TODO: Get LLM decisions from the backend

  const { currentTime, zones, trucks } = useGameStore((state) => state);

  return (
    <div className="h-full bg-slate-600 p-3 flex flex-col font-mono">
      {/* Title */}
      <div className="bg-linear-to-b from-slate-700 to-slate-800 border-2 border-t-neutral-300 border-l-neutral-300 border-b-neutral-500 border-r-neutral-500 shadow-md px-3 py-2.5 text-center mb-4">
        <h1 className="text-white text-base font-bold drop-shadow-[2px_2px_0px_#000] tracking-widest uppercase m-0">
          Fleet Command
        </h1>
        <div className="text-neutral-300 text-xs mt-1">{formatTime(currentTime)}</div>
      </div>

      {/* Connection Status */}
      <div
        className={`mb-3 px-2 py-1.5 text-xs text-center border-2 ${
          error
            ? "bg-red-600 text-white border-red-400"
            : isConnected
              ? "bg-green-600 text-white border-green-400"
              : "bg-yellow-500 text-neutral-800 border-yellow-400"
        }`}
      >
        {error ? (
          <div className="flex items-center justify-center gap-2">
            <span>Connection Error</span>
            {/* <button
              onClick={onReconnect}
              className="px-2 py-0.5 bg-white text-red-600 text-xs font-bold border border-white/50 hover:bg-red-100"
            >
              Retry
            </button> */}
          </div>
        ) : isConnected ? (
          "Connected"
        ) : (
          "Connecting..."
        )}
      </div>

      {/* Zone Demand Section */}
      <div className="bg-neutral-400 border-2 border-t-neutral-300 border-l-neutral-300 border-b-neutral-500 border-r-neutral-500 shadow-md mb-3">
        <div className="bg-linear-to-b from-blue-600 to-blue-800 text-white px-2.5 py-1.5 font-mono text-[13px] font-bold drop-shadow-[1px_1px_0px_#000] border-b-2 border-blue-800 uppercase tracking-wide">
          Zone Demand
        </div>
        <div className="p-2 font-mono text-[11px]">
          {zones.length > 0 ? (
            zones.map((zone) => {
              const demandArray = zone.demand ?? [];
              // Get the current demand value (last in the array)
              const currentDemand = demandArray.length > 0 ? demandArray[demandArray.length - 1] : 0;
              // Normalize to percentage (0-100), handle division by zero
              const demandPercentage =
                zone.max_orders > 0 ? Math.min(100, Math.round((currentDemand / zone.max_orders) * 100)) : 0;
              return (
                <div
                  key={zone.id}
                  className="mb-3 pb-2 border-b border-neutral-500 last:border-b-0 last:mb-0 last:pb-0"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-neutral-700 font-bold">{zone.id}</span>
                    <span className="text-neutral-600 text-[9px]">
                      {demandPercentage}/{zone.max_orders} orders
                    </span>
                  </div>
                  <DemandBar demand={demandPercentage} trend={calculateTrend(zone.demand ?? [])} />
                  <div className="flex justify-between mt-1 text-[9px] text-neutral-600">
                    <span>Parking: {zone.num_of_parking_spots}</span>
                    <span>Peak: {zone.peak_hours.length > 0 ? zone.peak_hours.map(([start, end]) => formatPeakHour(start, end)).join(", ") : "None"}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-neutral-500 text-center py-2">No zone data</div>
          )}
        </div>
      </div>

      {/* Fleet Status Section */}
      <div className="bg-neutral-400 border-2 border-t-neutral-300 border-l-neutral-300 border-b-neutral-500 border-r-neutral-500 shadow-md mb-3">
        <div className="bg-linear-to-b from-blue-600 to-blue-800 text-white px-2.5 py-1.5 font-mono text-[13px] font-bold drop-shadow-[1px_1px_0px_#000] border-b-2 border-blue-800 uppercase tracking-wide">
          Fleet Status
        </div>
        <div className="p-2 font-mono text-[11px]">
          {trucks.length > 0 ? (
            <>
              {trucks.map((truck) => (
                <div key={truck.id} className="py-2 border-b border-neutral-500 last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-neutral-700 font-bold">{truck.id}</span>
                    {truck.status && <StatusBadge status={truck.status} />}
                  </div>
                  <div className="text-[9px] text-neutral-600 mb-1">
                    <span>Zone: {truck.current_zone}</span>
                    {truck.destination_zone && <span className="ml-2">→ {truck.destination_zone}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] text-neutral-600 w-12">Inventory:</span>
                    <ProgressBar
                      value={truck.inventory}
                      max={truck.max_inventory}
                      colorClass={truck.inventory < truck.max_inventory * 0.3 ? "bg-red-500" : "bg-blue-500"}
                    />
                    <span className="text-[9px] text-neutral-600 w-10 text-right">
                      {truck.inventory}/{truck.max_inventory}
                    </span>
                  </div>
                  <div className="text-[9px] text-neutral-600">
                    Revenue: <span className="text-green-700 font-bold">${truck.total_revenue?.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="mt-2 px-2 py-1.5 bg-neutral-500 border border-t-neutral-400 border-l-neutral-400 border-b-neutral-300 border-r-neutral-300">
                <div className="flex justify-between text-neutral-700 text-[10px]">
                  <span>Active:</span>
                  <span className="font-bold">
                    {trucks.filter((v) => v.status !== TruckStatus.IDLE).length}/{trucks.length}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-700 text-[10px] mt-1">
                  <span>Total Revenue:</span>
                  <span className="font-bold text-green-700">
                    ${trucks.reduce((sum, t) => sum + (t.total_revenue ?? 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-neutral-500 text-center py-2">No trucks deployed</div>
          )}
        </div>
      </div>

      {/* Decisions Section */}
      <div className="bg-neutral-400 border-2 border-t-neutral-300 border-l-neutral-300 border-b-neutral-500 border-r-neutral-500 shadow-md flex-1 flex flex-col min-h-0">
        <div className="bg-linear-to-b from-blue-600 to-blue-800 text-white px-2.5 py-1.5 font-mono text-[13px] font-bold drop-shadow-[1px_1px_0px_#000] border-b-2 border-blue-800 uppercase tracking-wide">
          Recent Decisions
        </div>
        {/* <div className="p-2 font-mono text-[11px] flex-1 overflow-y-auto">
          {decisions.length > 0 ? (
            decisions.map((decision) => (
              <div key={decision.id} className="flex items-start gap-2 py-1.5 border-b border-neutral-500">
                <DecisionIcon type={decision.type} />
                <div className="flex-1">
                  <div className="text-neutral-700 text-[10px]">{decision.description}</div>
                  <div className="text-neutral-500 text-[9px]">{new Date(decision.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-neutral-500 text-center py-2">No decisions yet</div>
          )}
        </div> */}
      </div>
    </div>
  );
}
