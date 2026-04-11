"""User management endpoints (super admin only)."""

from __future__ import annotations

import json
import secrets
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_user, require_super_admin
from ..models import Category, CategorizationRule, Organization

router = APIRouter(tags=["users"])


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str | None = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str | None
    role: str
    onboarded: bool = False
    created_at: str | None = None


@router.get("/auth/me", response_model=UserOut)
def auth_me(org: Organization = Depends(get_current_user)):
    """Get current authenticated user info."""
    return UserOut(
        id=org.id,
        name=org.name,
        email=org.email,
        role=org.role,
        onboarded=org.onboarded_at is not None,
        created_at=org.created_at.isoformat() if org.created_at else None,
    )


@router.post("/auth/complete-onboarding")
def complete_onboarding(
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark current user as having completed onboarding."""
    org.onboarded_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/users", response_model=list[UserOut])
def list_users(
    _admin: Organization = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """List all users (super admin only)."""
    orgs = db.query(Organization).filter(Organization.email.isnot(None)).order_by(Organization.created_at.desc()).all()
    return [
        UserOut(
            id=o.id,
            name=o.name,
            email=o.email,
            role=o.role,
            created_at=o.created_at.isoformat() if o.created_at else None,
        )
        for o in orgs
    ]


@router.post("/users", response_model=dict)
def create_user(
    body: UserCreate,
    _admin: Organization = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Create a new client user account."""
    settings = get_settings()
    password = body.password or secrets.token_urlsafe(12)

    # Create user in Supabase
    resp = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        json={
            "email": body.email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"name": body.name},
        },
        timeout=30,
    )

    if resp.status_code == 422 and "already" in resp.text.lower():
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=f"Supabase error: {resp.text}")

    user = resp.json()
    user_id = user["id"]

    # Create org for this user
    org = Organization(
        name=body.name,
        email=body.email,
        supabase_user_id=user_id,
        role="user",
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # Seed categories and rules for this org
    json_path = Path(__file__).parent.parent.parent.parent / "kz_finance" / "categorizer" / "categories.json"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cat_map = {}
    for c in data["categories"]:
        cat = Category(
            organization_id=org.id,
            name=c["name"],
            group=c.get("group", ""),
            activity_type=c.get("activity_type", ""),
            description=c.get("description", ""),
            category_group=c.get("category_group", ""),
        )
        db.add(cat)
        db.flush()
        cat_map[c["name"]] = cat

    for r in data["rules"]:
        cat = cat_map.get(r["category"])
        if not cat:
            continue
        rule = CategorizationRule(
            organization_id=org.id,
            field=r["field"],
            pattern=r["pattern"],
            category_id=cat.id,
            category_name=r["category"],
            source="imported",
        )
        db.add(rule)

    db.commit()

    return {
        "id": org.id,
        "email": body.email,
        "name": body.name,
        "password": password,
        "supabase_user_id": user_id,
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    _admin: Organization = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Delete a user account."""
    settings = get_settings()
    org = db.query(Organization).filter_by(id=user_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="User not found")
    if org.role == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot delete super admin")

    if org.supabase_user_id:
        try:
            httpx.delete(
                f"{settings.supabase_url}/auth/v1/admin/users/{org.supabase_user_id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
                timeout=15,
            )
        except Exception:
            pass

    db.delete(org)
    db.commit()
    return {"ok": True}
