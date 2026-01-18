"use client";

import {
  DecisionType,
  DemandTrend,
  GameStateOutput,
  VehicleStatus,
} from "@/lib/api/types.gen";

interface DashboardProps {
  gameState: GameStateOutput;
}

function DemandBar({ demand, trend }: { demand: number; trend: DemandTrend }) {
  const barColorClass = demand > 70 ? "bg-red-500" : demand > 40 ? "bg-yellow-500" : "bg-green-600";
  const trendIcon = trend === DemandTrend.UP ? "▲" : trend === DemandTrend.DOWN ? "▼" : "●";
  const trendColorClass = trend === DemandTrend.UP ? "text-green-500" : trend === DemandTrend.DOWN ? "text-red-500" : "text-gray-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-3 bg-neutral-600 border border-t-neutral-700 border-l-neutral-700 border-b-neutral-400 border-r-neutral-400">
        <div
          className={`h-full transition-all duration-300 ${barColorClass}`}
          style={{ width: `${demand}%` }}
        />
      </div>
      <span className={`text-[10px] ${trendColorClass}`}>{trendIcon}</span>
      <span className="w-7 text-right text-neutral-700 text-xs">{demand}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: VehicleStatus }) {
  const colorClasses: Record<VehicleStatus, string> = {
    [VehicleStatus.IDLE]: "bg-gray-500 text-white",
    [VehicleStatus.EN_ROUTE]: "bg-blue-500 text-white",
    [VehicleStatus.DELIVERING]: "bg-green-600 text-white",
    [VehicleStatus.RETURNING]: "bg-yellow-500 text-neutral-800",
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

export default function Dashboard({ gameState }: DashboardProps) {
  const zoneDemands = gameState.zoneDemands ?? [];
  const trucks = gameState.trucks ?? [];
  const decisions = gameState.decisions ?? [];

  return (
    <div className="h-full bg-slate-600 p-3 flex flex-col font-mono">
      {/* Title */}
      <div className="bg-linear-to-b from-slate-700 to-slate-800 border-2 border-t-neutral-300 border-l-neutral-300 border-b-neutral-500 border-r-neutral-500 shadow-md px-3 py-2.5 text-center mb-4">
        <h1 className="text-white text-base font-bold drop-shadow-[2px_2px_0px_#000] tracking-widest uppercase m-0">
          Fleet Command
        </h1>
      </div>

      {/* Zone Demand Section */}
      <div className="bg-neutral-400 border-2 border-t-neutral-300 border-l-neutral-300 border-b-neutral-500 border-r-neutral-500 shadow-md mb-3">
        <div className="bg-linear-to-b from-blue-600 to-blue-800 text-white px-2.5 py-1.5 font-mono text-[13px] font-bold drop-shadow-[1px_1px_0px_#000] border-b-2 border-blue-800 uppercase tracking-wide">
          Zone Demand
        </div>
        <div className="p-2 font-mono text-[11px]">
          {zoneDemands.length > 0 ? (
            zoneDemands.map((zone) => (
              <div key={zone.id} className="mb-2">
                <div className="text-neutral-700 mb-0.5">{zone.name}</div>
                <DemandBar demand={zone.demand} trend={zone.trend} />
              </div>
            ))
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
              {trucks.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center gap-2 py-1.5 border-b border-neutral-500"
                >
                  <span className="flex-1 text-neutral-700 font-bold">{vehicle.name}</span>
                  <StatusBadge status={vehicle.status} />
                </div>
              ))}
              <div className="mt-2 px-2 py-1.5 bg-neutral-500 border border-t-neutral-400 border-l-neutral-400 border-b-neutral-300 border-r-neutral-300">
                <div className="flex justify-between text-neutral-700">
                  <span>Active:</span>
                  <span className="font-bold">
                    {trucks.filter((v) => v.status !== VehicleStatus.IDLE).length}/{trucks.length}
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
        <div className="p-2 font-mono text-[11px] flex-1 overflow-y-auto">
          {decisions.length > 0 ? (
            decisions.map((decision) => (
              <div
                key={decision.id}
                className="flex items-start gap-2 py-1.5 border-b border-neutral-500"
              >
                <DecisionIcon type={decision.type} />
                <div className="flex-1">
                  <div className="text-neutral-700 text-[10px]">{decision.description}</div>
                  <div className="text-neutral-500 text-[9px]">
                    {new Date(decision.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-neutral-500 text-center py-2">No decisions yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
