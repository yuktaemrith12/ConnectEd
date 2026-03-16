"""
ChromaDB vector index manager.
One collection per tutor, namespaced as "tutor_{id}".
"""

import logging
import os
from typing import List, Tuple

logger = logging.getLogger(__name__)


def _chroma_persist_dir() -> str:
    base = os.path.join(
        os.path.dirname(  # services/ai_tutor/
            os.path.dirname(  # services/
                os.path.dirname(  # app/
                    os.path.dirname(os.path.abspath(__file__))  # app/core/
                )
            )
        ),
        "uploads", "chroma_db",
    )
    os.makedirs(base, exist_ok=True)
    return base


def _get_client():
    try:
        import chromadb
        return chromadb.PersistentClient(path=_chroma_persist_dir())
    except ImportError:
        raise RuntimeError(
            "chromadb is not installed. Run: pip install chromadb"
        )


def get_or_create_collection(tutor_id: int):
    client = _get_client()
    return client.get_or_create_collection(
        name=f"tutor_{tutor_id}",
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(
    tutor_id: int,
    chunk_texts: List[str],
    embeddings: List[List[float]],
    metadatas: List[dict],
    ids: List[str],
) -> None:
    collection = get_or_create_collection(tutor_id)
    collection.add(
        documents=chunk_texts,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )


def query_collection(
    tutor_id: int,
    query_embedding: List[float],
    n_results: int = 6,
) -> Tuple[List[str], List[dict], List[float]]:
    collection = get_or_create_collection(tutor_id)
    try:
        result = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
        docs      = result["documents"][0] if result["documents"] else []
        metas     = result["metadatas"][0] if result["metadatas"] else []
        distances = result["distances"][0] if result["distances"] else []
        return docs, metas, distances
    except Exception as e:
        logger.warning(f"Vector query failed for tutor {tutor_id}: {e}")
        return [], [], []


def delete_chunks_by_ids(tutor_id: int, chunk_ids: List[str]) -> None:
    if not chunk_ids:
        return
    collection = get_or_create_collection(tutor_id)
    collection.delete(ids=chunk_ids)


def delete_collection(tutor_id: int) -> None:
    try:
        client = _get_client()
        client.delete_collection(f"tutor_{tutor_id}")
    except Exception as e:
        logger.warning(f"Could not delete collection for tutor {tutor_id}: {e}")
