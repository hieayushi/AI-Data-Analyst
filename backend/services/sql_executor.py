"""
sql_executor.py

Loads all tables from the uploaded CSV/Excel into an in-memory DuckDB
instance and executes SQL queries against them.

DuckDB is used because:
- It natively reads CSV/Parquet/Pandas DataFrames
- It supports standard SQL + analytical extensions
- It runs entirely in-process (no server needed)
"""

import json
import duckdb
import pandas as pd
from typing import Dict, Any, List, Optional
from pathlib import Path

from services.schema_extractor import load_all_tables
from config import settings


def _sanitize_col_names(df: pd.DataFrame) -> pd.DataFrame:
    """Sanitize column names to match schema (same logic as schema_extractor)."""
    import re
    def clean(name):
        name = str(name).strip().lower()
        name = re.sub(r"[^a-z0-9_]", "_", name)
        name = re.sub(r"_+", "_", name).strip("_")
        return name or "col"
    df.columns = [clean(c) for c in df.columns]
    return df


def execute_query(
    sql: str,
    file_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a SQL query against tables loaded from the data file.

    Args:
        sql:       SQL query string (DuckDB dialect)
        file_path: Path to the CSV/Excel file. Falls back to latest uploaded file.

    Returns:
        {
            "columns": [...],
            "rows":    [[...], ...],
            "row_count": int,
            "truncated": bool,   # True if results were cut to MAX_ROWS
        }
    """
    MAX_ROWS = 1000  # Guard against huge result sets

    if not file_path:
        # Auto-discover the most recently uploaded file
        data_dir = Path(settings.data_dir)
        files = sorted(
            data_dir.glob("*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        supported = [f for f in files if f.suffix.lower() in (".csv", ".xlsx", ".xls")]
        if not supported:
            raise FileNotFoundError("No uploaded data file found. Please upload a CSV or Excel file first.")
        file_path = str(supported[0])

    # Load tables as DataFrames
    tables: Dict[str, pd.DataFrame] = load_all_tables(file_path)
    if not tables:
        raise ValueError("Could not load any tables from the file.")

    # Connect to an in-memory DuckDB and register all DataFrames
    con = duckdb.connect(database=":memory:")
    for table_name, df in tables.items():
        import re
        safe_name = re.sub(r"[^a-z0-9_]", "_", table_name.strip().lower())
        df = _sanitize_col_names(df)
        con.register(safe_name, df)

    # Execute
    result = con.execute(sql).fetchdf()
    con.close()

    truncated = len(result) > MAX_ROWS
    result = result.head(MAX_ROWS)

    # Convert to JSON-serializable format
    columns = list(result.columns)
    rows = []
    for _, row in result.iterrows():
        rows.append([_json_safe(v) for v in row.tolist()])

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "file_used": str(file_path),
    }


def _json_safe(value: Any) -> Any:
    """Convert non-serializable types to strings."""
    import numpy as np
    import math
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, (bytes,)):
        return value.decode("utf-8", errors="replace")
    return value


def list_tables(file_path: Optional[str] = None) -> List[str]:
    """Return table names available in the data file."""
    if not file_path:
        data_dir = Path(settings.data_dir)
        files = sorted(data_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        supported = [f for f in files if f.suffix.lower() in (".csv", ".xlsx", ".xls")]
        if not supported:
            return []
        file_path = str(supported[0])
    tables = load_all_tables(file_path)
    return list(tables.keys())
