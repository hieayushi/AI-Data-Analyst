"""
cache_manager.py

Manages a persistent query-to-SQL cache stored in cache.json.

Key behaviour
─────────────
* Cache key  : a normalised version of the user question where all
               date-relative phrases (today, yesterday, last week, last month,
               last year, this year, this month, this week, last N days/months)
               are replaced by a canonical placeholder so that
               "show me sales of today" and "show me sales of today" always
               map to the same key regardless of when they were asked.

* Cache value: the full sql_result dict returned by generate_sql(), PLUS a
               `_date_pattern` field that records which date placeholders were
               found so we can substitute real dates back at read time.

* Date patching: when a cached SQL is retrieved, every occurrence of the
                 concrete dates that were embedded in the SQL at write-time
                 is replaced with the *current* equivalent date, so
                 "sales today" always uses TODAY's date even from cache.
"""

from __future__ import annotations

import json
import re
import hashlib
import logging
from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Path ──────────────────────────────────────────────────────────────────────
CACHE_FILE = Path(__file__).parent.parent / "data" / "cache.json"

# ── Date normalisation patterns ───────────────────────────────────────────────
# Map regex pattern → (canonical_placeholder, date_resolver_key)
# The resolver key is used later to get the *current* date value.
_DATE_PATTERNS: List[Tuple[re.Pattern, str, str]] = [
    # "last N days"  / "past N days"
    (re.compile(r"\b(?:last|past)\s+(\d+)\s+days?\b", re.IGNORECASE), "__LAST_N_DAYS__", "last_n_days"),
    # "last N months"
    (re.compile(r"\b(?:last|past)\s+(\d+)\s+months?\b", re.IGNORECASE), "__LAST_N_MONTHS__", "last_n_months"),
    # "last N years"
    (re.compile(r"\b(?:last|past)\s+(\d+)\s+years?\b", re.IGNORECASE), "__LAST_N_YEARS__", "last_n_years"),
    # "last week"
    (re.compile(r"\blast\s+week\b", re.IGNORECASE), "__LAST_WEEK__", "last_week"),
    # "last month"
    (re.compile(r"\blast\s+month\b", re.IGNORECASE), "__LAST_MONTH__", "last_month"),
    # "last year"
    (re.compile(r"\blast\s+year\b", re.IGNORECASE), "__LAST_YEAR__", "last_year"),
    # "this week"
    (re.compile(r"\bthis\s+week\b", re.IGNORECASE), "__THIS_WEEK__", "this_week"),
    # "this month"
    (re.compile(r"\bthis\s+month\b", re.IGNORECASE), "__THIS_MONTH__", "this_month"),
    # "this year"  /  "current year"
    (re.compile(r"\b(?:this|current)\s+year\b", re.IGNORECASE), "__THIS_YEAR__", "this_year"),
    # "yesterday"
    (re.compile(r"\byesterday\b", re.IGNORECASE), "__YESTERDAY__", "yesterday"),
    # "today"  /  "current date"  /  "current day"
    (re.compile(r"\b(?:today|current\s+date|current\s+day)\b", re.IGNORECASE), "__TODAY__", "today"),
]

# ── SQL date literal patterns (to patch cached SQL) ───────────────────────────
# Matches ISO date strings like '2024-01-15' or "2024-01-15" in SQL
_SQL_DATE_LITERAL_RE = re.compile(
    r"['\"](\d{4}-\d{2}-\d{2})['\"]"
)

