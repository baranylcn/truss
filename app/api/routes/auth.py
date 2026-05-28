from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.services.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync")
async def sync_user(current_user: User = Depends(get_current_user)) -> dict:
    """Syncs the authenticated user into the public.users table. Call after every login."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "plan": current_user.plan,
    }
