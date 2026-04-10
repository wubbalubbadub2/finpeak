"""Parser for ForteBank statement PDFs."""

from __future__ import annotations

import re
from decimal import Decimal

import pdfplumber

from .base import Transaction, parse_kz_number, parse_kz_date, is_summary_row
from .detect import extract_header


def parse_forte(pdf_path: str) -> list[Transaction]:
    """Parse a ForteBank statement PDF into Transaction objects.

    ForteBank table format (9 columns):
    [0] №
    [1] Дата
    [2] Номер документа
    [3] Отправитель (Наименование, БИН, ИИК, БИК)
    [4] Получатель (Наименование, БИН, ИИК, БИК)
    [5] Дебет
    [6] Кредит
    [7] Назначение платежа (complex, may start with "Плательщик:...Получатель:...Назначение:")
    [8] Курс
    """
    header = extract_header(pdf_path, 'forte')
    client_bin = header.get('client_bin', '')
    transactions = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 9:
                        continue
                    if _is_header_row(row) or is_summary_row(row):
                        continue
                    if not row[1] or not row[1].strip():
                        continue

                    dt = parse_kz_date(row[1])
                    if dt is None:
                        continue

                    debit = parse_kz_number(row[5])
                    credit = parse_kz_number(row[6])
                    # ForteBank uses "0,00" for zero amounts
                    if debit is not None and debit == Decimal("0"):
                        debit = None
                    if credit is not None and credit == Decimal("0"):
                        credit = None

                    sender = _parse_entity_cell(row[3] or "")
                    receiver = _parse_entity_cell(row[4] or "")

                    # Determine counterparty by direction
                    if debit and debit > 0:
                        # Client is paying -> counterparty is receiver
                        cp_name = receiver['name']
                        cp_bin = receiver['bin']
                    elif credit and credit > 0:
                        # Client is receiving -> counterparty is sender
                        cp_name = sender['name']
                        cp_bin = sender['bin']
                    else:
                        cp_name = receiver['name'] or sender['name']
                        cp_bin = receiver['bin'] or sender['bin']

                    desc = _clean_forte_description(row[7] or "")

                    tx = Transaction(
                        date=dt,
                        doc_number=(row[2] or "").replace('\n', '').strip(),
                        debit=debit,
                        credit=credit,
                        counterparty=cp_name,
                        counterparty_bin=cp_bin,
                        payment_description=desc,
                        knp=None,  # ForteBank does not have a КНП column
                        bank='forte',
                        account=header['account'],
                        client_name=header['client_name'],
                        client_bin=header['client_bin'],
                    )
                    transactions.append(tx)

    return transactions


def _is_header_row(row: list) -> bool:
    first = str(row[0] or "").strip().lower()
    return first == '№' or 'отправитель' in str(row[3] or "").lower()


def _parse_entity_cell(cell: str) -> dict:
    """Parse a ForteBank sender/receiver cell.

    Format:
        ТОО "DiDi dent"
        БИН: 210740009408
        ИИК: KZ0396507F0008496646
        БИК: IRTYKZKA

    Returns dict with 'name' and 'bin'.
    """
    if not cell:
        return {'name': '', 'bin': None}

    lines = cell.strip().split('\n')
    name = lines[0].strip() if lines else ""
    bin_val = None
    for line in lines[1:]:
        line = line.strip()
        if line.startswith('БИН:'):
            bin_val = line.replace('БИН:', '').strip()
            # Extract just the digits
            m = re.search(r'(\d{12})', bin_val)
            bin_val = m.group(1) if m else bin_val
            break

    return {'name': name, 'bin': bin_val}


def _clean_forte_description(text: str) -> str:
    """Clean ForteBank payment description.

    ForteBank descriptions often have format:
        "Плательщик: X Получатель: Y Назначение: actual description"

    Extract the actual description after "Назначение:" if present.
    """
    text = text.replace('\n', ' ').strip()

    # Try to extract text after "Назначение:" or "Назначение\s*:"
    m = re.search(r'Назначение[:\s]+(.+)', text, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return text
