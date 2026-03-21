from backend.app.main import app
from mangum import Mangum

# Vercel serverless requires an ASGI-to-Lambda/serverless adapter.
# Mangum wraps the FastAPI ASGI app into a handler Vercel can invoke.
handler = Mangum(app, lifespan="off")
