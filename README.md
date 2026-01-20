# Fleet Feast

An AI-coordinated food truck logistics simulation. This project demonstrates how a large language model can make real-time strategic decisions to manage a fleet of food trucks across a dynamic city environment.

The core idea: drop an LLM into a simulated city with three food trucks, varying customer demand across five zones, and see if it can figure out how to maximize revenue.

## What This Actually Is

Fleet Feast is a game simulation with two main parts:

1. **A Python backend** that runs the city simulation - updating demand curves, processing truck movements, handling inventory and sales, and asking an LLM what to do every 30 seconds.

2. **A Next.js frontend** that renders an isometric city view with real-time updates, showing trucks moving between zones, demand levels changing, and a dashboard displaying the AI's decisions.

The LLM (running locally via Ollama) has access to four tools: dispatch trucks to new zones, restock inventory, query demand forecasts, and hold position. It receives the full game state and decides what action to take based on current demand, truck positions, inventory levels, and time of day.

## Project Structure

This is a Bun monorepo with three main pieces:

```
fleet-feast/
├── apps/
│   ├── api/                 # Python FastAPI backend
│   └── web/                 # Next.js frontend
├── packages/
│   └── pogicity-demo/       # Isometric game engine (Phaser 3)
├── docker-compose.yaml      # Redis for state management
└── package.json             # Workspace config
```

---

## The API (Backend)

The backend lives in `apps/api/` and is built with FastAPI, Redis, and Ollama.

### Endpoints

| Endpoint | Method | What It Does |
|----------|--------|--------------|
| `/get_state` | GET | Returns the current game state as JSON |
| `/events` | GET | Server-sent events stream - one update per game tick |
| `/health` | GET | Health check (verifies Redis connection) |

### How The Simulation Works

**Game Loop** (`simulation/game_loop.py`)

The game runs at 1 tick per second, where each tick represents 1 minute of in-game time. Every tick:

- Demand curves update for all zones based on time-of-day
- Trucks in transit continue moving toward their destination
- Trucks that arrive at a zone start serving
- Serving trucks deplete inventory and earn revenue based on local demand
- Trucks with empty inventory automatically head back to restock

The day is 1440 ticks (24 hours), then it loops.

**Agent Decision Loop** (`simulation/agent_decision_loop.py`)

Every 30 seconds, a separate loop sends the game state to the LLM with a structured prompt explaining the situation. The LLM can use these tools:

- `dispatch_truck` - Send a truck to a different zone
- `restock_inventory` - Refill a truck's supplies (costs money)
- `get_zone_forecast` - Ask for demand predictions for a zone
- `hold_position` - Explicitly do nothing

