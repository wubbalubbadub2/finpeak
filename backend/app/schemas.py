"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


# --- Transactions ---

class TransactionOut(BaseModel):
    id: str
    date: date
    doc_number: Optional[str] = None
    debit: Optional[float] = None
    credit: Optional[float] = None
    signed_amount: float
    counterparty: Optional[str] = None
    counterparty_bin: Optional[str] = None
    payment_description: Optional[str] = None
    knp: Optional[str] = None
    category_name: Optional[str] = None
    category_confidence: float = 0.0
    activity_type: Optional[str] = None
    direction: Optional[str] = None
    categorization_source: Optional[str] = None
    bank: Optional[str] = None
    account_number: Optional[str] = None
    wallet_name: Optional[str] = None

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    category_name: str


class TransactionListResponse(BaseModel):
    transactions: list[TransactionOut]
    total: int
    page: int
    per_page: int


# --- Upload ---

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    bank: str
    account_number: Optional[str] = None
    client_name: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    transaction_count: int
    categorized_count: int
    transactions: list[TransactionOut]


# --- Categories ---

class CategoryOut(BaseModel):
    id: str
    name: str
    group: Optional[str] = None
    activity_type: Optional[str] = None
    description: Optional[str] = None
    category_group: Optional[str] = None

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str
    group: str = ""
    activity_type: str = ""
    description: str = ""
    category_group: str = ""


# --- Reports ---

class PnLRow(BaseModel):
    category: str
    category_group: Optional[str] = None
    activity_type: Optional[str] = None
    direction: Optional[str] = None
    amount: float


class DashboardData(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    income_total: float
    expense_total: float
    net: float
    transaction_count: int
    pnl_rows: list[PnLRow]
    expense_by_category: list[dict]
    monthly_trend: list[dict]
    account_balances: list[dict]
