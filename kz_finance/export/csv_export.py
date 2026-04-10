"""Export transactions to CSV matching the Реестр платежей format."""

from __future__ import annotations

import csv
import io
from typing import TextIO

from ..parsers.base import Transaction

MONTHS_RU = {
    1: "Январь", 2: "Февраль", 3: "Март", 4: "Апрель",
    5: "Май", 6: "Июнь", 7: "Июль", 8: "Август",
    9: "Сентябрь", 10: "Октябрь", 11: "Ноябрь", 12: "Декабрь"
}

CSV_COLUMNS = [
    "Месяц", "Год", "Мсц (цифрой)", "Дата", "Сумма, тенге",
    "Сумма, в валюте", "Валюта", "Обменный курс по банку",
    "Кошелек", "Направление", "Статья", "Филиал",
    "Контрагент", "Назначение платежа", "Прочие комментарии",
    "", "Вид деятельности", "Платеж/поступление"
]


def transactions_to_csv(
    transactions: list[Transaction],
    output: TextIO | None = None,
    wallet_name: str = "",
    branch: str = "Общее",
) -> str:
    """Convert transactions to CSV matching Реестр платежей format.

    Returns CSV string. If output is provided, also writes to it.
    """
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter='\t')
    writer.writerow(CSV_COLUMNS)

    for tx in transactions:
        # Signed amount: positive for credits, negative for debits
        amount = tx.signed_amount
        wallet = wallet_name or tx.account

        # Build counterparty string with BIN appended
        cp = tx.counterparty
        if tx.counterparty_bin:
            cp += f" БИН/ИИН {tx.counterparty_bin}"

        # Build description with КНП appended
        desc = tx.payment_description
        if tx.knp:
            desc += f" кнп {tx.knp}"

        row = [
            MONTHS_RU.get(tx.date.month, ""),
            tx.date.year,
            tx.date.month,
            tx.date.isoformat(),
            str(amount),
            str(amount),
            "ТЕНГЕ",
            "1.0",
            wallet,
            "",  # Направление (empty in ground truth)
            tx.category or "UNCATEGORIZED",
            branch,
            cp,
            desc,
            "",  # Прочие комментарии
            "",  # blank column
            tx.activity_type,
            tx.direction,
        ]
        writer.writerow(row)

    result = buf.getvalue()
    if output:
        output.write(result)
    return result
