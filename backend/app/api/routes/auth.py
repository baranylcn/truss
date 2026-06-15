import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import (
    get_current_user,
    create_local_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.core.limiter import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.db import get_db
from app.services.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync")
async def sync_user(current_user: User = Depends(get_current_user)) -> dict:
    """Syncs the authenticated user into the users table. Called after every login."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "plan": current_user.plan,
    }


# Local-mode endpoints (unavailable when AUTH_PROVIDER=supabase)

def _require_local_mode() -> None:
    if settings.AUTH_PROVIDER != "local":
        raise HTTPException(
            status_code=404,
            detail="This endpoint is only available in local auth mode.",
        )


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Creates a new user account. Only available when AUTH_PROVIDER=local."""
    _require_local_mode()

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        id=uuid.uuid4(),
        email=body.email,
        password_hash=hash_password(body.password),
        plan="free",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_local_token(user.id, user.email),
        user_id=str(user.id),
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticates a user and returns a JWT. Only available when AUTH_PROVIDER=local."""
    _require_local_mode()

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return TokenResponse(
        access_token=create_local_token(user.id, user.email),
        user_id=str(user.id),
        email=user.email,
    )
