interface ZoneDemand {
  id: string;
  name: string;
  demand: number; // 0-100
  trend: "up" | "down" | "stable";
}

interface FleetVehicle {
  id: string;
  name: string;
  status: "idle" | "en-route" | "delivering" | "returning";
  currentZone?: string;
  destination?: string;
}

interface Decision {
  id: string;
  timestamp: Date;
  type: "dispatch" | "reroute" | "wait";
  description: string;
}

// Mock data - replace with real data from props/state
const mockZones: ZoneDemand[] = [
  { id: "zone-1", name: "Downtown", demand: 85, trend: "up" },
  { id: "zone-2", name: "Suburbs", demand: 45, trend: "stable" },
  { id: "zone-3", name: "Industrial", demand: 30, trend: "down" },
  { id: "zone-4", name: "Harbor", demand: 60, trend: "up" },
];

const mockFleet: FleetVehicle[] = [
  { id: "car-1", name: "Taxi #1", status: "delivering", currentZone: "Downtown", destination: "Suburbs" },
  { id: "car-2", name: "Taxi #2", status: "idle", currentZone: "Harbor" },
  { id: "car-3", name: "Jeep #1", status: "en-route", currentZone: "Industrial", destination: "Downtown" },
];

const mockDecisions: Decision[] = [
  { id: "d-1", timestamp: new Date(), type: "dispatch", description: "Dispatched Taxi #1 to Downtown" },
  { id: "d-2", timestamp: new Date(Date.now() - 30000), type: "reroute", description: "Rerouted Jeep #1 via Harbor" },
  { id: "d-3", timestamp: new Date(Date.now() - 60000), type: "wait", description: "Taxi #2 waiting for demand" },
];

const panelStyle: React.CSSProperties = {
  background: "#B0B0B0",
  border: "2px solid",
  borderColor: "#D0D0D0 #707070 #707070 #D0D0D0",
  boxShadow: "2px 2px 0px #505050",
  padding: 0,
  marginBottom: 12,
};

const headerStyle: React.CSSProperties = {
  background: "linear-gradient(to bottom, #4a6fa5, #2d4a6f)",
  color: "#fff",
  padding: "6px 10px",
  fontFamily: "monospace",
  fontSize: 13,
  fontWeight: "bold",
  textShadow: "1px 1px 0px #000",
  borderBottom: "2px solid #2d4a6f",
  textTransform: "uppercase",
  letterSpacing: 1,
};

const contentStyle: React.CSSProperties = {
  padding: 8,
  fontFamily: "monospace",
  fontSize: 11,
};

function DemandBar({ demand, trend }: { demand: number; trend: "up" | "down" | "stable" }) {
  const barColor = demand > 70 ? "#c44" : demand > 40 ? "#ca4" : "#4a4";
  const trendIcon = trend === "up" ? "▲" : trend === "down" ? "▼" : "●";
  const trendColor = trend === "up" ? "#4c4" : trend === "down" ? "#c44" : "#888";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          flex: 1,
          height: 12,
          background: "#606060",
          border: "1px solid",
          borderColor: "#404040 #808080 #808080 #404040",
        }}
      >
        <div
          style={{
            width: `${demand}%`,
            height: "100%",
            background: barColor,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ color: trendColor, fontSize: 10 }}>{trendIcon}</span>
      <span style={{ width: 28, textAlign: "right", color: "#333" }}>{demand}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: FleetVehicle["status"] }) {
  const colors: Record<FleetVehicle["status"], { bg: string; text: string }> = {
    idle: { bg: "#888", text: "#fff" },
    "en-route": { bg: "#4a7fc4", text: "#fff" },
    delivering: { bg: "#4a4", text: "#fff" },
    returning: { bg: "#ca4", text: "#333" },
  };

  const { bg, text } = colors[status];

  return (
    <span
      style={{
        background: bg,
        color: text,
        padding: "2px 6px",
        fontSize: 9,
        fontWeight: "bold",
        textTransform: "uppercase",
        border: "1px solid",
        borderColor: "#fff3 #0003 #0003 #fff3",
      }}
    >
      {status}
    </span>
  );
}

function DecisionIcon({ type }: { type: Decision["type"] }) {
  const icons: Record<Decision["type"], { symbol: string; color: string }> = {
    dispatch: { symbol: "→", color: "#4a4" },
    reroute: { symbol: "↻", color: "#ca4" },
    wait: { symbol: "◼", color: "#888" },
  };

  const { symbol, color } = icons[type];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        background: color,
        color: "#fff",
        fontWeight: "bold",
        fontSize: 12,
        border: "1px solid",
        borderColor: "#fff3 #0003 #0003 #fff3",
      }}
    >
      {symbol}
    </span>
  );
}

export default function Dashboard() {
  return (
    <div
      style={{
        height: "100%",
        background: "#4a5d6a",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 0,
        fontFamily: "monospace",
      }}
    >
      {/* Title */}
      <div
        style={{
          ...panelStyle,
          background: "linear-gradient(to bottom, #3a4a5a, #2a3a4a)",
          padding: "10px 12px",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "bold",
            textShadow: "2px 2px 0px #000",
            margin: 0,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Fleet Command
        </h1>
      </div>

      {/* Zone Demand Section */}
      <div style={panelStyle}>
        <div style={headerStyle}>Zone Demand</div>
        <div style={contentStyle}>
          {mockZones.map((zone) => (
            <div key={zone.id} style={{ marginBottom: 8 }}>
              <div style={{ color: "#333", marginBottom: 2 }}>{zone.name}</div>
              <DemandBar demand={zone.demand} trend={zone.trend} />
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Status Section */}
      <div style={panelStyle}>
        <div style={headerStyle}>Fleet Status</div>
        <div style={contentStyle}>
          {mockFleet.map((vehicle) => (
            <div
              key={vehicle.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid #999",
              }}
            >
              <span style={{ flex: 1, color: "#333", fontWeight: "bold" }}>{vehicle.name}</span>
              <StatusBadge status={vehicle.status} />
            </div>
          ))}
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              background: "#9a9a9a",
              border: "1px solid",
              borderColor: "#808080 #c0c0c0 #c0c0c0 #808080",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#333" }}>
              <span>Active:</span>
              <span style={{ fontWeight: "bold" }}>
                {mockFleet.filter((v) => v.status !== "idle").length}/{mockFleet.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Decisions Section */}
      <div style={{ ...panelStyle, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={headerStyle}>Recent Decisions</div>
        <div style={{ ...contentStyle, flex: 1, overflowY: "auto" }}>
          {mockDecisions.map((decision) => (
            <div
              key={decision.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid #999",
              }}
            >
              <DecisionIcon type={decision.type} />
              <div style={{ flex: 1 }}>
                <div style={{ color: "#333", fontSize: 10 }}>{decision.description}</div>
                <div style={{ color: "#666", fontSize: 9 }}>
                  {decision.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}