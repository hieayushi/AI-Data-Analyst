"""
schema.py — Router for viewing and managing the stored schema.
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from config import settings
from services.schema_extractor import load_schema

router = APIRouter(prefix="/schema", tags=["schema"])


@router.get("/")
async def get_schema():
    """Return the full stored schema JSON."""
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        raise HTTPException(status_code=404, detail="No schema found. Upload a file first.")
    return load_schema(str(schema_path))


@router.get("/tables")
async def list_tables():
    """Return a summary of all tables in the schema."""
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        raise HTTPException(status_code=404, detail="No schema found.")
    schema = load_schema(str(schema_path))
    tables = schema.get("tables", {})
    return [
        {
            "name": name,
            "description": info.get("description", ""),
            "row_count": info.get("row_count", 0),
            "column_count": len(info.get("columns", [])),
        }
        for name, info in tables.items()
    ]


@router.get("/tables/{table_name}")
async def get_table_schema(table_name: str):
    """Return schema for a specific table."""
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        raise HTTPException(status_code=404, detail="No schema found.")
    schema = load_schema(str(schema_path))
    table = schema.get("tables", {}).get(table_name)
    if not table:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")
    return {**table, "name": table_name}


class UpdateDescriptionRequest(BaseModel):
    table_description: Optional[str] = None
    column_descriptions: Optional[Dict[str, str]] = None


@router.patch("/tables/{table_name}")
async def update_table_description(table_name: str, body: UpdateDescriptionRequest):
    """
    Manually edit table or column descriptions.
    Useful for correcting AI-generated descriptions.
    """
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        raise HTTPException(status_code=404, detail="No schema found.")

    schema = load_schema(str(schema_path))
    tables = schema.get("tables", {})

    if table_name not in tables:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")

    if body.table_description is not None:
        tables[table_name]["description"] = body.table_description

    if body.column_descriptions:
        for col in tables[table_name]["columns"]:
            if col["name"] in body.column_descriptions:
                col["description"] = body.column_descriptions[col["name"]]

    schema["tables"] = tables
    with open(str(schema_path), "w") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    return {"status": "updated", "table": table_name}