# DuckDB date functions that should NOT be touched (they are already dynamic)
_DUCKDB_DATE_FUNCS_RE = re.compile(
    r"\b(current_date|current_timestamp|now\(\)|date_trunc|INTERVAL)\b",
    re.IGNORECASE,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _today() -> date:
    return date.today()


def _resolve_dates(resolver_keys: List[Dict[str, Any]]) -> Dict[str, date]:
    """
    Given the list of resolver_key dicts recorded at cache-write time,
    return a mapping of {original_date_string → current_equivalent_date}.
    """
    today = _today()
    mapping: Dict[str, date] = {}

    for item in resolver_keys:
        key = item["key"]
        original_date = item.get("original_date")  # ISO string stored at write time
        n = item.get("n")  # integer for "last N …" variants

        if original_date is None:
            continue  # no concrete date was embedded in SQL; nothing to patch

        if key == "today":
            mapping[original_date] = today
        elif key == "yesterday":
            mapping[original_date] = today - timedelta(days=1)
        elif key == "last_week":
            # last week Monday
            mapping[original_date] = today - timedelta(weeks=1, days=today.weekday())
        elif key == "last_month":
            first_of_this_month = today.replace(day=1)
            mapping[original_date] = (first_of_this_month - timedelta(days=1)).replace(day=1)
        elif key == "last_year":
            mapping[original_date] = today.replace(year=today.year - 1, month=1, day=1)
        elif key == "this_week":
            mapping[original_date] = today - timedelta(days=today.weekday())
        elif key == "this_month":
            mapping[original_date] = today.replace(day=1)
        elif key == "this_year":
            mapping[original_date] = today.replace(month=1, day=1)
        elif key == "last_n_days" and n:
            mapping[original_date] = today - timedelta(days=n)
        elif key == "last_n_months" and n:
            year = today.year
            month = today.month - n
            while month <= 0:
                month += 12
                year -= 1
            mapping[original_date] = today.replace(year=year, month=month, day=1)
        elif key == "last_n_years" and n:
            mapping[original_date] = today.replace(year=today.year - n, month=1, day=1)

    return mapping


def _normalise_question(question: str) -> Tuple[str, List[str]]:
    """
    Replace date-relative phrases in the question with canonical placeholders.

    Returns:
        normalised_question: question with placeholders
        found_keys: list of resolver_key strings found (in order)
    """
    normalised = question.strip()
    found_keys: List[str] = []

    for pattern, placeholder, resolver_key in _DATE_PATTERNS:
        if pattern.search(normalised):
            found_keys.append(resolver_key)
            normalised = pattern.sub(placeholder, normalised)

    return normalised, found_keys


def _make_cache_key(normalised_question: str) -> str:
    """SHA-256 of the lower-cased, whitespace-collapsed question."""
    cleaned = " ".join(normalised_question.lower().split())
    return hashlib.sha256(cleaned.encode()).hexdigest()


def _extract_date_from_sql(sql: str, resolver_key: str, n: Optional[int] = None) -> Optional[str]:
    """
    Try to extract the concrete date literal that was written into the SQL
    for a given resolver_key.  We look for ISO date literals near DuckDB
    date expressions so we know what to patch on cache-hit.

    Returns the ISO date string (e.g. '2024-06-06') or None.
    """
    today = _today()

    if resolver_key == "today":
        return today.isoformat()
    elif resolver_key == "yesterday":
        return (today - timedelta(days=1)).isoformat()
    elif resolver_key == "last_week":
        return (today - timedelta(weeks=1, days=today.weekday())).isoformat()
    elif resolver_key == "last_month":
        first = today.replace(day=1)
        return ((first - timedelta(days=1)).replace(day=1)).isoformat()
    elif resolver_key == "last_year":
        return today.replace(year=today.year - 1, month=1, day=1).isoformat()
    elif resolver_key == "this_week":
        return (today - timedelta(days=today.weekday())).isoformat()
    elif resolver_key == "this_month":
        return today.replace(day=1).isoformat()
    elif resolver_key == "this_year":
        return today.replace(month=1, day=1).isoformat()
    elif resolver_key == "last_n_days" and n:
        return (today - timedelta(days=n)).isoformat()
    elif resolver_key == "last_n_months" and n:
        year, month = today.year, today.month - n
        while month <= 0:
            month += 12
            year -= 1
        return today.replace(year=year, month=month, day=1).isoformat()
    elif resolver_key == "last_n_years" and n:
        return today.replace(year=today.year - n, month=1, day=1).isoformat()

    return None


def _patch_sql_dates(sql: str, date_mapping: Dict[str, date]) -> str:
    """
    Replace every cached date literal in the SQL with its current equivalent.
    Only patches dates that we specifically tracked; leaves all other date
    literals (e.g. hard-coded business dates) untouched.
    """
    if not date_mapping:
        return sql

    patched = sql
    for original_iso, current_date in date_mapping.items():
        current_iso = current_date.isoformat()
        if original_iso != current_iso:
            # Replace quoted occurrences of the old date
            patched = patched.replace(f"'{original_iso}'", f"'{current_iso}'")
            patched = patched.replace(f'"{original_iso}"', f'"{current_iso}"')

    return patched


# ── Public API ────────────────────────────────────────────────────────────────

def _load_cache() -> Dict[str, Any]:
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("cache.json unreadable, starting fresh: %s", exc)
    return {}


def _save_cache(cache: Dict[str, Any]) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


def get_cached_result(question: str) -> Optional[Dict[str, Any]]:
    """
    Look up a question in the cache.

    Returns the sql_result dict (with SQL date literals patched to current
    dates) if a cache hit is found, otherwise None.
    """
    normalised, found_keys = _normalise_question(question)
    cache_key = _make_cache_key(normalised)

    cache = _load_cache()
    entry = cache.get(cache_key)
    if entry is None:
        logger.debug("Cache MISS for question: %s", question)
        return None

    logger.info("Cache HIT for question: %s", question)

    # Deep-copy so we don't mutate the on-disk structure
    result = deepcopy(entry["result"])

    # Patch date-sensitive SQL
    resolver_items = entry.get("resolver_items", [])
    if resolver_items:
        date_mapping = _resolve_dates(resolver_items)
        if date_mapping and result.get("sql"):
            result["sql"] = _patch_sql_dates(result["sql"], date_mapping)

    return result


def save_to_cache(
    question: str,
    sql_result: Dict[str, Any],
    original_question_found_keys: Optional[List[str]] = None,
) -> None:
    """
    Persist a sql_result into cache.json.

    Args:
        question:                   The original user question.
        sql_result:                 The dict returned by generate_sql().
        original_question_found_keys: resolver keys detected in the question
                                    (returned by _normalise_question; pass None
                                     to re-detect automatically).
    """
    normalised, found_keys = _normalise_question(question)
    if original_question_found_keys is not None:
        found_keys = original_question_found_keys

    cache_key = _make_cache_key(normalised)

    # Build resolver_items: record which keys were present and what concrete
    # date was embedded in the generated SQL at the time of caching.
    resolver_items: List[Dict[str, Any]] = []
    sql = sql_result.get("sql", "")

    for resolver_key in found_keys:
        # Extract the "n" for last-N-days/months/years
        n: Optional[int] = None
        for pattern, placeholder, rk in _DATE_PATTERNS:
            if rk == resolver_key:
                m = pattern.search(question)
                if m and m.lastindex and m.lastindex >= 1:
                    try:
                        n = int(m.group(1))
                    except (IndexError, ValueError):
                        pass
                break

        original_date = _extract_date_from_sql(sql, resolver_key, n)
        resolver_items.append({
            "key": resolver_key,
            "original_date": original_date,
            "n": n,
        })

    cache = _load_cache()
    cache[cache_key] = {
        "question": question,           # human-readable original
        "normalised": normalised,       # for debugging
        "result": sql_result,
        "resolver_items": resolver_items,
    }
    _save_cache(cache)
    logger.info("Saved to cache: %s → %s", question, cache_key[:12])
