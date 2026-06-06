"""
schema_extractor.py

Parses a single CSV/Excel file containing multiple tables and produces a rich
schema JSON with AI-generated descriptions for each table and column.

Supported multi-table formats:
1. Excel  → each sheet = one table
2. CSV    → separated by a '__table__' marker column
3. CSV    → separated by blank rows (auto-detect up to 8 sections)
"""

import json
import re
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any
from openai import AzureOpenAI

from config import settings


def _get_azure_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


def _sanitize_name(name: str) -> str:
    """Convert arbitrary string to a safe SQL table/column name."""
    name = str(name).strip().lower()
    name = re.sub(r"[^a-z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name or "col"


def _infer_column_type(series: pd.Series) -> str:
    """Map pandas dtype to a human-readable SQL-like type."""
    dtype = str(series.dtype)
    if "int" in dtype:
        return "INTEGER"
    if "float" in dtype:
        return "FLOAT"
    if "datetime" in dtype or "date" in dtype:
        return "DATE"
    if "bool" in dtype:
        return "BOOLEAN"
    return "TEXT"


def _sample_values(series: pd.Series, n: int = 5) -> List[Any]:
    """Return up to n non-null sample values as plain Python types."""
    samples = series.dropna().head(n).tolist()
    return [str(s) for s in samples]


def _generate_descriptions(
    table_name: str,
    columns: List[Dict],
    sample_rows: List[Dict],
    client: AzureOpenAI,
) -> Dict:
    """
    Call GPT-4.1 to generate a table description and per-column descriptions.
    Returns {"table_description": str, "column_descriptions": {col_name: str}}.
    """
    col_summary = "\n".join(
        f"  - {c['name']} ({c['type']}): sample values = {c['sample_values']}"
        for c in columns
    )
    sample_str = json.dumps(sample_rows[:3], default=str, indent=2)

    prompt = f"""You are a data analyst. Given the following table metadata, write concise but informative descriptions.

Table name: {table_name}

Columns:
{col_summary}

Sample rows (up to 3):
{sample_str}

Respond ONLY with a valid JSON object (no markdown, no extra text) in this exact format:
{{
  "table_description": "<one or two sentences describing what this table stores>",
  "column_descriptions": {{
    "<column_name>": "<brief description of what this column represents>",
    ...
  }}
}}
"""
    response = client.chat.completions.create(
        model=settings.azure_gpt_deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=800,
    )
    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    return json.loads(raw)


def _load_tables_from_excel(file_path: str) -> Dict[str, pd.DataFrame]:
    xl = pd.ExcelFile(file_path)
    return {sheet: xl.parse(sheet) for sheet in xl.sheet_names}


def _load_tables_from_csv_marker(file_path: str) -> Dict[str, pd.DataFrame]:
    """CSV with a '__table__' column to tag rows to tables."""
    df = pd.read_csv(file_path)
    if "__table__" not in df.columns:
        return {}
    tables = {}
    for table_name, group in df.groupby("__table__"):
        tables[str(table_name)] = group.drop(columns=["__table__"]).reset_index(drop=True)
    return tables


def _load_tables_from_csv_blank_rows(file_path: str) -> Dict[str, pd.DataFrame]:
    """
    CSV where tables are separated by blank lines.
    The first non-blank row of each section is treated as the header.
    """
    with open(file_path, "r", encoding="utf-8-sig") as f:
        lines = f.readlines()

    sections: List[List[str]] = []
    current: List[str] = []
    for line in lines:
        if line.strip() == "":
            if current:
                sections.append(current)
                current = []
        else:
            current.append(line)
    if current:
        sections.append(current)

    tables: Dict[str, pd.DataFrame] = {}
    for i, section in enumerate(sections):
        from io import StringIO
        try:
            df = pd.read_csv(StringIO("".join(section)))
            # Use first column value or index as name
            name = _sanitize_name(df.columns[0]) if len(df.columns) > 0 else f"table_{i+1}"
            name = f"table_{i+1}_{name}"
            tables[name] = df
        except Exception:
            continue
    return tables


def load_all_tables(file_path: str) -> Dict[str, pd.DataFrame]:
    """Auto-detect format and load all tables from a single file."""
    ext = Path(file_path).suffix.lower()
    if ext in (".xlsx", ".xls"):
        return _load_tables_from_excel(file_path)

    # CSV: try marker column first, then blank-row separator
    tables = _load_tables_from_csv_marker(file_path)
    if tables:
        return tables
    return _load_tables_from_csv_blank_rows(file_path)


def build_schema(file_path: str, generate_ai_descriptions: bool = True) -> Dict:
    """
    Main entry point. Reads the file, extracts schema for all tables,
    optionally calls GPT-4.1 for descriptions, and returns the schema dict.
    """
    tables = load_all_tables(file_path)
    if not tables:
        raise ValueError(
            "Could not detect any tables. Ensure the file uses one of the supported formats."
        )

    client = _get_azure_client() if generate_ai_descriptions else None
    schema: Dict = {"file_path": str(file_path), "tables": {}}

    for raw_name, df in tables.items():
        table_name = _sanitize_name(raw_name)
        df.columns = [_sanitize_name(c) for c in df.columns]

        columns = [
            {
                "name": col,
                "type": _infer_column_type(df[col]),
                "nullable": bool(df[col].isnull().any()),
                "sample_values": _sample_values(df[col]),
            }
            for col in df.columns
        ]

        sample_rows = df.head(3).to_dict(orient="records")

        # AI descriptions
        table_desc = f"Table containing data from the '{raw_name}' section."
        col_descs = {c["name"]: "" for c in columns}

        if generate_ai_descriptions and client:
            try:
                ai = _generate_descriptions(table_name, columns, sample_rows, client)
                table_desc = ai.get("table_description", table_desc)
                col_descs.update(ai.get("column_descriptions", {}))
            except Exception as e:
                # Fallback: keep defaults, log warning
                print(f"[WARN] AI description generation failed for '{table_name}': {e}")

        # Attach descriptions to columns
        for col in columns:
            col["description"] = col_descs.get(col["name"], "")

        schema["tables"][table_name] = {
            "original_name": raw_name,
            "description": table_desc,
            "row_count": len(df),
            "columns": columns,
        }

    return schema


def save_schema(schema: Dict, output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)


def load_schema(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
