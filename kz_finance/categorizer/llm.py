"""LLM-based fallback categorizer using Claude API."""

from __future__ import annotations

import json
import os
import sys
from typing import Optional

from ..parsers.base import Transaction


class LLMCategorizer:
    """Categorize transactions using Claude API when rules don't match.

    Batches transactions to minimize API calls.
    Works without API key (falls back to UNCATEGORIZED with a warning).
    """

    def __init__(self, category_names: list[str], batch_size: int = 20):
        self.category_names = category_names
        self.batch_size = batch_size
        self._client = None
        self._warned = False

    def _get_client(self):
        if self._client is not None:
            return self._client

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            if not self._warned:
                print("WARNING: ANTHROPIC_API_KEY not set. Unmatched transactions will be marked UNCATEGORIZED.",
                      file=sys.stderr)
                self._warned = True
            return None

        try:
            import anthropic
            self._client = anthropic.Anthropic(api_key=api_key)
            return self._client
        except ImportError:
            if not self._warned:
                print("WARNING: anthropic package not available.", file=sys.stderr)
                self._warned = True
            return None

    def categorize_batch(self, transactions: list[Transaction]) -> list[Optional[str]]:
        """Categorize a batch of transactions using Claude API.

        Returns a list of category names (or None for failures).
        """
        client = self._get_client()
        if client is None:
            return [None] * len(transactions)

        categories_text = "\n".join(f"- {c}" for c in self.category_names)
        txs_text = "\n".join(
            f"{i+1}. Description: {tx.payment_description[:100]}, "
            f"Counterparty: {tx.counterparty[:50]}, "
            f"Amount: {tx.signed_amount}"
            for i, tx in enumerate(transactions)
        )

        prompt = f"""You are a Kazakh SMB financial analyst. Categorize each transaction into exactly one of these categories:

{categories_text}

Transactions to categorize:
{txs_text}

Respond ONLY with a JSON array: [{{"index": 1, "category": "exact category name"}}]
Use only category names from the list above."""

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text
            # Extract JSON from response
            start = text.find('[')
            end = text.rfind(']') + 1
            if start >= 0 and end > start:
                results = json.loads(text[start:end])
                output = [None] * len(transactions)
                for r in results:
                    idx = r.get('index', 0) - 1
                    cat = r.get('category', '')
                    if 0 <= idx < len(transactions) and cat in self.category_names:
                        output[idx] = cat
                return output
        except Exception as e:
            print(f"WARNING: LLM categorization failed: {e}", file=sys.stderr)

        return [None] * len(transactions)

    def categorize_all(self, transactions: list[Transaction]) -> list[Optional[str]]:
        """Categorize all transactions in batches."""
        results = []
        for i in range(0, len(transactions), self.batch_size):
            batch = transactions[i:i + self.batch_size]
            batch_results = self.categorize_batch(batch)
            results.extend(batch_results)
        return results
