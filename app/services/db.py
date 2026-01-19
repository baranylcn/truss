from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings
import ssl
from sqlalchemy.engine.url import make_url


def _make_async_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    url_obj = make_url(url)
    if "sslmode" not in url_obj.query:
        url_obj = url_obj.set(query={**url_obj.query, "sslmode": "require"})

    return str(url_obj)


ASYNC_DATABASE_URL = _make_async_url(settings.DATABASE_URL)

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"ssl": ssl_context},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
