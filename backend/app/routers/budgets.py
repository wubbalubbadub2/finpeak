"""Budget management with actuals comparison."""

from __future__ import annotations

import re
from datetime import datetime
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Budget, Category, Organization, Transaction, BankAccount

router = APIRouter(tags=["budgets"])

PERIOD_RE = re.compile(r"^\d{4}-\d{2}$")


def _validate_period(period: str) -> None:
    if not PERIOD_RE.match(period):
        raise HTTPException(status_code=422, detail="period must be 'YYYY-MM'")


class BudgetRow(BaseModel):
    id: str | None  # null if no budget set yet for this category
    category_id: str
    category_name: str
    category_group: str
    activity_type: str
    period: str
    budget: float
    actual: float
    diff: float  # budget - actual (positive = under budget)
    pct_used: float  # 0..200 (capped for display)


class BudgetSummary(BaseModel):
    period: str
    rows: list[BudgetRow]
    total_budget: float
    total_actual: float
    total_diff: float


class BudgetUpsert(BaseModel):
    category_id: str
    period: str
    amount: float


@router.get("/budgets", response_model=BudgetSummary)
def get_budgets(
    period: str,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all expense categories with budget vs actual for a given month."""
    _validate_period(period)
    year, month = map(int, period.split("-"))

    # Load all expense categories for the org
    cats = (
        db.query(Category)
        .filter_by(organization_id=org.id, group="Выбытие", is_active=True)
        .order_by(Category.activity_type, Category.category_group, Category.name)
        .all()
    )

    # Load existing budgets for this period
    existing = (
        db.query(Budget)
        .filter_by(organization_id=org.id, period=period)
        .all()
    )
    budget_map = {b.category_id: b for b in existing}

    # Compute actuals from transactions: sum of debits for each category in this month
    actuals = (
        db.query(
            Transaction.category_id,
            func.sum(Transaction.debit).label("actual"),
        )
        .join(BankAccount)
        .filter(
            BankAccount.organization_id == org.id,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.debit.isnot(None),
        )
        .group_by(Transaction.category_id)
        .all()
    )
    actual_map = {row[0]: float(row[1] or 0) for row in actuals}

    rows = []
    total_budget = 0.0
    total_actual = 0.0

    for cat in cats:
        b = budget_map.get(cat.id)
        budget_amt = float(b.amount) if b else 0.0
        actual_amt = actual_map.get(cat.id, 0.0)
        diff = budget_amt - actual_amt
        pct = 0.0
        if budget_amt > 0:
            pct = round(actual_amt / budget_amt * 100, 1)
        elif actual_amt > 0:
            pct = 100.0  # Spending without a budget — show as fully used / over

        rows.append(
            BudgetRow(
                id=b.id if b else None,
                category_id=cat.id,
                category_name=cat.name,
                category_group=cat.category_group or "",
                activity_type=cat.activity_type or "",
                period=period,
                budget=round(budget_amt, 2),
                actual=round(actual_amt, 2),
                diff=round(diff, 2),
                pct_used=pct,
            )
        )
        total_budget += budget_amt
        total_actual += actual_amt

    return BudgetSummary(
        period=period,
        rows=rows,
        total_budget=round(total_budget, 2),
        total_actual=round(total_actual, 2),
        total_diff=round(total_budget - total_actual, 2),
    )


@router.post("/budgets", response_model=BudgetRow)
def upsert_budget(
    body: BudgetUpsert,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set the budget for one category in a given month (upsert)."""
    _validate_period(body.period)
    cat = db.query(Category).filter_by(id=body.category_id, organization_id=org.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    existing = (
        db.query(Budget)
        .filter_by(organization_id=org.id, category_id=body.category_id, period=body.period)
        .first()
    )

    if existing:
        existing.amount = body.amount
        existing.updated_at = datetime.utcnow()
        budget = existing
    else:
        budget = Budget(
            organization_id=org.id,
            category_id=body.category_id,
            category_name=cat.name,
            period=body.period,
            amount=body.amount,
        )
        db.add(budget)

    db.commit()
    db.refresh(budget)

    # Compute actual to return current state
    year, month = map(int, body.period.split("-"))
    actual = (
        db.query(func.sum(Transaction.debit))
        .join(BankAccount)
        .filter(
            BankAccount.organization_id == org.id,
            Transaction.category_id == body.category_id,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.debit.isnot(None),
        )
        .scalar()
    )
    actual_amt = float(actual or 0)
    budget_amt = float(budget.amount)
    diff = budget_amt - actual_amt
    pct = round(actual_amt / budget_amt * 100, 1) if budget_amt > 0 else 0.0

    return BudgetRow(
        id=budget.id,
        category_id=cat.id,
        category_name=cat.name,
        category_group=cat.category_group or "",
        activity_type=cat.activity_type or "",
        period=body.period,
        budget=round(budget_amt, 2),
        actual=round(actual_amt, 2),
        diff=round(diff, 2),
        pct_used=pct,
    )


@router.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: str,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.query(Budget).filter_by(id=budget_id, organization_id=org.id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Бюджет не найден")
    db.delete(b)
    db.commit()
    return {"ok": True}


class CopyBody(BaseModel):
    from_period: str
    to_period: str


@router.post("/budgets/copy")
def copy_budgets(
    body: CopyBody,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Copy all budgets from one month to another (overwrites existing)."""
    _validate_period(body.from_period)
    _validate_period(body.to_period)

    source = db.query(Budget).filter_by(organization_id=org.id, period=body.from_period).all()
    if not source:
        return {"copied": 0, "message": "В исходном месяце нет бюджетов"}

    # Delete existing budgets for the target period
    db.query(Budget).filter_by(organization_id=org.id, period=body.to_period).delete()

    # Copy
    count = 0
    now = datetime.utcnow()
    for src in source:
        new_budget = Budget(
            organization_id=org.id,
            category_id=src.category_id,
            category_name=src.category_name,
            period=body.to_period,
            amount=src.amount,
            created_at=now,
            updated_at=now,
        )
        db.add(new_budget)
        count += 1

    db.commit()
    return {"copied": count}
