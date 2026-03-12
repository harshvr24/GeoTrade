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

## Vercel test + full deployment
1. Install and login:
```bash
npm i -g vercel
vercel login
```

2. **Test preview deployment first**:
```bash
vercel
```
This creates a preview URL where both frontend and API are live together.

3. Validate endpoints on preview URL:
```bash
curl https://<preview-url>/health
curl https://<preview-url>/api/dashboard
```

4. Promote to production deployment:
```bash
vercel --prod
```

5. Optional: add custom domain in Vercel dashboard and redeploy.
