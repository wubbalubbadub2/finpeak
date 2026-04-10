"""Auto-detect bank from PDF and extract header metadata."""

from __future__ import annotations

import re
from typing import Optional

import pdfplumber


def detect_bank(pdf_path: str) -> str:
    """Detect which bank issued the statement by reading page 0 text.

    Returns one of: 'kaspi', 'halyk', 'jusan', 'forte'.
    Raises ValueError if unrecognized.
    """
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""

    text_lower = text.lower()
    # Use header-specific patterns to avoid matching counterparty BIK codes in transaction data
    # Check first ~500 chars (header area) for bank identification
    header_text = text[:500].lower()

    if 'jusan' in header_text:
        return 'jusan'
    if 'fortebank' in header_text or 'forte bank' in header_text:
        return 'forte'
    # Halyk: header explicitly says "Народный Банк" or "ВЫПИСКА ПО СЧЕТУ" with HSBKKZKX in header
    if 'народный банк' in header_text or 'выписка по счету' in header_text:
        return 'halyk'
    # Kaspi: header has "Наименование клиента:" (unique to Kaspi) or "Лицевой счет:" without other bank names
    if 'наименование клиента:' in header_text or ('лицевой счет:' in header_text and 'народный' not in header_text):
        return 'kaspi'

    raise ValueError(f"Could not detect bank from PDF: {pdf_path}")


def extract_header(pdf_path: str, bank: str) -> dict:
    """Extract header metadata from the first page of a bank statement.

    Returns dict with keys: account, client_name, client_bin, currency,
    period_start, period_end, opening_balance, closing_balance.
    """
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""

    if bank == 'kaspi':
        return _extract_kaspi_header(text)
    elif bank == 'halyk':
        return _extract_halyk_header(text)
    elif bank == 'jusan':
        return _extract_jusan_header(text)
    elif bank == 'forte':
        return _extract_forte_header(text)
    else:
        raise ValueError(f"Unknown bank: {bank}")


def _search(pattern: str, text: str, default: str = "") -> str:
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(1).strip() if m else default


def _extract_kaspi_header(text: str) -> dict:
    return {
        'account': _search(r'Лицевой счет:\s*(KZ\w+)', text),
        'client_name': _search(r'Наименование клиента:\s*(.+?)(?:\n|$)', text),
        'client_bin': _search(r'ИИН/?БИН:\s*(\d+)', text),
        'currency': _search(r'Валюта счета:\s*(\w+)', text, 'KZT'),
        'period_start': _search(r'Период:\s*(\d{2}\.\d{2}\.\d{4})', text),
        'period_end': _search(r'Период:\s*\d{2}\.\d{2}\.\d{4}\s*-\s*(\d{2}\.\d{2}\.\d{4})', text),
        'opening_balance': _search(r'Входящий остаток\s*([\d\s,\.]+)', text),
        'closing_balance': _search(r'Исходящий остаток\s*([\d\s,\.]+)', text),
    }


def _extract_halyk_header(text: str) -> dict:
    # Halyk format: "За период с 01.04.2024 по30.04.2024" (note possible missing space)
    return {
        'account': _search(r'Счет\s*\(Валюта\)\s*(KZ\w+)', text) or _search(r'(KZ\w{18,})', text),
        'client_name': _search(r'Клиент\s+(.+?)(?:\n|ИИН)', text),
        'client_bin': _search(r'ИИН/БИН\s+(\d+)', text),
        'currency': _search(r'\((\w{3})\)', text, 'KZT'),
        'period_start': _search(r'период с\s*(\d{2}\.\d{2}\.\d{4})', text),
        'period_end': _search(r'по\s*(\d{2}\.\d{2}\.\d{4})', text),
        'opening_balance': _search(r'Входящий остаток:\s*([\d\s,\.]+)', text),
        'closing_balance': '',
    }


def _extract_jusan_header(text: str) -> dict:
    return {
        'account': _search(r'Лицевой счет:\s*(KZ\w+)', text),
        'client_name': _search(r'Клиент:\s*(.+?)(?:\n|ИИН)', text),
        'client_bin': _search(r'ИИН\s*\(БИН\):\s*(\d+)', text),
        'currency': _search(r'(KZT|USD|EUR|RUB)', text, 'KZT'),
        'period_start': _search(r'период с\s*(\d{2}\.\d{2}\.\d{4})', text),
        'period_end': _search(r'по\s*(\d{2}\.\d{2}\.\d{4})', text),
        'opening_balance': _search(r'Входящий остаток:\s*([\d\s,\.]+)', text),
        'closing_balance': _search(r'Исходящий остаток:\s*([\d\s,\.]+)', text),
    }


def _extract_forte_header(text: str) -> dict:
    return {
        'account': _search(r'ИИК:\s*(KZ\w+)', text),
        'client_name': _search(r'Клиент:\s*(.+?)(?:\n|Банк|Адрес)', text),
        'client_bin': _search(r'БИН/ИИН:\s*(\d+)', text),
        'currency': _search(r'Валюта:\s*(\w+)', text, 'KZT'),
        'period_start': _search(r'период с\s*(\d{2}\.\d{2}\.\d{4})', text),
        'period_end': _search(r'по\s*(\d{2}\.\d{2}\.\d{4})', text),
        'opening_balance': _search(r'Входящий остаток:\s*([\d\s,\.]+)', text),
        'closing_balance': '',
    }
