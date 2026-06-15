import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("AUTH_PROVIDER", "local")
os.environ.setdefault("LOCAL_JWT_SECRET", "test-secret-for-unit-tests-minimum-32-chars")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://localhost")
os.environ.setdefault("STORAGE_PROVIDER", "local")
