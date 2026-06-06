"""
sql_generator.py

Uses GPT-4.1 (Azure) to convert natural language questions to SQL.
Takes relevant schema context retrieved from Qdrant as input.
"""

import re
import json
from typing import List, Dict, Any, Optional

from openai import AzureOpenAI
from config import settings


def _get_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


def _build_schema_context(relevant_chunks: List[Dict[str, Any]], full_schema: Dict) -> str:
    """
    Build a compact schema context string from:
    1. Qdrant-retrieved relevant chunks (most important)
    2. Full schema as a fallback reference

    Returns a formatted string for the system prompt.
    """
    # Collect unique table names from retrieved chunks
    relevant_tables = set()
    for chunk in relevant_chunks:
        if "table" in chunk:
            relevant_tables.add(chunk["table"])

    lines = ["## Relevant Tables\n"]
    tables = full_schema.get("tables", {})

    # Prioritise relevant tables, then include others briefly
    for table_name, table_info in tables.items():
        is_relevant = table_name in relevant_tables
        cols = table_info.get("columns", [])

        if is_relevant:
            lines.append(f"### {table_name}")
            lines.append(f"Description: {table_info.get('description', '')}")
            lines.append("Columns:")
            for col in cols:
                lines.append(
                    f"  - {col['name']} {col['type']}"
                    + (f"  -- {col.get('description', '')}" if col.get("description") else "")
                )
            lines.append("")
        else:
            # Brief mention of non-relevant tables so the model is aware
            col_names = ", ".join(c["name"] for c in cols)
            lines.append(f"### {table_name} (columns: {col_names})\n")

    return "\n".join(lines)


SYSTEM_PROMPT = """You are an expert SQL analyst. Your job is to convert natural language questions into accurate DuckDB SQL queries.

Rules:
1. Generate ONLY valid DuckDB SQL.
2. Use the exact table and column names provided in the schema (they are already sanitized).
3. When the question is ambiguous, make reasonable assumptions and explain them in your response.
4. Always use aliases for clarity in complex queries.
5. Prefer readable SQL: use CTEs over deeply nested subqueries.
6. For date/time operations use DuckDB functions: date_trunc, current_date, INTERVAL, etc.
7. NEVER use DROP, DELETE, INSERT, UPDATE, CREATE, or any DDL/DML that modifies data.
8. Return ONLY a JSON object — no markdown, no explanation outside the JSON.

Response format (strict JSON):
{
  "sql": "<the SQL query>",
  "explanation": "<one sentence explaining what the query does>",
  "tables_used": ["<table1>", "<table2>"],
  "assumptions": "<any assumptions made, or null>"
}
"""


def generate_sql(
    question: str,
    relevant_chunks: List[Dict[str, Any]],
    full_schema: Dict,
    conversation_history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Generate SQL for a natural language question.

    Args:
        question:             User's natural language question
        relevant_chunks:      Top-k schema chunks from Qdrant
        full_schema:          Complete schema dict
        conversation_history: Optional list of previous {role, content} turns

    Returns:
        Dict with keys: sql, explanation, tables_used, assumptions
    """
    client = _get_client()
    schema_context = _build_schema_context(relevant_chunks, full_schema)

    user_message = f"""Schema:
{schema_context}

Question: {question}"""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Include conversation history for follow-up questions
    if conversation_history:
        messages.extend(conversation_history[-6:])  # Keep last 3 turns

    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=settings.azure_gpt_deployment,
        messages=messages,
        temperature=0.1,
        max_tokens=settings.max_tokens,
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to extract SQL if JSON parse fails
        sql_match = re.search(r"SELECT.*?;", raw, re.DOTALL | re.IGNORECASE)
        result = {
            "sql": sql_match.group(0) if sql_match else raw,
            "explanation": "Could not parse structured response.",
            "tables_used": [],
            "assumptions": None,
        }

    # Attach token usage so the caller can log it (not part of the API response)
    usage = response.usage
    if usage:
        result["_token_usage"] = {
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
        }

    return result
