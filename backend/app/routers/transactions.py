"""Transaction CRUD endpoints."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_org
from ..models import Organization, Transaction, BankAccount, Category, CategorizationRule
from ..schemas import TransactionOut, TransactionUpdate, TransactionListResponse

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    bank: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Transaction)
        .join(BankAccount)
        .filter(BankAccount.organization_id == org.id)
    )

    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    if bank:
        q = q.filter(BankAccount.bank == bank)
    if category:
        q = q.filter(Transaction.category_name == category)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (Transaction.counterparty.ilike(pattern)) |
            (Transaction.payment_description.ilike(pattern))
        )

    total = q.count()
    txs = q.order_by(Transaction.date.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return TransactionListResponse(
        transactions=[_to_out(tx) for tx in txs],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.patch("/transactions/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: str,
    body: TransactionUpdate,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .join(BankAccount)
        .filter(Transaction.id == tx_id, BankAccount.organization_id == org.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Find category
    cat = db.query(Category).filter_by(
        organization_id=org.id, name=body.category_name
    ).first()
    if not cat:
        raise HTTPException(status_code=422, detail=f"Category not found: {body.category_name}")

    # Update transaction
    tx.category_id = cat.id
    tx.category_name = cat.name
    tx.activity_type = cat.activity_type
    tx.direction = cat.group
    tx.category_confidence = 1.0
    tx.categorization_source = "manual"

    # Auto-create a learning rule from this override
    _create_learning_rule(db, org.id, tx, cat)

    db.commit()
    db.refresh(tx)
    return _to_out(tx)


def _create_learning_rule(db: Session, org_id: str, tx: Transaction, cat: Category):
    """Auto-create a categorization rule from a manual override."""
    # Use counterparty_bin if available (most reliable)
    if tx.counterparty_bin:
        existing = db.query(CategorizationRule).filter_by(
            organization_id=org_id,
            field="counterparty",
            pattern=tx.counterparty_bin,
        ).first()
        if not existing:
            rule = CategorizationRule(
                organization_id=org_id,
                field="counterparty",
                pattern=tx.counterparty_bin,
                category_id=cat.id,
                category_name=cat.name,
                source="learned",
            )
            db.add(rule)
            return

    # Fall back to description keyword
    desc = tx.payment_description or ""
    if len(desc) >= 10:
        # Take first 30 chars as the pattern
        pattern = desc[:30].strip()
        existing = db.query(CategorizationRule).filter_by(
            organization_id=org_id,
            field="payment_description",
            pattern=pattern,
        ).first()
        if not existing:
            rule = CategorizationRule(
                organization_id=org_id,
                field="payment_description",
                pattern=pattern,
                category_id=cat.id,
                category_name=cat.name,
                source="learned",
            )
            db.add(rule)


def _to_out(tx: Transaction) -> TransactionOut:
    ba = tx.bank_account
    return TransactionOut(
        id=tx.id,
        date=tx.date,
        doc_number=tx.doc_number,
        debit=float(tx.debit) if tx.debit else None,
        credit=float(tx.credit) if tx.credit else None,
        signed_amount=tx.signed_amount,
        counterparty=tx.counterparty,
        counterparty_bin=tx.counterparty_bin,
        payment_description=tx.payment_description,
        knp=tx.knp,
        category_name=tx.category_name,
        category_confidence=tx.category_confidence,
        activity_type=tx.activity_type,
        direction=tx.direction,
        categorization_source=tx.categorization_source,
        bank=ba.bank if ba else None,
        account_number=ba.account_number if ba else None,
        wallet_name=ba.wallet_name if ba else None,
    )
