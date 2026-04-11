"""SQLAlchemy ORM models."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Column, String, Date, DateTime, Numeric, Text, Float,
    ForeignKey, Index, Boolean, Integer, func
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _uuid():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    bin_iin = Column(String(12))
    api_key = Column(String(64), unique=True, index=True)
    # Supabase auth integration
    supabase_user_id = Column(String(36), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    role = Column(String(20), default="user")  # "super_admin" or "user"
    onboarded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bank_accounts = relationship("BankAccount", back_populates="organization", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="organization", cascade="all, delete-orphan")
    rules = relationship("CategorizationRule", back_populates="organization", cascade="all, delete-orphan")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    account_number = Column(String(34), nullable=False)
    bank = Column(String(20), nullable=False)
    client_name = Column(String(255))
    client_bin = Column(String(12))
    currency = Column(String(3), default="KZT")
    wallet_name = Column(String(255))
    opening_balance = Column(Numeric(15, 2), default=0)  # User-set opening balance
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="bank_accounts")
    transactions = relationship("Transaction", back_populates="bank_account", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=_uuid)
    bank_account_id = Column(String(36), ForeignKey("bank_accounts.id"), nullable=False)
    date = Column(Date, nullable=False)
    doc_number = Column(String(50))
    debit = Column(Numeric(15, 2))
    credit = Column(Numeric(15, 2))
    counterparty = Column(String(500))
    counterparty_bin = Column(String(12))
    payment_description = Column(Text)
    knp = Column(String(10))

    category_id = Column(String(36), ForeignKey("categories.id"))
    category_name = Column(String(255))
    category_confidence = Column(Float, default=0.0)
    activity_type = Column(String(50))
    direction = Column(String(50))
    categorization_source = Column(String(20))  # rule, llm, manual

    source_file = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    bank_account = relationship("BankAccount", back_populates="transactions")
    category = relationship("Category")

    @property
    def signed_amount(self):
        c = self.credit or 0
        d = self.debit or 0
        if c > 0:
            return float(c)
        if d > 0:
            return -float(d)
        return 0.0


class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    group = Column(String(50))          # Поступление / Выбытие
    activity_type = Column(String(50))  # Операционная, etc.
    description = Column(Text)
    category_group = Column(String(100))
    is_active = Column(Boolean, default=True)
    sort_order = Column(Float, default=0)

    organization = relationship("Organization", back_populates="categories")


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    field = Column(String(30), nullable=False)
    pattern = Column(String(500), nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False)
    category_name = Column(String(255))  # denormalized
    source = Column(String(20), default="imported")  # imported, learned
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="rules")
    category = relationship("Category")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False)
    category_name = Column(String(255))  # denormalized
    period = Column(String(7), nullable=False)  # "YYYY-MM"
    amount = Column(Numeric(15, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_budgets_org_period", "organization_id", "period"),
        Index("ix_budgets_unique", "organization_id", "category_id", "period", unique=True),
    )


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    bank = Column(String(20))
    account_number = Column(String(34))
    period_start = Column(Date)
    period_end = Column(Date)
    transaction_count = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    error_message = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
