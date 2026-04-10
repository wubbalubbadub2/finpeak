"""Google Sheets sync endpoint."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_org
from ..models import Organization, Transaction, BankAccount

router = APIRouter(tags=["sheets"])


class SheetsExportRequest(BaseModel):
    sheet_url: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


@router.post("/sheets/export")
def export_to_sheets(
    body: SheetsExportRequest,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    """Export transactions to Google Sheets."""
    try:
        from ..services.sheets import export_transactions_to_sheets
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Google Sheets dependencies not installed: {e}")

    # Query transactions
    q = (
        db.query(Transaction)
        .join(BankAccount)
        .filter(BankAccount.organization_id == org.id)
    )
    if body.date_from:
        q = q.filter(Transaction.date >= body.date_from)
    if body.date_to:
        q = q.filter(Transaction.date <= body.date_to)

    txs = q.order_by(Transaction.date).all()
    if not txs:
        raise HTTPException(status_code=404, detail="No transactions found for the given period")

    # Convert to dicts with wallet_name
    tx_dicts = []
    for tx in txs:
        ba = tx.bank_account
        tx_dicts.append({
            'date': tx.date,
            'debit': tx.debit,
            'credit': tx.credit,
            'counterparty': tx.counterparty,
            'counterparty_bin': tx.counterparty_bin,
            'payment_description': tx.payment_description,
            'knp': tx.knp,
            'category_name': tx.category_name,
            'activity_type': tx.activity_type,
            'direction': tx.direction,
            'wallet_name': ba.wallet_name if ba else '',
        })

    result = export_transactions_to_sheets(
        transactions=tx_dicts,
        sheet_url=body.sheet_url,
    )

    return result
