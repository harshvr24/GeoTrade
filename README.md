# GeoTrade + World Monitor Intelligence

Global intelligence dashboard merging real-time geopolitical news with AI-synthesized market impact analysis. GeoTrade tracks conflicts, sanctions, trade disruptions, and diplomatic events across 105 curated news sources, then surfaces trading signals, CII (Country Instability Index) scores, and anomaly alerts to decision-makers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
│  App.jsx                                                              │
│  ├── GlobeView.jsx       ── air/sea track overlays, convergence      │
│  ├── GeoMapView.jsx      ── CII choropleth, anomaly layers          │
│  ├── AISignalsView.jsx   ── focal point, anomaly, tier badges         │
│  ├── LiveFeedsView.jsx   ── tier filter, state-affiliated tags        │
│  ├── IntelligencePanel.jsx ── Brief / Focal Points / Anomalies / Gaps  │
│  └── WidgetBoard         ── BriefWidget, AnomalyWidget, CoverageWidget│
│                                registry.jsx                            │
└──────────┬──────────────────────────────────────┬───────────────────┘
           │  fetch() REST                           │ WebSocket v1/v2
           │                                          │
┌──────────▼──────────────────────────────────────▼───────────────────┐
│                       BACKEND (FastAPI)                               │
│                                                                        │
│  main.py ────────────────────────────────────────────────────────── │
│  ├── GET  /api/dashboard              DashboardResponse (v1)        │
│  ├── GET  /api/v2/*  (13 endpoints)                                │
│  │       /brief              AI world brief (Groq/OpenRouter/heuristic)│
│  │       /focal-points      Multi-domain convergence entities        │
│  │       /anomalies         Welford z-score anomaly detection       │
│  │       /convergence       Geographic signal convergence zones      │
│  │       /gaps              Intelligence coverage blind spots        │
│  │       /cii               Top-10 CII scores                     │
│  │       /cii/all           Full CII breakdown per country          │
│  │       /intelligence/air  ADS-B military flight tracks (stub)    │
│  │       /intelligence/sea  AIS naval vessel positions (stub)      │
│  │       /markets/live       Live quotes + freshness indicators     │
│  │       /signals/enriched  Signals + CII/anomaly/focal metadata │
│  │       /sources           105-feed source registry               │
│  └── WS  /ws/stream         v1 snapshot (events, signals, countries)│
│       /ws/stream/v2        v2 enriched (anomalies, focal pts, CII) │
│                                                                        │
│  ml/pipeline.py ──────────────────────────────────────────────────  │
│  LocalMLPipeline.process()                                           │
│  ├── NewsIntegrator.fetch_rss_events()  (6 feeds, hardcoded)        │
│  │   Note: sources.yaml (105 feeds) not yet wired for RSS fetch    │
│  ├── CIICalculator.score_all()        → cii_scores[]              │
│  ├── WelfordDetector.run_all_checks() → anomalies[]                │
│  ├── SignalAggregator.aggregate()      → focal_points[],            │
│  │                                       convergence_alerts[]       │
│  └── LLMProvider.synthesize_brief()    → world_brief               │
│                                                                        │
│  PROCESSORS          PROVIDERS          SERVICES          DATA         │
│  ├── cii.py         ├── llm.py        ├── cache.py     ├── sources.yaml│
│  │   (done)          │   (done)        │   (done)      │   (105 feeds)│
│  ├── anomaly.py       └── market.py      └── stream.py   ├── baseline_risk│
│  │   (done)              (done)                          └── events.json │
│  └── signal_aggregator.py                               (20 events)   │
│      (done)                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API available at `http://localhost:8000`. API docs at `/docs`.

### 2) Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### 3) Verify
```bash
curl http://localhost:8000/health                         # → {"status":"ok"}
curl http://localhost:8000/api/v2/brief                  # → world brief
curl http://localhost:8000/api/v2/anomalies              # → anomaly list
curl http://localhost:8000/api/v2/focal-points          # → focal points
```

---

## Environment Variables

All are optional. Copy `.env.example` → `.env`.

| Variable | Purpose | Default |
|---|---|---|
| `GROQ_API_KEY` | LLM for AI briefs (Groq, recommended) | heuristic fallback |
| `OPENROUTER_API_KEY` | LLM fallback (OpenRouter) | heuristic fallback |
| `UPSTASH_REDIS_REST_URL` | Distributed cache (Upstash) | in-memory |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash auth token | — |
| `REDIS_URL` | Self-hosted Redis | in-memory |
| `ALPHA_VANTAGE_KEY` | Live market quotes | static prices |
| `TWELVE_DATA_API_KEY` | Live market quotes (fallback) | static prices |
| `OPENSKY_USERNAME` | ADS-B air track integration | stub |
| `OPENSKY_PASSWORD` | ADS-B auth | stub |
| `AISSTREAM_TOKEN` | AIS maritime track integration | stub |

Frontend env vars (`VITE_*`) are public and safe to expose in the browser.

---

## API Reference

### REST v1 — `GET /api/*`
| Endpoint | Returns |
|---|---|
| `/api/dashboard` | Full dashboard snapshot |
| `/api/country/{code}` | Country detail |
| `/api/feeds` | Live event feeds |
| `/api/signals/trading` | Trading signals |
| `/api/geopolitical-index` | GTI and regional breakdown |
| `/api/market-impact-analysis` | Asset impact scores |
| `/api/risk-heatmap` | Regional heatmap |
| `/api/events/recent` | Recent events |
| `/api/portfolio` | Portfolio positions |

### REST v2 — `GET /api/v2/*`
| Endpoint | Returns |
|---|---|
| `/brief` | AI world brief (critical / markets / watchpoints) |
| `/focal-points` | Entities with 3+ signal types |
| `/anomalies` | Welford z-score alerts |
| `/convergence` | Geographic convergence zones |
| `/gaps` | Countries with high CII but low coverage |
| `/cii` | Top-10 CII scores |
| `/cii/all` | Full CII breakdown with components |
| `/intelligence/air` | Military flight tracks (stub) |
| `/intelligence/sea` | Naval vessel positions (stub) |
| `/markets/live` | Live quotes with freshness |
| `/signals/enriched` | Signals with CII/anomaly/focal metadata |
| `/sources` | 105-source registry |

### WebSocket Streams
| Path | Broadcasts |
|---|---|
| `/ws/stream` | v1 snapshot every 12s |
| `/ws/stream/v2` | v2 intelligence every 12s |

---

## Key Algorithms

### CII — Country Instability Index
Weighted composite (0–100):
- Baseline structural risk: **40%**
- Unrest / protest events: **20%** (log scale for democracies, linear for authoritarian regimes)
- Security / military activity: **20%**
- Information velocity (news frequency): **20%**
Conflict zone floors are enforced (UKR ≥ 55, AFG ≥ 65, etc.).

### Welford Anomaly Detection
Single-pass numerically stable variance estimation. Tracks event counts per `(region, event_type, weekday, month)`. Z-score thresholds:
- z ≥ 1.5 → LOW
- z ≥ 2.0 → MEDIUM
- z ≥ 3.0 → CRITICAL

### Signal Aggregator — Convergence Detection
Grid-bins events at 1° resolution. A convergence alert fires when ≥ 3 distinct signal types land in the same cell (military + diplomatic + economic + news). Focal points fire when a single country/entity appears across ≥ 3 distinct signal categories.

### LLM Brief Synthesis
Sends top-10 severity events to Groq (Llama 3.1 8B) or OpenRouter. Structured as 3 paragraphs: critical developments, market implications, 48h watchpoints. Falls back to heuristic summary if no LLM key is set. Cached 30 minutes.

---

## Frontend Views

| View | Key Feature |
|---|---|
| Earth Pulse (GlobeView) | 3D globe, layer toggles (air/sea/convergence/CII) |
| Geo Map (GeoMapView) | CII choropleth, convergence overlay, CII breakdown card |
| AI Signals (AISignalsView) | Focal point badge, anomaly badge, source tier badge |
| **Intelligence (IntelligencePanel)** | Brief card, focal points, anomalies, gap detection |
| Live Feeds | Source tier filter, state-affiliated warning tags |

---

## World Monitor Feature Status

| Feature | Status | Notes |
|---|---|---|
| RSS feed expansion (105 feeds) | ✅ Done | sources.yaml |
| CII scoring | ✅ Done | processors/cii.py |
| Welford anomaly detection | ✅ Done | processors/anomaly.py |
| Geographic convergence detection | ✅ Done | signal_aggregator.py |
| Focal point detection | ✅ Done | signal_aggregator.py |
| Hybrid LLM/keyword classifier | ✅ Done | providers/llm.py |
| AI world brief synthesis | ✅ Done | providers/llm.py + /brief endpoint |
| Intelligence gap reporting | ✅ Done | /gaps endpoint |
| Source tier credibility system | ⚠️ Partial | sources.yaml wired; UI badges done; RSS fetch still uses 6 hardcoded feeds |
| Military/maritime track overlays | ⚠️ Partial | Endpoints and UI exist; live track data requires API keys |
| Live market data upgrades | ✅ Done | providers/market.py |

---

## File Inventory

```
backend/
├── requirements.txt
├── app/
│   ├── main.py              FastAPI entry; 13 endpoints + 2 WebSockets
│   ├── schemas.py           Pydantic models (DashboardResponse etc.)
│   ├── news_integration.py  RSS fetching; 6 hardcoded feeds
│   ├── ml/
│   │   └── pipeline.py      LocalMLPipeline; integrates CII, anomaly, aggregator
│   ├── processors/
│   │   ├── cii.py           CIICalculator (done)
│   │   ├── anomaly.py        WelfordDetector (done)
│   │   └── signal_aggregator.py (done)
│   ├── providers/
│   │   ├── market.py        MarketProvider (done)
│   │   └── llm.py           LLMProvider (done)
│   ├── services/
│   │   ├── cache.py         CircuitBreakerCache (done)
│   │   └── correlation.py
│   ├── ingestion/
│   │   └── sources.py       load_sources_registry()
│   ├── models/
│   │   └── v2.py            EventV2, Layer, CIIResponse, AlertItem
│   └── api_v2.py            13 endpoints (8 new: brief, focal-points,
│                             anomalies, convergence, gaps, air, sea, markets/live)
└── app/data/
    ├── sources.yaml         105 sources × 4 tiers
    ├── baseline_risk.json   66 countries (cleaned)
    └── events.json          20 seed events with source_tier

frontend/src/
├── main.jsx
├── App.jsx                 10 views; Intelligence added; WS v2; anomaly state
├── api/v2.js               17 API methods (8 new)
├── styles.css              +400 lines World Monitor styles
├── styles_world_monitor.css
├── components/
│   ├── GlobeView.jsx       Layer toggles, air/sea arcs, convergence rings
│   ├── GeoMapView.jsx       CII choropleth, breakdown card, convergence overlay
│   ├── AISignalsView.jsx    Intelligence badges (focal, anomaly, tier, CII)
│   ├── LiveFeedsView.jsx    Tier filter, state-affiliated tags, intel badges
│   └── IntelligencePanel.jsx  4-card: Brief, Focal Points, Anomalies, Gaps
└── widgets/
    ├── registry.jsx          7 widgets (3 new: brief, anomaly, coverage)
    └── widgets/
        ├── BriefWidget.jsx
        ├── AnomalyWidget.jsx
        └── CoverageWidget.jsx
```

---

## Vercel Deployment

```
api/index.py   ← Vercel serverless entry (DO NOT MODIFY)
vercel.json   ← Deployment config (DO NOT MODIFY)
```

The Vercel adapter uses Mangum to wrap FastAPI for serverless. The frontend is served as static files. Set `VITE_API_BASE_URL` to your Vercel backend URL in the frontend env.
