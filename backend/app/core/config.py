from typing import List, Literal, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Truss"

    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Auth provider
    # "supabase" → validates Supabase JWTs (production default)
    # "local"    → self-contained JWT auth, no external services required
    AUTH_PROVIDER: Literal["supabase", "local"] = "supabase"

    # Storage provider
    # "supabase" → Supabase Storage REST API
    # "local"    → local filesystem under LOCAL_STORAGE_PATH
    STORAGE_PROVIDER: Literal["supabase", "local"] = "supabase"

    # Database
    DATABASE_URL: str

    # Supabase (required when AUTH_PROVIDER=supabase)
    SUPABASE_URL: str = ""
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = ""

    # Local auth (used when AUTH_PROVIDER=local)
    LOCAL_JWT_SECRET: str = "dev-secret-change-in-production"
    LOCAL_JWT_EXPIRE_DAYS: int = 7

    # Local storage (used when STORAGE_PROVIDER=local)
    LOCAL_STORAGE_PATH: str = "./data/uploads"

    # Redis (optional - caching is skipped when blank)
    REDIS_URL: str = ""

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
