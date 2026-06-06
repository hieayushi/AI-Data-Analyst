"""
embedder.py

Wraps Azure OpenAI text-embedding-ada-002 for generating embeddings.

Uses a DEDICATED AzureOpenAI client built from the embedding-specific
credentials (AZURE_EMBEDDING_ENDPOINT, AZURE_EMBEDDING_API_KEY,
AZURE_EMBEDDING_API_VERSION) which may differ from the GPT-4.1 resource.
If the embedding-specific vars are not set, it falls back to the main
Azure OpenAI endpoint/key automatically (via config.py's validator).
"""

from typing import List, Dict, Any
from openai import AzureOpenAI

from config import settings


def _get_client() -> AzureOpenAI:
    """
    Returns an AzureOpenAI client pointed at the embedding resource.

    Uses AZURE_EMBEDDING_ENDPOINT / AZURE_EMBEDDING_API_KEY if provided,
    otherwise falls back to the main GPT endpoint/key (same-resource setup).
    Uses AZURE_EMBEDDING_API_VERSION (default 2023-05-15) — ada-002
    requires a different API version than GPT-4.1.
    """
    return AzureOpenAI(
        azure_endpoint=settings.effective_embedding_endpoint,
        api_key=settings.effective_embedding_api_key,
        api_version=settings.azure_embedding_api_version,
    )


def embed_text(text: str) -> List[float]:
    """Embed a single string. Returns a 1536-dim float vector."""
    client = _get_client()
    response = client.embeddings.create(
        model=settings.azure_embedding_deployment,
        input=text.replace("\n", " "),
    )
    return response.data[0].embedding


def embed_batch(texts: List[str], batch_size: int = 16) -> List[List[float]]:
    """Embed a list of strings in batches. Returns list of vectors."""
    client = _get_client()
    vectors: List[List[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = [t.replace("\n", " ") for t in texts[i : i + batch_size]]
        response = client.embeddings.create(
            model=settings.azure_embedding_deployment,
            input=batch,
        )
        # Results are returned in the same order as input
        vectors.extend([item.embedding for item in sorted(response.data, key=lambda x: x.index)])
    return vectors


def schema_to_chunks(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert a schema dict into embeddable text chunks.

    Strategy:
    - One chunk per table  → table name + description + all column names/types/descriptions
    - One chunk per column → fine-grained retrieval for wide tables

    Each chunk has:
        id      : unique string identifier
        text    : the text to embed
        metadata: dict stored alongside in Qdrant payload
    """
    chunks: List[Dict[str, Any]] = []

    for table_name, table_info in schema.get("tables", {}).items():
        table_desc = table_info.get("description", "")
        cols = table_info.get("columns", [])

        # --- Table-level chunk ---
        col_lines = "\n".join(
            f"  - {c['name']} ({c['type']}): {c.get('description', '')}"
            for c in cols
        )
        table_text = (
            f"Table: {table_name}\n"
            f"Description: {table_desc}\n"
            f"Columns:\n{col_lines}"
        )
        chunks.append(
            {
                "id": f"table__{table_name}",
                "text": table_text,
                "metadata": {
                    "type": "table",
                    "table": table_name,
                    "description": table_desc,
                },
            }
        )

        # --- Column-level chunks ---
        for col in cols:
            col_text = (
                f"Table: {table_name} | "
                f"Column: {col['name']} ({col['type']}) | "
                f"Description: {col.get('description', '')} | "
                f"Sample values: {', '.join(col.get('sample_values', []))}"
            )
            chunks.append(
                {
                    "id": f"col__{table_name}__{col['name']}",
                    "text": col_text,
                    "metadata": {
                        "type": "column",
                        "table": table_name,
                        "column": col["name"],
                        "col_type": col["type"],
                        "description": col.get("description", ""),
                    },
                }
            )

    return chunks
