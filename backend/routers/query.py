"""
query.py — Router for natural language → SQL → execute pipeline.
"""

import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from services.embedder import embed_text
from services.qdrant_service import search_similar
from services.schema_extractor import load_schema
from services.sql_generator import generate_sql
from services.sql_executor import execute_query
from services.answer_generator import generate_answer
from utils.cache_manager import get_cached_result, save_to_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/query", tags=["query"])


class QueryRequest(BaseModel):
    question: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    top_k: int = 8


class QueryResponse(BaseModel):
    question: str
    answer: str          # plain-English summary of the result
    sql: str
    explanation: str
    tables_used: List[str]
    assumptions: Optional[str]
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    truncated: bool


@router.post("/", response_model=QueryResponse)
async def run_query(request: QueryRequest):
    """
    Full pipeline:
    1. Check cache — if an identical (date-normalised) question was asked
       before, return the cached SQL (with dates refreshed to today).
    2. Embed the user's question
    3. Retrieve relevant schema chunks from Qdrant
    4. Call GPT-4.1 to generate SQL
    5. Save result to cache.json
    6. Execute SQL on the uploaded data file via DuckDB
    7. Return results
    """
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        raise HTTPException(
            status_code=400,
            detail="No data has been uploaded yet. Please upload a CSV or Excel file first.",
        )

    # Load schema
    schema = load_schema(str(schema_path))

    # ── Step 0: Cache lookup ──────────────────────────────────────────────────
    cached = get_cached_result(request.question)
    if cached is not None:
        sql = cached.get("sql", "")
        if sql:
            logger.info("Serving from cache for question: %s", request.question)
            try:
                exec_result = execute_query(sql)
            except Exception as e:
                # Cached SQL failed (schema may have changed); fall through to
                # regenerate via OpenAI below.
                logger.warning(
                    "Cached SQL execution failed (%s); regenerating via OpenAI.", e
                )
                cached = None  # signal to continue with full pipeline
            else:
                # ── Generate natural-language answer from real results ─────
                try:
                    answer = generate_answer(
                        question=request.question,
                        columns=exec_result["columns"],
                        rows=exec_result["rows"],
                        row_count=exec_result["row_count"],
                    )
                except Exception as e:
                    logger.warning("Answer generation failed (cache path): %s", e)
                    answer = ""

                return QueryResponse(
                    question=request.question,
                    answer=answer,
                    sql=sql,
                    explanation=cached.get("explanation", ""),
                    tables_used=cached.get("tables_used", []),
                    assumptions=cached.get("assumptions"),
                    columns=exec_result["columns"],
                    rows=exec_result["rows"],
                    row_count=exec_result["row_count"],
                    truncated=exec_result["truncated"],
                )

    # ── Step 1: Embed question ────────────────────────────────────────────────
    try:
        query_vector = embed_text(request.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

    # ── Step 2: Retrieve relevant schema chunks ───────────────────────────────
    try:
        relevant_chunks = search_similar(query_vector, top_k=request.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector search failed: {str(e)}")

    # ── Step 3: Generate SQL via OpenAI ──────────────────────────────────────
    try:
        sql_result = generate_sql(
            question=request.question,
            relevant_chunks=relevant_chunks,
            full_schema=schema,
            conversation_history=request.conversation_history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SQL generation failed: {str(e)}")

    sql = sql_result.get("sql", "")
    if not sql:
        raise HTTPException(status_code=500, detail="SQL generation returned empty query.")

    # Log token usage (only available for live OpenAI calls, not cache hits)
    token_usage = sql_result.pop("_token_usage", None)
    if token_usage:
        logger.info(
            "Token usage | question=%r | prompt=%d | completion=%d | total=%d",
            request.question,
            token_usage["prompt_tokens"],
            token_usage["completion_tokens"],
            token_usage["total_tokens"],
        )

    # ── Step 4: Execute SQL ───────────────────────────────────────────────────
    try:
        exec_result = execute_query(sql)
    except Exception as e:
        # Return SQL + error so frontend can show what was attempted
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"SQL execution failed: {str(e)}",
                "sql": sql,
                "explanation": sql_result.get("explanation", ""),
            },
        )

    # ── Step 5: Persist to cache ──────────────────────────────────────────────
    try:
        save_to_cache(request.question, sql_result)
    except Exception as e:
        logger.warning("Failed to write to cache: %s", e)

    # ── Step 6: Generate plain-English answer ─────────────────────────────────
    try:
        answer = generate_answer(
            question=request.question,
            columns=exec_result["columns"],
            rows=exec_result["rows"],
            row_count=exec_result["row_count"],
        )
    except Exception as e:
        logger.warning("Answer generation failed: %s", e)
        answer = ""

    return QueryResponse(
        question=request.question,
        answer=answer,
        sql=sql,
        explanation=sql_result.get("explanation", ""),
        tables_used=sql_result.get("tables_used", []),
        assumptions=sql_result.get("assumptions"),
        columns=exec_result["columns"],
        rows=exec_result["rows"],
        row_count=exec_result["row_count"],
        truncated=exec_result["truncated"],
    )


@router.post("/sql-only")
async def generate_sql_only(request: QueryRequest):
    """Generate SQL without executing it (preview mode)."""
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        raise HTTPException(status_code=400, detail="No data uploaded yet.")

    schema = load_schema(str(schema_path))
    query_vector = embed_text(request.question)
    relevant_chunks = search_similar(query_vector, top_k=request.top_k)
    sql_result = generate_sql(request.question, relevant_chunks, schema)

    return sql_result
