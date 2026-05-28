from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.logging import setup_logging
from .api.routes import dataset, preprocessing, model, health, auth, projects, jobs

setup_logging()


def get_application() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME, version="2.0.0")

    origins = settings.BACKEND_CORS_ORIGINS or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
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
