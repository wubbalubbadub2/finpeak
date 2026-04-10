"""Seed database with categories and rules from Phase 1 categories.json."""

import json
import secrets
from pathlib import Path

from .database import engine, SessionLocal
from .models import Base, Organization, Category, CategorizationRule


def seed():
    # Create tables
    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Organization).first():
            print("Database already seeded.")
            return

        # Create default organization
        org = Organization(
            name="Default Organization",
            api_key=secrets.token_hex(32),
        )
        db.add(org)
        db.flush()

        # Load categories.json from Phase 1
        json_path = Path(__file__).parent.parent.parent / "kz_finance" / "categorizer" / "categories.json"
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Insert categories
        cat_map = {}  # name -> Category object
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

        # Insert rules
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
        print(f"Seeded: 1 organization, {len(cat_map)} categories, {len(data['rules'])} rules")
        print(f"API key: {org.api_key}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
