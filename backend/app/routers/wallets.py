"""Wallet (bank account) management endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import BankAccount, Organization, Transaction

router = APIRouter(tags=["wallets"])


class WalletOut(BaseModel):
    id: str
    account_number: str
    bank: str
    wallet_name: str | None
    currency: str
    opening_balance: float
    is_archived: bool
    transaction_count: int
    current_balance: float

    class Config:
        from_attributes = True


class WalletUpdate(BaseModel):
    wallet_name: Optional[str] = None
    opening_balance: Optional[float] = None
    is_archived: Optional[bool] = None
    currency: Optional[str] = None


class WalletCreate(BaseModel):
    account_number: str
    bank: str
    wallet_name: str
    currency: str = "KZT"
    opening_balance: float = 0


@router.get("/wallets", response_model=list[WalletOut])
def list_wallets(
    include_archived: bool = False,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(BankAccount).filter_by(organization_id=org.id)
    if not include_archived:
        q = q.filter(BankAccount.is_archived == False)
    wallets = q.order_by(BankAccount.bank, BankAccount.wallet_name).all()

    result = []
    for w in wallets:
        # Compute current balance: opening + sum of signed amounts
        txs = db.query(Transaction).filter_by(bank_account_id=w.id).all()
        current = float(w.opening_balance or 0) + sum(tx.signed_amount for tx in txs)
        result.append(
            WalletOut(
                id=w.id,
                account_number=w.account_number,
                bank=w.bank,
                wallet_name=w.wallet_name,
                currency=w.currency or "KZT",
                opening_balance=float(w.opening_balance or 0),
                is_archived=bool(w.is_archived),
                transaction_count=len(txs),
                current_balance=round(current, 2),
            )
        )
    return result


@router.post("/wallets", response_model=WalletOut)
def create_wallet(
    body: WalletCreate,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check duplicate
    existing = db.query(BankAccount).filter_by(
        organization_id=org.id, account_number=body.account_number
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Счет с таким номером уже существует")

    wallet = BankAccount(
        organization_id=org.id,
        account_number=body.account_number,
        bank=body.bank,
        wallet_name=body.wallet_name,
        currency=body.currency,
        opening_balance=body.opening_balance,
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)

    return WalletOut(
        id=wallet.id,
        account_number=wallet.account_number,
        bank=wallet.bank,
        wallet_name=wallet.wallet_name,
        currency=wallet.currency or "KZT",
        opening_balance=float(wallet.opening_balance or 0),
        is_archived=False,
        transaction_count=0,
        current_balance=float(wallet.opening_balance or 0),
    )


@router.patch("/wallets/{wallet_id}", response_model=WalletOut)
def update_wallet(
    wallet_id: str,
    body: WalletUpdate,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(BankAccount).filter_by(id=wallet_id, organization_id=org.id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Счет не найден")

    if body.wallet_name is not None:
        wallet.wallet_name = body.wallet_name
    if body.opening_balance is not None:
        wallet.opening_balance = body.opening_balance
    if body.is_archived is not None:
        wallet.is_archived = body.is_archived
    if body.currency is not None:
        wallet.currency = body.currency

    db.commit()
    db.refresh(wallet)

    txs = db.query(Transaction).filter_by(bank_account_id=wallet.id).all()
    current = float(wallet.opening_balance or 0) + sum(tx.signed_amount for tx in txs)

    return WalletOut(
        id=wallet.id,
        account_number=wallet.account_number,
        bank=wallet.bank,
        wallet_name=wallet.wallet_name,
        currency=wallet.currency or "KZT",
        opening_balance=float(wallet.opening_balance or 0),
        is_archived=bool(wallet.is_archived),
        transaction_count=len(txs),
        current_balance=round(current, 2),
    )


@router.delete("/wallets/{wallet_id}")
def delete_wallet(
    wallet_id: str,
    org: Organization = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(BankAccount).filter_by(id=wallet_id, organization_id=org.id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Счет не найден")

    db.delete(wallet)  # cascade deletes transactions
    db.commit()
    return {"ok": True}
