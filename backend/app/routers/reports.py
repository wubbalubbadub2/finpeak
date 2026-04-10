"""Dashboard and report endpoints."""

from collections import defaultdict
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_org
from ..models import Organization, Transaction, BankAccount, Category
from ..schemas import DashboardData, PnLRow
from ..services.insights import compute_insights
from ..services.reports import cash_flow_report, pnl_report, expense_analytics

router = APIRouter(tags=["reports"])


@router.get("/reports/dashboard", response_model=DashboardData)
def get_dashboard(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    bank_account_id: Optional[str] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    # Base query
    q = (
        db.query(Transaction)
        .join(BankAccount)
        .filter(BankAccount.organization_id == org.id)
    )
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    if bank_account_id:
        q = q.filter(Transaction.bank_account_id == bank_account_id)

    txs = q.all()
    if not txs:
        return DashboardData(
            income_total=0, expense_total=0, net=0, transaction_count=0,
            pnl_rows=[], expense_by_category=[], monthly_trend=[], account_balances=[],
        )

    # Compute totals
    income_total = sum(float(tx.credit or 0) for tx in txs)
    expense_total = sum(float(tx.debit or 0) for tx in txs)
    net = income_total - expense_total

    # P&L by category
    cat_sums = defaultdict(float)
    cat_meta = {}
    for tx in txs:
        cat = tx.category_name or "UNCATEGORIZED"
        cat_sums[cat] += tx.signed_amount
        if cat not in cat_meta:
            cat_meta[cat] = {
                'category_group': tx.activity_type or '',
                'activity_type': tx.activity_type or '',
                'direction': tx.direction or '',
            }

    pnl_rows = [
        PnLRow(
            category=cat,
            category_group=cat_meta[cat]['category_group'],
            activity_type=cat_meta[cat]['activity_type'],
            direction=cat_meta[cat]['direction'],
            amount=amount,
        )
        for cat, amount in sorted(cat_sums.items(), key=lambda x: -abs(x[1]))
    ]

    # Expense by category (for pie chart)
    expense_by_cat = []
    for cat, amount in cat_sums.items():
        if amount < 0:
            expense_by_cat.append({
                'category': cat,
                'amount': abs(amount),
                'percentage': round(abs(amount) / expense_total * 100, 1) if expense_total > 0 else 0,
            })
    expense_by_cat.sort(key=lambda x: -x['amount'])

    # Monthly trend
    monthly = defaultdict(lambda: {'income': 0.0, 'expense': 0.0})
    for tx in txs:
        key = tx.date.strftime('%Y-%m')
        if tx.credit and float(tx.credit) > 0:
            monthly[key]['income'] += float(tx.credit)
        if tx.debit and float(tx.debit) > 0:
            monthly[key]['expense'] += float(tx.debit)

    monthly_trend = [
        {
            'month': m,
            'income': round(v['income'], 2),
            'expense': round(v['expense'], 2),
            'net': round(v['income'] - v['expense'], 2),
        }
        for m, v in sorted(monthly.items())
    ]

    # Account balances
    account_totals = defaultdict(lambda: {'income': 0.0, 'expense': 0.0, 'bank': '', 'wallet': ''})
    for tx in txs:
        ba = tx.bank_account
        key = ba.account_number
        if tx.credit:
            account_totals[key]['income'] += float(tx.credit)
        if tx.debit:
            account_totals[key]['expense'] += float(tx.debit)
        account_totals[key]['bank'] = ba.bank
        account_totals[key]['wallet'] = ba.wallet_name or ba.account_number

    account_balances = [
        {
            'account': k,
            'bank': v['bank'],
            'wallet': v['wallet'],
            'balance': round(v['income'] - v['expense'], 2),
        }
        for k, v in account_totals.items()
    ]

    dates = [tx.date for tx in txs]
    return DashboardData(
        period_start=min(dates) if dates else None,
        period_end=max(dates) if dates else None,
        income_total=round(income_total, 2),
        expense_total=round(expense_total, 2),
        net=round(net, 2),
        transaction_count=len(txs),
        pnl_rows=pnl_rows,
        expense_by_category=expense_by_cat,
        monthly_trend=monthly_trend,
        account_balances=account_balances,
    )


@router.get("/reports/export/csv")
def export_csv(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    """Export transactions as CSV in Реестр платежей format."""
    from kz_finance.export.csv_export import CSV_COLUMNS, MONTHS_RU
    import csv
    import io

    q = (
        db.query(Transaction)
        .join(BankAccount)
        .filter(BankAccount.organization_id == org.id)
    )
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)

    txs = q.order_by(Transaction.date).all()

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter='\t')
    writer.writerow(CSV_COLUMNS)

    for tx in txs:
        ba = tx.bank_account
        amount = tx.signed_amount
        cp = tx.counterparty or ""
        if tx.counterparty_bin:
            cp += f" БИН/ИИН {tx.counterparty_bin}"
        desc = tx.payment_description or ""
        if tx.knp:
            desc += f" кнп {tx.knp}"

        writer.writerow([
            MONTHS_RU.get(tx.date.month, ""),
            tx.date.year,
            tx.date.month,
            tx.date.isoformat(),
            str(amount),
            str(amount),
            "ТЕНГЕ",
            "1.0",
            ba.wallet_name or ba.account_number if ba else "",
            "",
            tx.category_name or "UNCATEGORIZED",
            "Общее",
            cp,
            desc,
            "",
            "",
            tx.activity_type or "",
            tx.direction or "",
        ])

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/reports/cashflow")
def get_cashflow(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    """Cash Flow Statement (ДДС) grouped by category and month."""
    return cash_flow_report(db, org.id, date_from, date_to)


@router.get("/reports/pnl")
def get_pnl(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    """Profit & Loss statement by month."""
    return pnl_report(db, org.id, date_from, date_to)


@router.get("/reports/expenses")
def get_expenses(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    """Expense analytics: category %, top counterparties, MoM changes."""
    return expense_analytics(db, org.id, date_from, date_to)


@router.get("/reports/insights")
def get_insights(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    org: Organization = Depends(get_org),
    db: Session = Depends(get_db),
):
    """AI Insights: anomalies, trends, cash runway."""
    return compute_insights(db, org.id, date_from, date_to)
