"""FastAPI dependencies: auth, database."""

from .auth import get_current_user, require_super_admin
from .database import get_db

# Re-export for compatibility — get_org now uses Supabase JWT auth
get_org = get_current_user

__all__ = ["get_db", "get_org", "get_current_user", "require_super_admin"]
