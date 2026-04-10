"""Category and rules CRUD endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_org
from ..models import Organization, Category, CategorizationRule
from ..schemas import CategoryOut, CategoryCreate

router = APIRouter(tags=["categories"])


# --- Rule request schemas (kept local to avoid touching schemas.py) ---

class RuleCreate(BaseModel):
    field: str  # "payment_description" or "counterparty"
    pattern: str
    category_name: str


class RuleUpdate(BaseModel):
    field: Optional[str] = None
    pattern: Optional[str] = None
    category_name: Optional[str] = None


def _rule_to_dict(r: CategorizationRule) -> dict:
    return {
        "id": r.id,
        "field": r.field,
        "pattern": r.pattern,
        "category_id": r.category_id,
        "category_name": r.category_name,
        "source": r.source,
    }


def _validate_rule_field(field: str) -> None:
    if field not in ("payment_description", "counterparty"):
        raise HTTPException(
            status_code=422,
            detail="field must be 'payment_description' or 'counterparty'",
        )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    cats = db.query(Category).filter_by(
        organization_id=org.id, is_active=True
    ).order_by(Category.activity_type, Category.name).all()
    return [CategoryOut.model_validate(c) for c in cats]


@router.post("/categories", response_model=CategoryOut)
def create_category(
    body: CategoryCreate,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    existing = db.query(Category).filter_by(
        organization_id=org.id, name=body.name
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")

    cat = Category(
        organization_id=org.id,
        name=body.name,
        group=body.group,
        activity_type=body.activity_type,
        description=body.description,
        category_group=body.category_group,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut.model_validate(cat)


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: str,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    cat = db.query(Category).filter_by(id=cat_id, organization_id=org.id).first()
    if not cat:
        raise HTTPException(status_code=404)
    cat.is_active = False
    db.commit()
    return {"ok": True}


@router.get("/rules")
def list_rules(
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    rules = db.query(CategorizationRule).filter_by(
        organization_id=org.id
    ).order_by(CategorizationRule.source, CategorizationRule.created_at.desc()).all()
    return [_rule_to_dict(r) for r in rules]


@router.post("/rules")
def create_rule(
    body: RuleCreate,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    _validate_rule_field(body.field)

    pattern = (body.pattern or "").strip()
    if not pattern:
        raise HTTPException(status_code=422, detail="pattern must not be empty")

    cat = db.query(Category).filter_by(
        organization_id=org.id, name=body.category_name
    ).first()
    if not cat:
        raise HTTPException(
            status_code=422,
            detail=f"Category not found: {body.category_name}",
        )

    rule = CategorizationRule(
        organization_id=org.id,
        field=body.field,
        pattern=pattern,
        category_id=cat.id,
        category_name=cat.name,
        source="manual",
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.patch("/rules/{rule_id}")
def update_rule(
    rule_id: str,
    body: RuleUpdate,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    rule = db.query(CategorizationRule).filter_by(
        id=rule_id, organization_id=org.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if body.field is not None:
        _validate_rule_field(body.field)
        rule.field = body.field

    if body.pattern is not None:
        pattern = body.pattern.strip()
        if not pattern:
            raise HTTPException(status_code=422, detail="pattern must not be empty")
        rule.pattern = pattern

    if body.category_name is not None:
        cat = db.query(Category).filter_by(
            organization_id=org.id, name=body.category_name
        ).first()
        if not cat:
            raise HTTPException(
                status_code=422,
                detail=f"Category not found: {body.category_name}",
            )
        rule.category_id = cat.id
        rule.category_name = cat.name

    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: str,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    rule = db.query(CategorizationRule).filter_by(
        id=rule_id, organization_id=org.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404)
    db.delete(rule)
    db.commit()
    return {"ok": True}
