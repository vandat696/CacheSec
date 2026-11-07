"""ASGI composition root: uvicorn app.main:app."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.control.health import router as health_router
from app.control.settings import settings

app = FastAPI(title="CacheSec API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)
app.include_router(health_router)
