"""
qdrant_service.py

Manages a LOCAL persistent Qdrant instance using qdrant-client's
on-disk mode (QdrantClient(path=...)) — no Docker, no server process needed.

Data is stored in QDRANT_PATH (default: ./qdrant_storage).
"""

import uuid
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    SearchRequest,
)

from config import settings

# Embedding dimension for text-embedding-ada-002
VECTOR_DIM = 1536

_client: Optional[QdrantClient] = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(path=settings.qdrant_path)
    return _client


def ensure_collection(recreate: bool = False) -> None:
    """Create the Qdrant collection if it doesn't exist."""
    client = get_client()
    collection_name = settings.qdrant_collection
    existing = [c.name for c in client.get_collections().collections]

    if recreate and collection_name in existing:
        client.delete_collection(collection_name)
        existing = []

    if collection_name not in existing:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )


def upsert_chunks(chunks: List[Dict[str, Any]], vectors: List[List[float]]) -> int:
    """
    Insert or update embedding chunks in Qdrant.

    Args:
        chunks:  list of {id, text, metadata} dicts
        vectors: parallel list of 1536-dim float vectors

    Returns:
        Number of points upserted.
    """
    ensure_collection()
    client = get_client()

    points = []
    for chunk, vector in zip(chunks, vectors):
        # Use a deterministic UUID based on the chunk id string
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk["id"]))
        payload = {
            "chunk_id": chunk["id"],
            "text": chunk["text"],
            **chunk.get("metadata", {}),
        }
        points.append(PointStruct(id=point_id, vector=vector, payload=payload))

    client.upsert(collection_name=settings.qdrant_collection, points=points)
    return len(points)


def search_similar(
    query_vector: List[float],
    top_k: int = 8,
    filter_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search for the most relevant schema chunks given a query vector.

    Args:
        query_vector: embedded question vector
        top_k:        number of results to return
        filter_type:  optional filter — "table" or "column"

    Returns:
        List of payload dicts with an added 'score' key.
    """
    ensure_collection()
    client = get_client()

    search_filter = None
    if filter_type:
        search_filter = Filter(
            must=[FieldCondition(key="type", match=MatchValue(value=filter_type))]
        )

    results = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        limit=top_k,
        query_filter=search_filter,
        with_payload=True,
    )

    return [
        {**hit.payload, "score": hit.score}
        for hit in results
    ]


def delete_all() -> None:
    """Wipe all vectors in the collection (used when re-uploading a file)."""
    client = get_client()
    ensure_collection(recreate=True)


def collection_info() -> Dict[str, Any]:
    """Return basic stats about the collection."""
    ensure_collection()
    client = get_client()
    info = client.get_collection(settings.qdrant_collection)
    return {
        "name": settings.qdrant_collection,
        "vectors_count": info.vectors_count,
        "points_count": info.points_count,
        "status": str(info.status),
    }
