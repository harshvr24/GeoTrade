# GeoTrade

GeoTrade is a full-stack geopolitical trading intelligence platform with a local-first ML pipeline and a 3D globe interface.

## Stack
- **Frontend:** React 19 + Vite + `react-globe.gl`
- **Backend:** FastAPI + Pydantic
- **ML:** local NLP-style event processing + sentiment heuristics + narrative clustering + gradient-boosted volatility model
- **Deployment:** Vercel (single project: static frontend + Python API)

## Monorepo layout
- `backend/` FastAPI API and ML pipeline
- `frontend/` React dashboard and interactive globe UI
- `api/index.py` Vercel ASGI entrypoint
- `vercel.json` build/routing config

## Local development
### Run backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Run frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Optional env var:
- `VITE_API_BASE_URL` (defaults to same-origin; for local dev use `http://localhost:8000` if needed)

## Vercel deployment readiness
This repository is structured to deploy from the **repo root** as a single Vercel project:
- the Python API is served from `api/index.py`
- the frontend is built from `frontend/package.json`
- `vercel.json` handles API routing and SPA fallback
- `frontend/package-lock.json` is committed for reproducible installs
- `.gitignore` excludes local build output and `node_modules`

### Recommended Vercel project settings
When importing from GitHub:
1. **Framework Preset:** Other
2. **Root Directory:** `.` (repo root)
3. **Build and Output Settings:** leave blank and let `vercel.json` drive the build
4. **Install Command:** leave default
5. **No required environment variables** for the demo deployment

### Preview deployment
```bash
vercel
```

### Production deployment
```bash
vercel --prod
```

### Post-deploy checks
```bash
curl https://<your-deployment>/health
curl https://<your-deployment>/api/dashboard
```
Then open the root URL and verify:
- the GTI dashboard renders
- the globe loads
- `/api/dashboard` powers live data or falls back to demo data in the UI
- the waitlist form submits successfully
