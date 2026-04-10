"""Parser for Kaspi Bank statement PDFs."""

from __future__ import annotations

import pdfplumber

from .base import Transaction, parse_kz_number, parse_kz_date, clean_counterparty, is_summary_row, is_number_row
from .detect import extract_header


def parse_kaspi(pdf_path: str) -> list[Transaction]:
    """Parse a Kaspi Bank statement PDF into Transaction objects.

    Kaspi table format (9 columns):
    [0] Номер документа
    [1] Дата операции
    [2] Дебет
    [3] Кредит
    [4] Наименование получателя/отправителя + БИН/ИИН
    [5] ИИК бенеф
    [6] БИК банка
    [7] КНП
    [8] Назначение платежа
    """
    header = extract_header(pdf_path, 'kaspi')
    transactions = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 9:
                        continue
                    if _is_header_row(row) or is_number_row(row) or is_summary_row(row):
                        continue
                    # Skip empty rows
                    if not row[1] or not row[1].strip():
                        continue

                    dt = parse_kz_date(row[1])
                    if dt is None:
                        continue

                    name, bin_val = clean_counterparty(row[4])
                    desc = (row[8] or "").replace('\n', ' ').strip()
                    knp = (row[7] or "").strip() if row[7] else None

                    tx = Transaction(
                        date=dt,
                        doc_number=(row[0] or "").replace('\n', '').strip(),
                        debit=parse_kz_number(row[2]),
                        credit=parse_kz_number(row[3]),
                        counterparty=name,
                        counterparty_bin=bin_val,
                        payment_description=desc,
                        knp=knp,
                        bank='kaspi',
                        account=header['account'],
                        client_name=header['client_name'],
                        client_bin=header['client_bin'],
                    )
                    transactions.append(tx)

    return transactions


def _is_header_row(row: list) -> bool:
    """Check if this is a column header row."""
    first = str(row[0] or "").strip().lower()
    return 'номер' in first or 'дата' in first