The prompt includes priorities (serve high-demand zones, don't let trucks run empty, etc.) and the LLM's responses are queued in Redis for the game loop to process.

### Data Models

**Zones** - There are 5 zones: Downtown, University, Park, Residential, and Stadium. Each has:
- Base demand multiplier
- Peak hours (time ranges when demand spikes)
- Travel costs to other zones
- Parking capacity

Demand is generated using Gaussian curves centered on peak hours with added noise for realism.

**Trucks** - Three trucks with different characteristics:
- Status (IDLE, SERVING, MOVING, RESTOCKING)
- Inventory level and max capacity
- Speed multiplier (affects travel time)
- Accumulated revenue
- Restocking costs (fixed fee + per-unit cost)

### Running The Backend

Prerequisites:
- Python 3.12+
- Redis (use the included docker-compose)
- Ollama with a model installed (the code uses `qwen3-coder:30b` but you can change this)

```bash
# Start Redis
docker-compose up -d

# Set up Python environment
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Create .env file
cat > .env << EOF
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password
GAME_STATE_KEY=game_state
PENDING_ACTIONS_QUEUE=pending_actions
EOF

# Run the server
fastapi run main.py
```

The API will be available at `http://localhost:8000`. You can check the OpenAPI docs at `/docs`.

---

## The Frontend (Web)

The frontend lives in `apps/web/` and is built with Next.js 16, React 19, and Phaser 3 for the game rendering.

### Layout

The main page (`app/page.tsx`) splits into:
- **Left side (75%)** - The isometric city view rendered by Phaser
- **Right side (25%)** - A dashboard showing zone demand, fleet status, and AI decisions

### Key Components

**Dashboard** (`app/components/Dashboard.tsx`)

The command center UI with three sections:

1. **Zone Demand** - Bar graphs showing current demand for each zone with trend indicators (up/down/stable arrows)
2. **Fleet Status** - Each truck's location, inventory level (with color-coded progress bars), current status, and accumulated revenue
3. **Recent Decisions** - A log of what the AI decided to do and why

The whole thing has a retro Win95 aesthetic with beveled borders and monospace fonts.

**Game Board** (`packages/pogicity-demo`)

This is actually a separate package in the monorepo - a reusable isometric city engine built on Phaser 3. It handles:
- Rendering the 48x48 tile grid
- Drawing buildings, roads, and zones
- Animating truck movement along paths
- Depth sorting so things overlap correctly

The city layout is defined in `app/data/fleetFeastCity.ts` which specifies where each zone is, what buildings go where, and how roads connect everything.

### Data Flow

1. The frontend opens an EventSource connection to `/events`
2. The backend streams game state as server-sent events (one per tick)
3. `useGameState.ts` parses these events and updates local state
4. The dashboard re-renders with new demand/truck data
5. The Phaser game updates truck positions on the map

If the connection drops, it auto-reconnects after 3 seconds.

### Running The Frontend

Prerequisites:
- Bun (or npm/yarn/pnpm)
- Node.js 18+
- The backend running

```bash
cd apps/web
bun install

# Point to your running backend
export NEXT_PUBLIC_API_URL=http://localhost:8000

bun run dev
```

Open `http://localhost:3000` and you should see the city with trucks moving around.

---

## Getting Started From Scratch

Here's the full sequence to get everything running:

### 1. Clone and install dependencies

```bash
git clone <repo-url> fleet-feast
cd fleet-feast
bun install
```

### 2. Start Redis

```bash
docker-compose up -d
```

### 3. Set up Ollama

Install Ollama from [ollama.ai](https://ollama.ai), then pull a model:

```bash
ollama pull qwen3-coder:30b
```

You can use a different model by editing `apps/api/simulation/agent_decision_loop.py` - just change the model name in the `chat()` call. Smaller models work too but make worse decisions.

### 4. Start the backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .

# Create .env
echo "REDIS_HOST=localhost" > .env
echo "REDIS_PORT=6379" >> .env
echo "REDIS_PASSWORD=password" >> .env
echo "GAME_STATE_KEY=game_state" >> .env
echo "PENDING_ACTIONS_QUEUE=pending_actions" >> .env

python main.py
```

### 5. Start the frontend

In a new terminal:

```bash
cd apps/web
export NEXT_PUBLIC_API_URL=http://localhost:8000
bun run dev
```

### 6. Watch it run

Open `http://localhost:3000`. You'll see the isometric city with three food trucks. The dashboard on the right shows:
- Current demand levels for each zone
- Where each truck is and how much inventory they have
- What decisions the AI is making

Give it a few minutes to warm up. The LLM needs to observe demand patterns before it starts making smart decisions.

---

## How The AI Makes Decisions

The LLM receives a prompt that includes:

1. Current time (so it knows if it's rush hour, lunch time, etc.)
2. Demand levels for all zones
3. Each truck's location, inventory, status, and revenue
4. Travel times between zones
5. A list of priorities to follow

The priorities tell it things like:
- Trucks with low inventory should restock soon
- Don't send a truck somewhere if demand is lower than where it already is
- Consider travel time - a truck that takes 20 minutes to arrive might miss the demand peak

Every 30 seconds it picks an action (or explicitly chooses to wait). The decision and reasoning get logged to the dashboard so you can see what it's thinking.

---

## Customization

**Change the city layout** - Edit `apps/web/app/data/fleetFeastCity.ts` to add buildings, modify zones, or rearrange roads.

**Adjust game speed** - In `apps/api/simulation/game_loop.py`, change the tick interval (default 1 second).

**Use a different LLM** - Edit `apps/api/simulation/agent_decision_loop.py` to use any Ollama-compatible model.

**Tweak demand curves** - Zone peak hours and demand multipliers are defined in `apps/api/models/zone.py`.

---

## Tech Stack

**Backend:**
- FastAPI (async Python web framework)
- Redis (state management and pub/sub)
- Ollama (local LLM inference)
- Pydantic (data validation)
- NumPy (demand curve calculations)

**Frontend:**
- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS
- TanStack Query
- Zustand (state management)
- Phaser 3 (game engine)

---

## License

MIT
