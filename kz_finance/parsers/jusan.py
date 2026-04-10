"""Parser for Jusan Bank statement PDFs."""

from __future__ import annotations

from decimal import Decimal

import pdfplumber

from .base import Transaction, parse_kz_number, parse_kz_date, is_summary_row
from .detect import extract_header


def parse_jusan(pdf_path: str) -> list[Transaction]:
    """Parse a Jusan Bank statement PDF into Transaction objects.

    Jusan table format (13 columns):
    [0]  Дата операции
    [1]  Дата отражения по счету
    [2]  № док
    [3]  Дебет
    [4]  Кредит
    [5]  Курс НБ РК
    [6]  Эквивалент в тенге по курсу НБ РК
    [7]  КНП
    [8]  Назначение платежа
    [9]  Корреспондент
    [10] БИН/ИИН
    [11] БИК корр.
    [12] Счет
    """
    header = extract_header(pdf_path, 'jusan')
    transactions = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 13:
                        continue
                    if _is_header_row(row) or is_summary_row(row):
                        continue
                    if not row[0] or not row[0].strip():
                        continue

                    dt = parse_kz_date(row[0])
                    if dt is None:
                        continue

                    debit = parse_kz_number(row[3])
                    credit = parse_kz_number(row[4])
                    # Jusan uses "0,00" for zero amounts - treat as None
                    if debit is not None and debit == Decimal("0"):
                        debit = None
                    if credit is not None and credit == Decimal("0"):
                        credit = None

                    tx = Transaction(
                        date=dt,
                        doc_number=(row[2] or "").replace('\n', '').strip(),
                        debit=debit,
                        credit=credit,
                        counterparty=(row[9] or "").replace('\n', ' ').strip(),
                        counterparty_bin=(row[10] or "").strip() or None,
                        payment_description=(row[8] or "").replace('\n', ' ').strip(),
                        knp=(row[7] or "").strip() or None,
                        bank='jusan',
                        account=header['account'],
                        client_name=header['client_name'],
                        client_bin=header['client_bin'],
                    )
                    transactions.append(tx)

    return transactions


def _is_header_row(row: list) -> bool:
    first = str(row[0] or "").strip().lower()
    return 'дата' in first or 'операции' in first
