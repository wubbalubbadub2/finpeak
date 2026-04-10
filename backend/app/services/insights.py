"""AI Insights: anomaly detection, spending trends, cash runway."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from ..models import Transaction, BankAccount


def compute_insights(db: Session, org_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    q = db.query(Transaction).join(BankAccount).filter(BankAccount.organization_id == org_id)
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    txs = q.all()

    return {
        "anomalies": _detect_anomalies(txs),
        "trends": _compute_trends(txs),
        "cash_runway": _compute_runway(txs),
    }


def _detect_anomalies(txs: list[Transaction]) -> list[dict]:
    by_cat: dict[str, list[tuple[Transaction, float]]] = defaultdict(list)
    for tx in txs:
        cat = tx.category_name or "UNCATEGORIZED"
        amt = abs(tx.signed_amount)
        if amt > 0:
            by_cat[cat].append((tx, amt))

    anomalies = []
    for cat, items in by_cat.items():
        if len(items) < 3:
            continue
        amounts = [a for _, a in items]
        avg = sum(amounts) / len(amounts)
        if avg == 0:
            continue
        stddev = math.sqrt(sum((a - avg) ** 2 for a in amounts) / len(amounts))
        threshold = avg + 2 * stddev

        for tx, amt in items:
            if amt > threshold and stddev > 0:
                ratio = round(amt / avg, 1)
                anomalies.append({
                    "date": tx.date.isoformat(),
                    "amount": tx.signed_amount,
                    "category": cat,
                    "counterparty": tx.counterparty,
                    "reason": f"{ratio}x выше среднего для этой категории",
                })

    anomalies.sort(key=lambda a: abs(a["amount"]), reverse=True)
    return anomalies[:5]


def _compute_trends(txs: list[Transaction]) -> list[dict]:
    if not txs:
        return []

    months_seen = set()
    for tx in txs:
        months_seen.add((tx.date.year, tx.date.month))
    if len(months_seen) < 2:
        return []

    sorted_months = sorted(months_seen, reverse=True)
    current_ym, previous_ym = sorted_months[0], sorted_months[1]

    current_by_cat: dict[str, float] = defaultdict(float)
    previous_by_cat: dict[str, float] = defaultdict(float)
    for tx in txs:
        cat = tx.category_name or "UNCATEGORIZED"
        ym = (tx.date.year, tx.date.month)
        amt = abs(tx.signed_amount)
        if ym == current_ym:
            current_by_cat[cat] += amt
        elif ym == previous_ym:
            previous_by_cat[cat] += amt

    trends = []
    for cat in set(current_by_cat) | set(previous_by_cat):
        cur = current_by_cat.get(cat, 0.0)
        prev = previous_by_cat.get(cat, 0.0)
        if prev == 0 and cur == 0:
            continue
        change_pct = 100.0 if prev == 0 else round(((cur - prev) / prev) * 100, 1)
        if abs(change_pct) > 20:
            trends.append({
                "category": cat,
                "current": round(cur, 2),
                "previous": round(prev, 2),
                "change_pct": change_pct,
                "direction": "up" if change_pct > 0 else "down",
            })

    trends.sort(key=lambda t: abs(t["change_pct"]), reverse=True)
    return trends


def _compute_runway(txs: list[Transaction]) -> dict:
    if not txs:
        return {"balance": 0, "avg_monthly_net": 0, "runway_months": None, "burn_rate": 0}

    balance = sum(tx.signed_amount for tx in txs)
    monthly_net: dict[str, float] = defaultdict(float)
    monthly_expense: dict[str, float] = defaultdict(float)
    for tx in txs:
        key = tx.date.strftime("%Y-%m")
        monthly_net[key] += tx.signed_amount
        if tx.debit and float(tx.debit) > 0:
            monthly_expense[key] += float(tx.debit)

    n = len(monthly_net) or 1
    avg_net = sum(monthly_net.values()) / n
    burn = sum(monthly_expense.values()) / n
    runway = round(abs(balance / avg_net), 1) if avg_net < 0 and balance > 0 else None

    return {"balance": round(balance, 2), "avg_monthly_net": round(avg_net, 2), "runway_months": runway, "burn_rate": round(burn, 2)}
