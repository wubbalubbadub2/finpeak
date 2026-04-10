"""SQLAlchemy database engine and session."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import get_settings

engine = create_engine(
    get_settings().database_url,
    connect_args={"check_same_thread": False} if "sqlite" in get_settings().database_url else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
