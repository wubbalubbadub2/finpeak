"""Report generation: Cash Flow, P&L, Expense Analytics."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from ..models import Transaction, BankAccount

# Category groups from the Excel structure
CATEGORY_GROUPS = {
    "Расходы на сотрудников": ["З/п директора", "З/п менеджеров по продажам", "З/п управляющего", "З/п ОМ",
                                "Бонусы менеджеров по продажам", "Бонусы управляющего", "Услуги бухгалтера", "Налоги на ФОТ"],
    "Расходы на товар": ["Расходы на закуп", "Расходы на упаковку", "Расходы за доставку до Казахстана",
                         "Закуп коробок", "Расходы на пошив одежды"],
    "Коммерческие расходы": ["Расходы на фотосессию", "Расходы на таргет", "Расходы на маркетинг",
                             "Представительские расходы-производство"],
    "Расходы на содержание магазина": ["Коммунальные услуги", "Услуга связи", "Прочие административные расходы",
                                       "Расходы на страхование помещения"],
    "Расходы на бизнес": ["Доставка по городу", "IT инфраструктура-адм", "Комиссия банка", "Консультационные и проф услуги",
                          "Налоги на прибыль", "Командировочные расходы", "Налог на имущество", "Пеня за налоги и %",
                          "Расходы на открытие новой точки", "Непредвиденные расходы", "Закуп инвентаря",
                          "Курсовая разница", "% по кредитам", "Эквайринг, % за рассрочку",
                          "Доход от неоперационной деятельности"],
    "Поступления ДС": ["Поступление от реализации товаров", "Возврат товара", "Продажа сертификатов"],
}

COGS_CATEGORIES = {"Расходы на закуп", "Расходы на упаковку", "Расходы за доставку до Казахстана",
                   "Закуп коробок", "Расходы на пошив одежды"}
OPEX_GROUPS = {"Расходы на сотрудников", "Коммерческие расходы", "Расходы на содержание магазина", "Расходы на бизнес"}


def _load_txs(db: Session, org_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None):
    q = db.query(Transaction).join(BankAccount).filter(BankAccount.organization_id == org_id)
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    return q.order_by(Transaction.date).all()


def cash_flow_report(db: Session, org_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """Cash Flow Statement (ДДС) grouped by category group and month."""
    txs = _load_txs(db, org_id, date_from, date_to)
    if not txs:
        return {"months": [], "sections": [], "total_by_month": {}}

    # Collect months
    months = sorted(set(tx.date.strftime("%Y-%m") for tx in txs))

    # Group by activity_type -> category_group -> category -> month
    sections = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    totals_by_month = defaultdict(float)

    for tx in txs:
        m = tx.date.strftime("%Y-%m")
        cat = tx.category_name or "Прочее"
        activity = tx.activity_type or "Операционная"
        # Determine category group
        cat_group = "Прочее"
        for group, cats in CATEGORY_GROUPS.items():
            if cat in cats:
                cat_group = group
                break

        sections[activity][cat_group][cat + "|" + m] = sections[activity][cat_group].get(cat + "|" + m, 0) + tx.signed_amount
        totals_by_month[m] += tx.signed_amount

    # Build structured output
    result_sections = []
    for activity in ["Операционная", "Инвестиционная", "Финансовая", "Техническая операция"]:
        if activity not in sections:
            continue
        groups = []
        for group_name, cat_data in sections[activity].items():
            # Aggregate by category and month
            cats_by_month = defaultdict(lambda: defaultdict(float))
            for key, val in cat_data.items():
                cat_name, month = key.rsplit("|", 1)
                cats_by_month[cat_name][month] += val

            rows = []
            group_totals = defaultdict(float)
            for cat_name, month_vals in sorted(cats_by_month.items()):
                row = {"category": cat_name, "values": {}}
                for m in months:
                    v = month_vals.get(m, 0)
                    row["values"][m] = round(v, 2)
                    group_totals[m] += v
                rows.append(row)

            groups.append({
                "name": group_name,
                "rows": rows,
                "totals": {m: round(group_totals[m], 2) for m in months},
            })
        result_sections.append({"activity": activity, "groups": groups})

    return {
        "months": months,
        "sections": result_sections,
        "total_by_month": {m: round(totals_by_month[m], 2) for m in months},
    }


def pnl_report(db: Session, org_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """Profit & Loss statement by month."""
    txs = _load_txs(db, org_id, date_from, date_to)
    if not txs:
        return {"months": [], "rows": []}

    months = sorted(set(tx.date.strftime("%Y-%m") for tx in txs))

    revenue = defaultdict(float)
    cogs = defaultdict(float)
    opex_by_group = defaultdict(lambda: defaultdict(float))
    financial = defaultdict(float)

    for tx in txs:
        m = tx.date.strftime("%Y-%m")
        cat = tx.category_name or ""
        amt = tx.signed_amount

        if cat in ("Поступление от реализации товаров", "Продажа сертификатов"):
            revenue[m] += amt
        elif cat == "Возврат товара":
            revenue[m] += amt  # negative
        elif cat in COGS_CATEGORIES:
            cogs[m] += abs(amt)
        elif tx.activity_type == "Финансовая":
            financial[m] += amt
        else:
            # Determine opex group
            for group, cats in CATEGORY_GROUPS.items():
                if cat in cats and group in OPEX_GROUPS:
                    opex_by_group[group][m] += abs(amt)
                    break

    rows = []
    # Revenue
    rows.append({"label": "Выручка", "type": "header", "values": {m: round(revenue[m], 2) for m in months}})
    # COGS
    rows.append({"label": "Себестоимость товаров", "type": "expense", "values": {m: round(-cogs[m], 2) for m in months}})
    # Gross profit
    rows.append({"label": "Валовая прибыль", "type": "subtotal", "values": {m: round(revenue[m] - cogs[m], 2) for m in months}})

    # OpEx by group
    total_opex = defaultdict(float)
    for group in ["Расходы на сотрудников", "Коммерческие расходы", "Расходы на содержание магазина", "Расходы на бизнес"]:
        vals = opex_by_group.get(group, {})
        rows.append({"label": group, "type": "expense", "values": {m: round(-vals.get(m, 0), 2) for m in months}})
        for m in months:
            total_opex[m] += vals.get(m, 0)

    rows.append({"label": "Итого операционные расходы", "type": "subtotal_neg", "values": {m: round(-total_opex[m], 2) for m in months}})

    # Operating profit
    op_profit = {m: round(revenue[m] - cogs[m] - total_opex[m], 2) for m in months}
    rows.append({"label": "Операционная прибыль", "type": "subtotal", "values": op_profit})

    # Financial
    rows.append({"label": "Финансовая деятельность", "type": "line", "values": {m: round(financial[m], 2) for m in months}})

    # Net profit
    rows.append({"label": "Чистая прибыль", "type": "total", "values": {m: round(op_profit[m] + financial[m], 2) for m in months}})

    return {"months": months, "rows": rows}


def expense_analytics(db: Session, org_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """Expense analytics: category %, top counterparties, MoM changes."""
    txs = _load_txs(db, org_id, date_from, date_to)
    if not txs:
        return {"by_category": [], "top_counterparties": [], "mom_changes": [], "total_revenue": 0, "total_expenses": 0}

    total_revenue = sum(float(tx.credit or 0) for tx in txs)
    total_expenses = sum(float(tx.debit or 0) for tx in txs)

    # By category with % of revenue
    by_cat = defaultdict(float)
    for tx in txs:
        if tx.debit and float(tx.debit) > 0:
            by_cat[tx.category_name or "Прочее"] += float(tx.debit)

    by_category = sorted([
        {"category": cat, "amount": round(amt, 2), "pct_of_revenue": round(amt / total_revenue * 100, 1) if total_revenue > 0 else 0}
        for cat, amt in by_cat.items()
    ], key=lambda x: -x["amount"])

    # Top counterparties by spend
    by_cp = defaultdict(float)
    for tx in txs:
        if tx.debit and float(tx.debit) > 0 and tx.counterparty:
            by_cp[tx.counterparty] += float(tx.debit)

    top_cp = sorted([
        {"counterparty": cp, "amount": round(amt, 2), "pct_of_expenses": round(amt / total_expenses * 100, 1) if total_expenses > 0 else 0}
        for cp, amt in by_cp.items()
    ], key=lambda x: -x["amount"])[:10]

    # Month-over-month changes
    months = sorted(set(tx.date.strftime("%Y-%m") for tx in txs))
    monthly_by_cat = defaultdict(lambda: defaultdict(float))
    for tx in txs:
        if tx.debit and float(tx.debit) > 0:
            monthly_by_cat[tx.category_name or "Прочее"][tx.date.strftime("%Y-%m")] += float(tx.debit)

    mom = []
    if len(months) >= 2:
        cur_m, prev_m = months[-1], months[-2]
        for cat, month_data in monthly_by_cat.items():
            cur = month_data.get(cur_m, 0)
            prev = month_data.get(prev_m, 0)
            if prev > 0:
                change = round(((cur - prev) / prev) * 100, 1)
                mom.append({"category": cat, "current": round(cur, 2), "previous": round(prev, 2), "change_pct": change})
        mom.sort(key=lambda x: abs(x["change_pct"]), reverse=True)

    return {
        "by_category": by_category,
        "top_counterparties": top_cp,
        "mom_changes": mom[:10],
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
    }
