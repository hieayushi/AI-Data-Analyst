"""
answer_generator.py

Takes the user's original question + the executed query results and asks
GPT to produce a concise, friendly natural-language answer.

This is intentionally a lightweight call:
  - We send at most 30 rows so the prompt stays small.
  - Temperature 0 for consistency.
  - The answer is always generated AFTER execution so it reflects real data.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from openai import AzureOpenAI
from config import settings

logger = logging.getLogger(__name__)

# ── System prompt ─────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """\
You are a data analyst assistant. The user asked a question and we ran a database \
query on their data. Your job is to answer the user's question in clear, friendly \
natural language based ONLY on the query results provided.

Rules:
1. Be concise — 1 to 3 sentences maximum.
2. Lead with the direct answer (the key number, name, or insight).
3. Mention specific values/numbers from the results.
4. If there are no rows, say the data shows no matching records.
5. Do NOT mention SQL, databases, tables, or technical terms.
6. Do NOT say "based on the query" or "the results show" — just give the answer directly.
7. Use plain language a non-technical user would understand.
8. If the result is a single number, state it clearly (e.g. "Total sales this month are ₹4,23,500.").
"""

_MAX_ROWS_IN_PROMPT = 30  # cap to keep prompt small


def _format_results_for_prompt(columns: List[str], rows: List[List[Any]]) -> str:
    """Render the result table as a compact text block for the prompt."""
    if not columns or not rows:
        return "No rows returned."

    preview = rows[:_MAX_ROWS_IN_PROMPT]
    lines = [" | ".join(str(c) for c in columns)]
    lines.append("-" * len(lines[0]))
    for row in preview:
        lines.append(" | ".join(str(v) if v is not None else "null" for v in row))

    if len(rows) > _MAX_ROWS_IN_PROMPT:
        lines.append(f"... ({len(rows) - _MAX_ROWS_IN_PROMPT} more rows not shown)")

    return "\n".join(lines)


def generate_answer(
    question: str,
    columns: List[str],
    rows: List[List[Any]],
    row_count: int,
) -> str:
    """
    Generate a plain-English answer to the user's question based on the
    actual query results.

    Returns:
        A natural-language string. Falls back to a generic message on error.
    """
    if not columns:
        return "The query ran successfully but returned no data."

    results_text = _format_results_for_prompt(columns, rows)

    user_message = f"""\
Question: {question}

Query results ({row_count} row{'s' if row_count != 1 else ''}):
{results_text}

Answer the question in 1–3 sentences using only the data above."""

    try:
        client = AzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )

        response = client.chat.completions.create(
            model=settings.azure_gpt_deployment,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            temperature=0,
            max_tokens=200,
        )

        answer = response.choices[0].message.content.strip()

        usage = response.usage
        if usage:
            logger.info(
                "Answer token usage | question=%r | prompt=%d | completion=%d | total=%d",
                question,
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
            )

        return answer

    except Exception as exc:
        logger.warning("answer_generator failed: %s", exc)
        # Graceful fallback — build a simple answer from raw data
        if row_count == 0:
            return "No matching records were found for your query."
        if row_count == 1 and len(columns) == 1:
            return f"The result is: **{rows[0][0]}**."
        return f"The query returned {row_count} result{'s' if row_count != 1 else ''}."
