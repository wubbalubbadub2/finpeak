"""Base transaction dataclass and shared parsing utilities."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional


@dataclass
class Transaction:
    """Normalized transaction extracted from a bank statement PDF."""
    date: date
    doc_number: str = ""
    debit: Optional[Decimal] = None     # Money leaving the account
    credit: Optional[Decimal] = None    # Money entering the account
    counterparty: str = ""
    counterparty_bin: Optional[str] = None
    payment_description: str = ""
    knp: Optional[str] = None           # КНП payment code
    bank: str = ""                      # kaspi, halyk, jusan, forte
    account: str = ""                   # IBAN from PDF header
    client_name: str = ""
    client_bin: str = ""
    # Set by categorizer
    category: str = ""
    category_confidence: float = 0.0
    activity_type: str = ""             # Операционная, Инвестиционная, Финансовая, Техническая операция
    direction: str = ""                 # Поступление / Выбытие

    @property
    def signed_amount(self) -> Decimal:
        """Positive for credits (income), negative for debits (expense)."""
        if self.credit and self.credit > 0:
            return self.credit
        if self.debit and self.debit > 0:
            return -self.debit
        return Decimal("0")


def parse_kz_number(s: str | None) -> Optional[Decimal]:
    """Parse Kazakh number format: spaces as thousands, comma as decimal.

    Examples:
        "694 800" -> Decimal("694800")
        "5 355,93" -> Decimal("5355.93")
        "102 240,00" -> Decimal("102240.00")
        "" -> None
        None -> None
        "0,00" -> Decimal("0.00")
    """
    if s is None:
        return None
    s = s.strip()
    if not s:
        return None
    # Remove all whitespace (regular spaces, non-breaking spaces, etc.)
    s = re.sub(r'[\s\xa0]+', '', s)
    # Replace comma with dot for decimal
    s = s.replace(',', '.')
    # Remove any trailing dots
    s = s.rstrip('.')
    if not s or s == '-':
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def parse_kz_date(s: str | None) -> Optional[date]:
    """Parse Kazakh date format: DD.MM.YYYY, possibly with time appended.

    Examples:
        "05.03.2024" -> date(2024, 3, 5)
        "05.03.2024\\n23:59:59" -> date(2024, 3, 5)
        "2025-01-27" -> date(2025, 1, 27)
        "05.03.2024 00:00:00" -> date(2024, 3, 5)
    """
    if s is None:
        return None
    s = s.strip()
    # Take only the date part (before newline or space with time)
    date_str = re.split(r'[\n\s]+', s)[0]

    # Try DD.MM.YYYY
    try:
        return datetime.strptime(date_str, '%d.%m.%Y').date()
    except ValueError:
        pass
    # Try YYYY-MM-DD
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        pass
    return None


def clean_counterparty(raw: str | None) -> tuple[str, Optional[str]]:
    """Extract counterparty name and BIN/IIN from combined field.

    Handles formats:
        "ТОО Kaspi Pay БИН/ИИН\\n200840000951" -> ("ТОО Kaspi Pay", "200840000951")
        "ТОО NLS KAZAKHSTAN\\nБИН 081040014026" -> ("ТОО NLS KAZAKHSTAN", "081040014026")
        "Камилла Бахрамовна С." -> ("Камилла Бахрамовна С.", None)
    """
    if not raw:
        return ("", None)

    raw = raw.strip()

    # Pattern 1: "БИН/ИИН" followed by number (Kaspi format)
    m = re.split(r'БИН/ИИН\s*', raw, maxsplit=1)
    if len(m) == 2:
        name = m[0].replace('\n', ' ').strip()
        bin_val = re.search(r'(\d{12})', m[1])
        return (name, bin_val.group(1) if bin_val else None)

    # Pattern 2: "БИН " followed by number (Halyk format)
    m = re.split(r'\nБИН\s+', raw, maxsplit=1)
    if len(m) == 2:
        name = m[0].replace('\n', ' ').strip()
        bin_val = re.search(r'(\d{12})', m[1])
        return (name, bin_val.group(1) if bin_val else None)

    # Pattern 3: "БИН:" followed by number (ForteBank format)
    m = re.split(r'\nБИН:\s*', raw, maxsplit=1)
    if len(m) == 2:
        name = m[0].replace('\n', ' ').strip()
        bin_val = re.search(r'(\d{12})', m[1])
        return (name, bin_val.group(1) if bin_val else None)

    # No BIN found
    name = raw.replace('\n', ' ').strip()
    return (name, None)


# Patterns that indicate a summary/total row to skip
_SUMMARY_PATTERNS = [
    'итого', 'обороты', 'айналым', 'turnover',
    'входящий остаток', 'исходящий остаток',
]

def is_summary_row(row: list) -> bool:
    """Check if a table row is a summary/footer row that should be skipped."""
    if not row or not row[0]:
        return False
    first_cell = str(row[0]).strip().lower()
    return any(p in first_cell for p in _SUMMARY_PATTERNS)


def is_number_row(row: list) -> bool:
    """Check if a row is just column numbers like ['1', '2', '3', ...]."""
    if not row or len(row) < 3:
        return False
    try:
        vals = [str(c).strip() for c in row if c]
        return all(v.isdigit() and int(v) <= 20 for v in vals[:5])
    except (ValueError, TypeError):
        return False
