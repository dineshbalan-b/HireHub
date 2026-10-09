import os
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import create_db_and_tables
from app.api.v1.auth import router as auth_router
from app.api.v1.drives import router as drives_router
from app.api.v1.candidates import router as candidates_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs("./data", exist_ok=True)
    os.makedirs("./data/resumes", exist_ok=True)
    await create_db_and_tables()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="AgentHire API",
    description="Multi-Agent AI Recruitment Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False
)

# CORS middleware
# Note: allow_credentials=True cannot be used with allow_origins=["*"]
# So we list allowed origins explicitly
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://hire-hub-sigma-three.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(drives_router, prefix="/api/v1/hr/drives", tags=["drives"])
app.include_router(candidates_router, prefix="/api/v1/candidates", tags=["candidates"])

@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Welcome to AgentHire API",
        "version": "1.0.0"
    }
