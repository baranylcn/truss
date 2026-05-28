from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Truss"
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "https://www.trussplatform.com",
        "https://trussplatform.com",
        "http://localhost:5173",
        "http://localhost:3000"
    ]

    DATABASE_URL: str

    SUPABASE_URL: str = ""
    SUPABASE_JWT_SECRET: str = ""

    REDIS_URL: str = ""

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
