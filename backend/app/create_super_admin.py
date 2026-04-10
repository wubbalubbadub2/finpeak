"""Create the super admin user in Supabase + link to an organization."""

import secrets
import sys

import httpx

from .config import get_settings
from .database import SessionLocal
from .models import Organization


def create_super_admin(password: str | None = None):
    settings = get_settings()
    if not settings.super_admin_email:
        print("ERROR: SUPER_ADMIN_EMAIL not set in .env")
        sys.exit(1)

    if not password:
        password = secrets.token_urlsafe(16)

    # 1. Create user in Supabase via Admin API
    print(f"Creating Supabase user: {settings.super_admin_email}")
    resp = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        json={
            "email": settings.super_admin_email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"role": "super_admin"},
        },
        timeout=30,
    )

    if resp.status_code == 422 and "already" in resp.text.lower():
        print("User already exists, fetching...")
        # Get the existing user
        resp = httpx.get(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            timeout=30,
        )
        users = resp.json().get("users", [])
        user = next((u for u in users if u["email"] == settings.super_admin_email), None)
        if not user:
            print(f"ERROR: could not find user {settings.super_admin_email}")
            sys.exit(1)
    elif resp.status_code >= 400:
        print(f"ERROR creating user: {resp.status_code} {resp.text}")
        sys.exit(1)
    else:
        user = resp.json()
        print(f"Created user with password: {password}")

    user_id = user["id"]
    print(f"Supabase user ID: {user_id}")

    # 2. Find existing organization (the seeded one) and update it OR find by email
    db = SessionLocal()
    try:
        # First check if there's already an org for this user
        org = db.query(Organization).filter_by(supabase_user_id=user_id).first()
        if not org:
            org = db.query(Organization).filter_by(email=settings.super_admin_email).first()
        if not org:
            # Use the seeded "Default Organization" — it has all the categories/rules
            org = db.query(Organization).filter_by(name="Default Organization").first()

        if not org:
            print("ERROR: no organization found")
            sys.exit(1)

        org.supabase_user_id = user_id
        org.email = settings.super_admin_email
        org.role = "super_admin"
        org.name = "Super Admin"
        db.commit()
        print(f"Linked org '{org.id}' to user '{settings.super_admin_email}' as super_admin")
    finally:
        db.close()


if __name__ == "__main__":
    pwd = sys.argv[1] if len(sys.argv) > 1 else None
    create_super_admin(pwd)
