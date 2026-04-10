"""Parsing service: wraps Phase 1 kz_finance parsers for the web API."""

from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy.orm import Session

from kz_finance.parsers.detect import detect_bank, extract_header
from kz_finance.parsers.kaspi import parse_kaspi
from kz_finance.parsers.halyk import parse_halyk
from kz_finance.parsers.jusan import parse_jusan
from kz_finance.parsers.forte import parse_forte
from kz_finance.categorizer.rules import RuleCategorizer
from kz_finance.categorizer.llm import LLMCategorizer
from kz_finance.parsers.base import Transaction as TxDataclass, parse_kz_date

from ..models import Transaction, BankAccount, UploadedFile, Category

PARSERS = {
    'kaspi': parse_kaspi,
    'halyk': parse_halyk,
    'jusan': parse_jusan,
    'forte': parse_forte,
}


def process_upload(
    db: Session,
    org_id: str,
    file_path: str,
    filename: str,
) -> tuple[UploadedFile, list[Transaction]]:
    """Full upload pipeline: detect -> parse -> categorize -> store in DB."""

    # 1. Detect bank
    bank = detect_bank(file_path)
    header = extract_header(file_path, bank)

    # 2. Get or create BankAccount
    account_number = header.get('account', '')
    account = db.query(BankAccount).filter_by(
        organization_id=org_id,
        account_number=account_number,
    ).first()
    if not account:
        account = BankAccount(
            organization_id=org_id,
            account_number=account_number,
            bank=bank,
            client_name=header.get('client_name', ''),
            client_bin=header.get('client_bin', ''),
            currency=header.get('currency', 'KZT'),
            wallet_name=header.get('client_name', account_number),
        )
        db.add(account)
        db.flush()

    # 3. Parse with Phase 1 parsers
    parser = PARSERS[bank]
    raw_txs: list[TxDataclass] = parser(file_path)

    # 4. Categorize with Phase 1 categorizer
    categorizer = RuleCategorizer()
    llm_cat = LLMCategorizer([c['name'] for c in categorizer.categories])

    unmatched = []
    for tx in raw_txs:
        categorizer.apply(tx)
        if not tx.category:
            unmatched.append(tx)

    if unmatched:
        results = llm_cat.categorize_all(unmatched)
        for tx, cat in zip(unmatched, results):
            if cat:
                tx.category = cat
                tx.category_confidence = 0.8
                meta = categorizer.get_category_metadata(cat)
                tx.activity_type = meta.get('activity_type', '')
                tx.direction = meta.get('group', '')

    # 5. Build category lookup
    cat_map = {}
    for c in db.query(Category).filter_by(organization_id=org_id).all():
        cat_map[c.name] = c.id

    # 6. Store transactions
    db_txs = []
    for tx in raw_txs:
        source = "rule" if tx.category_confidence == 1.0 else (
            "llm" if tx.category_confidence > 0 else None
        )
        db_tx = Transaction(
            bank_account_id=account.id,
            date=tx.date,
            doc_number=tx.doc_number,
            debit=float(tx.debit) if tx.debit else None,
            credit=float(tx.credit) if tx.credit else None,
            counterparty=tx.counterparty,
            counterparty_bin=tx.counterparty_bin,
            payment_description=tx.payment_description,
            knp=tx.knp,
            category_id=cat_map.get(tx.category),
            category_name=tx.category or None,
            category_confidence=tx.category_confidence,
            activity_type=tx.activity_type,
            direction=tx.direction,
            categorization_source=source,
            source_file=filename,
        )
        db.add(db_tx)
        db_txs.append(db_tx)

    # 7. Create upload record
    upload_rec = UploadedFile(
        organization_id=org_id,
        filename=filename,
        bank=bank,
        account_number=account_number,
        period_start=_parse_date(header.get('period_start')),
        period_end=_parse_date(header.get('period_end')),
        transaction_count=len(raw_txs),
        status="completed",
    )
    db.add(upload_rec)
    db.commit()

    # Refresh to get IDs
    for tx in db_txs:
        db.refresh(tx)
    db.refresh(upload_rec)

    return upload_rec, db_txs


def _parse_date(s):
    if not s:
        return None
    d = parse_kz_date(s)
    return d
