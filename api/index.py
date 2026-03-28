from backend.app.main import app
from mangum import Mangum

# Vercel serverless adapter: exposes handler for edge/serverless runtimes.
handler = Mangum(app, lifespan="off")
