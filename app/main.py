from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.logging import setup_logging
from .api.routes import dataset, session, preprocessing, model, health

setup_logging()


def get_application() -> FastAPI:
  app = FastAPI(title=settings.PROJECT_NAME)

  # CORS
  origins = settings.BACKEND_CORS_ORIGINS or ["*"]
  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
  )

  # Router'lar (prefix yok; path'ler direkt API_ENDPOINTS ile aynı)
  app.include_router(health.router)
  app.include_router(dataset.router)
  app.include_router(session.router)
  app.include_router(preprocessing.router)
  app.include_router(model.router)

  return app


app = get_application()
