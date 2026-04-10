"""Google Sheets sync service."""

from __future__ import annotations

import os
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials

from kz_finance.export.csv_export import MONTHS_RU

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
DEFAULT_CREDS_PATH = str(Path(__file__).parent.parent.parent.parent / 'google-credentials.json')
DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1urzsZpEnBtp-z74OdBfyUwdSxhX3nIa576k7BAn3Vjo/edit'
WORKSHEET_NAME = 'Реестр платежей'


def get_client(creds_path: str | None = None) -> gspread.Client:
    path = creds_path or os.environ.get('GOOGLE_CREDENTIALS_PATH', DEFAULT_CREDS_PATH)
    creds = Credentials.from_service_account_file(path, scopes=SCOPES)
    return gspread.authorize(creds)


def export_transactions_to_sheets(
    transactions: list[dict],
    sheet_url: str | None = None,
    worksheet_name: str = WORKSHEET_NAME,
    creds_path: str | None = None,
) -> dict:
    """Export transactions to Google Sheets in Реестр платежей format.

    Args:
        transactions: list of dicts with keys from the Transaction model
        sheet_url: Google Sheets URL (uses default if not provided)
        worksheet_name: target worksheet name
        creds_path: path to service account credentials JSON

    Returns:
        dict with status, rows_written, sheet_url
    """
    gc = get_client(creds_path)
    url = sheet_url or DEFAULT_SHEET_URL
    sh = gc.open_by_url(url)

    # Use a dedicated export worksheet to avoid overwriting existing data
    export_ws_name = "KZ Finance Export"
    try:
        ws = sh.worksheet(export_ws_name)
        ws.clear()
    except gspread.exceptions.WorksheetNotFound:
        ws = sh.add_worksheet(title=export_ws_name, rows=max(len(transactions) + 10, 1000), cols=20)

    # Write header row
    header = [
        "Месяц", "Год", "Мсц", "Дата", "Сумма, тенге",
        "Сумма, в валюте", "Валюта", "Курс",
        "Кошелек", "Направление", "Статья", "Филиал",
        "Контрагент", "Назначение платежа", "Комментарии",
        "", "Вид деятельности", "Платеж/поступление"
    ]
    ws.update('A1', [header], value_input_option='USER_ENTERED')
    start_row = 2

    # Build rows in Реестр платежей format
    rows = []
    for tx in transactions:
        date_val = tx.get('date')
        month_num = None
        year = None
        if date_val:
            if hasattr(date_val, 'month'):
                month_num = date_val.month
                year = date_val.year
            elif isinstance(date_val, str) and len(date_val) >= 10:
                parts = date_val.split('-')
                if len(parts) == 3:
                    year = int(parts[0])
                    month_num = int(parts[1])

        # Signed amount: positive for credits, negative for debits
        debit = float(tx.get('debit') or 0)
        credit = float(tx.get('credit') or 0)
        amount = credit - debit if credit > 0 else -debit

        counterparty = tx.get('counterparty', '')
        bin_val = tx.get('counterparty_bin', '')
        if bin_val:
            counterparty += f' БИН/ИИН {bin_val}'

        description = tx.get('payment_description', '')
        knp = tx.get('knp', '')
        if knp:
            description += f' кнп {knp}'

        row = [
            MONTHS_RU.get(month_num, '') if month_num else '',  # Месяц
            year or '',                                          # Год
            month_num or '',                                     # Мсц (цифрой)
            str(date_val) if date_val else '',                  # Дата
            amount,                                              # Сумма, тенге
            amount,                                              # Сумма, в валюте
            'ТЕНГЕ',                                            # Валюта
            1.0,                                                 # Обменный курс
            tx.get('wallet_name', ''),                          # Кошелек
            '',                                                  # Направление
            tx.get('category_name', 'UNCATEGORIZED'),           # Статья
            '',                                                  # Филиал
            counterparty,                                        # Контрагент
            description,                                         # Назначение платежа
            '',                                                  # Прочие комментарии
            '',                                                  # blank
            tx.get('activity_type', ''),                        # Вид деятельности
            tx.get('direction', ''),                            # Платеж/поступление
        ]
        rows.append(row)

    if rows:
        ws.update(f'A{start_row}', rows, value_input_option='USER_ENTERED')

    return {
        'status': 'success',
        'rows_written': len(rows),
        'sheet_url': url,
        'worksheet': worksheet_name,
        'start_row': start_row,
    }
