"""ASGI composition root: uvicorn app.control.control_api:app."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.control.control_settings import settings
from app.control.health_routes import router as health_router

app = FastAPI(title="CacheSec API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)
app.include_router(health_router)
