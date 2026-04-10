"""Parser for Halyk Bank (Народный Банк) statement PDFs."""

from __future__ import annotations

import re

import pdfplumber

from .base import Transaction, parse_kz_number, parse_kz_date, clean_counterparty, is_summary_row
from .detect import extract_header


def parse_halyk(pdf_path: str) -> list[Transaction]:
    """Parse a Halyk Bank statement PDF into Transaction objects.

    Halyk table format (6 columns):
    [0] Дата
    [1] Номер документа
    [2] Дебет
    [3] Кредит
    [4] Контрагент (with BIN embedded)
    [5] Детали платежа (with "Референс XXXX" prefix)
    """
    header = extract_header(pdf_path, 'halyk')
    transactions = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 6:
                        continue
                    if _is_header_row(row) or is_summary_row(row):
                        continue
                    if _is_balance_row(row):
                        continue
                    # Skip empty date rows
                    if not row[0] or not row[0].strip():
                        continue

                    dt = parse_kz_date(row[0])
                    if dt is None:
                        continue

                    name, bin_val = clean_counterparty(row[4])
                    desc = _strip_referens(row[5] or "")

                    tx = Transaction(
                        date=dt,
                        doc_number=(row[1] or "").replace('\n', '').strip(),
                        debit=parse_kz_number(row[2]),
                        credit=parse_kz_number(row[3]),
                        counterparty=name,
                        counterparty_bin=bin_val,
                        payment_description=desc,
                        knp=None,  # Halyk does not provide КНП in a column
                        bank='halyk',
                        account=header['account'],
                        client_name=header['client_name'],
                        client_bin=header['client_bin'],
                    )
                    transactions.append(tx)

    return transactions


def _is_header_row(row: list) -> bool:
    first = str(row[0] or "").strip().lower()
    return first.startswith('дата') or 'номер' in first


def _is_balance_row(row: list) -> bool:
    """Skip balance/footer rows like 'Входящий остаток:', 'Дата остатка:'."""
    first = str(row[0] or "").strip().lower()
    return 'входящий' in first or 'исходящий' in first or 'дата остатка' in first or 'эквивалент' in first


def _strip_referens(text: str) -> str:
    """Remove 'Референс XXXXXXXXXX ' prefix from payment details."""
    text = text.replace('\n', ' ').strip()
    text = re.sub(r'^Референс\s+\d+\s*', '', text)
    return text.strip()
