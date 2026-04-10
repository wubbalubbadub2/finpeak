"""Terminal P&L summary report."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from ..parsers.base import Transaction


def print_summary(transactions: list[Transaction], client_name: str = "", period: str = ""):
    """Print a formatted P&L summary to the terminal."""
    if not transactions:
        print("No transactions to summarize.")
        return

    # Group by activity_type -> direction -> category
    income_by_cat: dict[str, Decimal] = defaultdict(Decimal)
    expense_by_cat: dict[str, Decimal] = defaultdict(Decimal)
    uncategorized = Decimal("0")

    for tx in transactions:
        amount = tx.signed_amount
        if not tx.category:
            uncategorized += amount
            continue

        if tx.direction == "Поступление":
            income_by_cat[tx.category] += amount
        elif tx.direction == "Выбытие":
            expense_by_cat[tx.category] += amount
        else:
            # If direction is not set, use sign
            if amount > 0:
                income_by_cat[tx.category] += amount
            else:
                expense_by_cat[tx.category] += amount

    total_income = sum(income_by_cat.values())
    total_expense = sum(expense_by_cat.values())
    net = total_income + total_expense  # expenses are already negative

    # Print
    title = f"P&L Summary"
    if client_name:
        title += f": {client_name}"
    if period:
        title += f" ({period})"

    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"  {len(transactions)} transactions")
    print(f"{'=' * 70}")

    if income_by_cat:
        print(f"\n  ПОСТУПЛЕНИЯ (Income):")
        print(f"  {'─' * 60}")
        for cat, amount in sorted(income_by_cat.items(), key=lambda x: -x[1]):
            print(f"    {cat:45} {_fmt(amount):>12}")
        print(f"  {'─' * 60}")
        print(f"    {'TOTAL INCOME':45} {_fmt(total_income):>12}")

    if expense_by_cat:
        print(f"\n  ВЫБЫТИЕ (Expenses):")
        print(f"  {'─' * 60}")
        for cat, amount in sorted(expense_by_cat.items(), key=lambda x: x[1]):
            print(f"    {cat:45} {_fmt(amount):>12}")
        print(f"  {'─' * 60}")
        print(f"    {'TOTAL EXPENSES':45} {_fmt(total_expense):>12}")

    if uncategorized != 0:
        print(f"\n    {'UNCATEGORIZED':45} {_fmt(uncategorized):>12}")

    print(f"\n  {'=' * 60}")
    print(f"    {'NET RESULT':45} {_fmt(net):>12}")
    print(f"  {'=' * 60}\n")


def _fmt(amount: Decimal) -> str:
    """Format amount with thousands separator."""
    sign = "-" if amount < 0 else ""
    abs_val = abs(amount)
    int_part = int(abs_val)
    frac_part = abs_val - int_part

    # Format integer part with commas
    int_str = f"{int_part:,}"
    if frac_part > 0:
        frac_str = f"{frac_part:.2f}"[1:]  # ".XX"
        return f"{sign}{int_str}{frac_str}"
    return f"{sign}{int_str}.00"
