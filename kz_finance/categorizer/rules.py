"""Rule-based transaction categorizer using keyword matching."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from ..parsers.base import Transaction


# KNP code -> category mapping (common Kazakh payment codes)
_KNP_MAP = {
    '190': 'Поступление от реализации товаров',  # Kaspi sales
    '342': 'Расход — Перевод между счетами',       # Personal fund transfer
    '343': 'Расход — Перевод между счетами',       # Own account transfer
    '390': 'Доход — Перевод между счетами',        # Incoming transfer from own account
    '710': 'Расходы на закуп',                      # Payment for goods
    '341': 'Снятие наличных',                       # Cash withdrawal -> treat as transfer
    '332': 'Расход — Перевод между счетами',       # Salary card top-up
}

# Description substring -> category (sorted longest first at runtime)
_DESCRIPTION_PATTERNS = sorted([
    ('расчеты по карточкам', 'Поступление от реализации товаров'),
    ('возмещение по транзакциям', 'Поступление от реализации товаров'),
    ('pos-терминал', 'Поступление от реализации товаров'),
    ('комиссия за операцию', 'Комиссия банка'),
    ('комиссию', 'Комиссия банка'),
    ('комиссия за обслуживание', 'Комиссия банка'),
    ('переводные операции в тенге', 'Комиссия банка'),
    ('за проживани', 'Поступление от реализации товаров'),
    ('в гостинице', 'Поступление от реализации товаров'),
    ('в гостиниц', 'Поступление от реализации товаров'),
    ('wolt', 'Поступление от реализации товаров'),
    ('перечисление заработной', 'З/п менеджеров по продажам'),
    ('заработная плата', 'З/п менеджеров по продажам'),
    ('перечисление юридическим лицам', 'Расход — Перевод между счетами'),
    ('социальные отчисления', 'Налоги на ФОТ'),
    ('аренд', 'Коммунальные услуги'),
    ('лизинг', 'Коммунальные услуги'),
    ('вознаграждения по депозит', 'Доход от неоперационной деятельности'),
    ('снятие с текущего счета', 'Расход — Перевод между счетами'),
    ('снятие наличных', 'Расход — Перевод между счетами'),
    ('подключени', 'IT инфраструктура-адм'),
    ('вывоз и утилизац', 'Прочие административные расходы'),
    ('реклам', 'Расходы на маркетинг'),
    ('автоматизаци', 'IT инфраструктура-адм'),
    ('банковские выписки', 'Комиссия банка'),
    ('за услуги связи', 'Услуга связи'),
    ('виртуальная атс', 'Услуга связи'),
    ('зуботехнической лаборатории', 'Консультационные и проф услуги'),
    ('за услуги консультац', 'Консультационные и проф услуги'),
    ('охрана объект', 'Прочие административные расходы'),
    ('вывоз тбо', 'Прочие административные расходы'),
    ('заправка картридж', 'Прочие административные расходы'),
    ('неустойк', 'Прочие административные расходы'),
    ('услуги по', 'Консультационные и проф услуги'),
], key=lambda x: -len(x[0]))

# Counterparty name -> category
_COUNTERPARTY_PATTERNS = sorted([
    ('fortebank', 'Поступление от реализации товаров'),  # POS settlement from bank
    ('народный банк', 'Поступление от реализации товаров'),  # Card settlement from bank
], key=lambda x: -len(x[0]))


class RuleCategorizer:
    """Categorize transactions using substring matching rules.

    Rules are sorted longest-pattern-first to avoid short patterns
    like "ОС" matching "ОСМС" before longer, more specific rules fire.
    """

    def __init__(self, rules_path: str | None = None):
        if rules_path is None:
            rules_path = str(Path(__file__).parent / 'categories.json')

        with open(rules_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.categories = data['categories']
        self.rules = data['rules']
        # Sort by descending pattern length (longest match wins)
        self.rules.sort(key=lambda r: -len(r['pattern']))

        # Build category lookup for metadata
        self._cat_map = {c['name']: c for c in self.categories}

    def categorize(self, tx: Transaction) -> Optional[str]:
        """Try to categorize a transaction using keyword rules + KNP mapping + hardcoded patterns.

        Priority: 1) JSON rules, 2) KNP code mapping, 3) description pattern matching.
        Returns category name if matched, None otherwise.
        """
        # 1) JSON keyword rules (from Excel)
        for rule in self.rules:
            field = rule['field']
            pattern = rule['pattern'].lower()

            if field == 'payment_description':
                text = tx.payment_description.lower()
            elif field == 'counterparty':
                text = tx.counterparty.lower()
            else:
                continue

            if pattern in text:
                return rule['category']

        # 2) KNP code-based categorization (cheap, no LLM needed)
        if tx.knp:
            knp_cat = _KNP_MAP.get(tx.knp)
            if knp_cat:
                return knp_cat

        # 3) Description pattern matching for common unmatched patterns
        desc = tx.payment_description.lower()
        cp = tx.counterparty.lower()

        for pattern, category in _DESCRIPTION_PATTERNS:
            if pattern in desc:
                return category

        for pattern, category in _COUNTERPARTY_PATTERNS:
            if pattern in cp:
                return category

        return None

    def get_category_metadata(self, category_name: str) -> dict:
        """Get metadata for a category (group, activity_type, etc.)."""
        return self._cat_map.get(category_name, {})

    def apply(self, tx: Transaction) -> Transaction:
        """Categorize a transaction and set its metadata fields."""
        category = self.categorize(tx)
        if category:
            tx.category = category
            tx.category_confidence = 1.0
            meta = self.get_category_metadata(category)
            tx.activity_type = meta.get('activity_type', '')
            tx.direction = meta.get('group', '')
        return tx
