"""
upload.py — Router for file upload, schema extraction, and embedding pipeline.
"""

import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from config import settings
from services.schema_extractor import build_schema, save_schema
from services.embedder import schema_to_chunks, embed_batch
from services.qdrant_service import upsert_chunks, delete_all, collection_info

router = APIRouter(prefix="/upload", tags=["upload"])


class UploadStatus(BaseModel):
    status: str
    filename: str
    tables_found: int
    chunks_embedded: int
    message: str


def _process_file(file_path: str) -> dict:
    """Background task: extract schema → embed → store in Qdrant."""
    # 1. Build schema with AI descriptions
    schema = build_schema(file_path, generate_ai_descriptions=True)

    # 2. Save schema JSON
    save_schema(schema, settings.schema_json_path)

    # 3. Convert schema to text chunks
    chunks = schema_to_chunks(schema)

    # 4. Clear old embeddings and insert new ones
    delete_all()
    vectors = embed_batch([c["text"] for c in chunks])
    count = upsert_chunks(chunks, vectors)

    return {
        "tables_found": len(schema["tables"]),
        "chunks_embedded": count,
    }


@router.post("/", response_model=UploadStatus)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a CSV or Excel file containing up to 8 tables.
    Triggers schema extraction, AI description generation, embedding, and Qdrant storage.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(status_code=400, detail="Only .csv, .xlsx, .xls files are supported.")

    # Save uploaded file
    dest = Path(settings.data_dir) / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        result = _process_file(str(dest))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    return UploadStatus(
        status="success",
        filename=file.filename,
        tables_found=result["tables_found"],
        chunks_embedded=result["chunks_embedded"],
        message=f"Successfully processed {result['tables_found']} tables and stored {result['chunks_embedded']} embedding chunks.",
    )


@router.get("/status")
async def upload_status():
    """Check if a file has been uploaded and embeddings are ready."""
    schema_path = Path(settings.schema_json_path)
    if not schema_path.exists():
        return {"ready": False, "message": "No data file uploaded yet."}

    try:
        info = collection_info()
        return {
            "ready": True,
            "schema_exists": True,
            "qdrant": info,
        }
    except Exception as e:
        return {"ready": False, "error": str(e)}
