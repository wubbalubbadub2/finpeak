"""Supabase JWT authentication."""

from __future__ import annotations

import httpx
from fastapi import HTTPException, Header, Depends
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import Organization


def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase JWT and return the payload.

    Note: We use Supabase's built-in user endpoint to validate the token
    rather than verifying the signature locally, since the JWT secret is
    not exposed via the standard env vars.
    """
    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(status_code=500, detail="Supabase URL not configured")

    try:
        resp = httpx.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
            timeout=5,
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Auth service unreachable: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return resp.json()


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> Organization:
    """Validate the Bearer token and return the organization for the user."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.replace("Bearer ", "", 1).strip()
    user_data = verify_supabase_token(token)

    user_id = user_data.get("id")
    email = user_data.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Find the org for this user
    org = db.query(Organization).filter_by(supabase_user_id=user_id).first()

    if not org:
        # Auto-provision: create a new org for this Supabase user
        # (this happens when super admin invited them)
        org = db.query(Organization).filter_by(email=email).first()
        if org:
            org.supabase_user_id = user_id
            db.commit()
        else:
            raise HTTPException(status_code=403, detail="No organization for this user. Contact admin.")

    return org


def require_super_admin(
    org: Organization = Depends(get_current_user),
) -> Organization:
    """Require the current user to be a super admin."""
    if org.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return org
