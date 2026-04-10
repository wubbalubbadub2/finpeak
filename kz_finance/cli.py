"""CLI entry point for kz-finance bank statement parser."""

from __future__ import annotations

import os
import sys

import click

from .parsers.detect import detect_bank, extract_header
from .parsers.kaspi import parse_kaspi
from .parsers.halyk import parse_halyk
from .parsers.jusan import parse_jusan
from .parsers.forte import parse_forte
from .categorizer.rules import RuleCategorizer
from .categorizer.llm import LLMCategorizer
from .export.csv_export import transactions_to_csv
from .reports.summary import print_summary

PARSERS = {
    'kaspi': parse_kaspi,
    'halyk': parse_halyk,
    'jusan': parse_jusan,
    'forte': parse_forte,
}


def _parse_and_categorize(pdf_path, wallet, branch, no_llm, categorizer, llm_categorizer):
    """Parse a PDF and categorize all transactions."""
    bank = detect_bank(pdf_path)
    parser = PARSERS.get(bank)
    if not parser:
        click.echo(f"No parser for bank: {bank}", err=True)
        return []

    header = extract_header(pdf_path, bank)
    click.echo(f"Detected: {bank} | {header.get('client_name', 'Unknown')} | {header.get('account', '')}", err=True)

    transactions = parser(pdf_path)
    click.echo(f"Parsed: {len(transactions)} transactions", err=True)

    # Categorize with rules
    unmatched = []
    for tx in transactions:
        categorizer.apply(tx)
        if not tx.category:
            unmatched.append(tx)

    matched = len(transactions) - len(unmatched)
    click.echo(f"Rules matched: {matched}/{len(transactions)} ({matched/len(transactions)*100:.1f}%)", err=True)

    # LLM fallback for unmatched
    if unmatched and not no_llm:
        click.echo(f"Running LLM categorization on {len(unmatched)} unmatched...", err=True)
        results = llm_categorizer.categorize_all(unmatched)
        for tx, cat in zip(unmatched, results):
            if cat:
                tx.category = cat
                tx.category_confidence = 0.8
                meta = categorizer.get_category_metadata(cat)
                tx.activity_type = meta.get('activity_type', '')
                tx.direction = meta.get('group', '')

    final_categorized = sum(1 for tx in transactions if tx.category)
    click.echo(f"Final: {final_categorized}/{len(transactions)} categorized ({final_categorized/len(transactions)*100:.1f}%)", err=True)

    # Set wallet name
    w = wallet or header.get('client_name', header.get('account', ''))
    for tx in transactions:
        if wallet:
            tx.account = wallet

    return transactions, w, header


@click.group()
def main():
    """KZ Finance - Bank statement parser and categorizer."""
    pass


@main.command()
@click.argument('pdf_path', type=click.Path(exists=True))
@click.option('--wallet', '-w', default='', help='Wallet name for CSV output')
@click.option('--branch', '-b', default='Общее', help='Branch/city name')
@click.option('--no-llm', is_flag=True, help='Skip LLM fallback for uncategorized transactions')
@click.option('--output', '-o', type=click.Path(), help='Output CSV file (default: stdout)')
def parse(pdf_path, wallet, branch, no_llm, output):
    """Parse a bank statement PDF and output categorized transactions."""
    categorizer = RuleCategorizer()
    llm_categorizer = LLMCategorizer([c['name'] for c in categorizer.categories])

    transactions, w, header = _parse_and_categorize(
        pdf_path, wallet, branch, no_llm, categorizer, llm_categorizer
    )

    # Output CSV
    csv_str = transactions_to_csv(transactions, wallet_name=w, branch=branch)
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(csv_str)
        click.echo(f"CSV written to {output}", err=True)
    else:
        click.echo(csv_str)

    # Print P&L summary to stderr
    period = f"{header.get('period_start', '')} - {header.get('period_end', '')}"
    print_summary(transactions, client_name=header.get('client_name', ''), period=period)


@main.command('parse-dir')
@click.argument('directory', type=click.Path(exists=True))
@click.option('--branch', '-b', default='Общее', help='Branch/city name')
@click.option('--no-llm', is_flag=True, help='Skip LLM fallback')
@click.option('--output', '-o', type=click.Path(), help='Output CSV file')
def parse_dir(directory, branch, no_llm, output):
    """Parse all PDF files in a directory."""
    categorizer = RuleCategorizer()
    llm_categorizer = LLMCategorizer([c['name'] for c in categorizer.categories])

    all_transactions = []
    for f in sorted(os.listdir(directory)):
        if not f.endswith('.pdf'):
            continue
        pdf_path = os.path.join(directory, f)
        click.echo(f"\n--- {f} ---", err=True)
        try:
            txs, w, header = _parse_and_categorize(
                pdf_path, '', branch, no_llm, categorizer, llm_categorizer
            )
            all_transactions.extend(txs)
        except Exception as e:
            click.echo(f"ERROR: {e}", err=True)

    click.echo(f"\n=== Total: {len(all_transactions)} transactions from {directory} ===", err=True)

    csv_str = transactions_to_csv(all_transactions, branch=branch)
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(csv_str)
        click.echo(f"CSV written to {output}", err=True)
    else:
        click.echo(csv_str)

    print_summary(all_transactions)


if __name__ == '__main__':
    main()
