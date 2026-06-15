from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.logging import setup_logging
from .api.routes import dataset, preprocessing, model, health, auth, projects, jobs

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .services.db import engine
    from .services.models import Base
    from .core.redis import get_redis
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.REDIS_URL:
        await get_redis().ping()
    yield


def get_application() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME, version="2.0.0", lifespan=lifespan)

    if not settings.BACKEND_CORS_ORIGINS:
        raise RuntimeError("BACKEND_CORS_ORIGINS must be set to at least one allowed origin")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
    )

    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api")
    app.include_router(projects.router, prefix="/api")
    app.include_router(dataset.router, prefix="/api")
    app.include_router(preprocessing.router, prefix="/api")
    app.include_router(model.router, prefix="/api")
    app.include_router(jobs.router, prefix="/api")

    return app


app = get_application()
