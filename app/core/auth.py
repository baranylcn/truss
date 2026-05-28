import uuid
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.services.db import get_db
from app.services.models import User

security = HTTPBearer()

_jwks_client: PyJWKClient | None = None

_ASYMMETRIC_ALGS = {"ES256", "ES384", "ES512", "RS256", "RS384", "RS512", "EdDSA"}


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
        )
    return _jwks_client


def _decode_token(token: str) -> dict:
    """Routes to JWKS (ES256/RS256/EdDSA) or legacy HS256 secret based on token alg header."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError as exc:
        raise jwt.InvalidTokenError(f"Malformed token: {exc}")

    alg = header.get("alg", "HS256")

    if alg in _ASYMMETRIC_ALGS:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=list(_ASYMMETRIC_ALGS),
            audience="authenticated",
        )

    return jwt.decode(
        token,
        settings.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verifies Supabase JWT and returns the authenticated user, creating them if first login."""
    try:
        payload = _decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Token missing subject")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user id in token")

    email: str = payload.get("email", "")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(id=user_id, email=email, plan="free")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
