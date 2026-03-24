import json
from typing import List, Tuple
import math


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(vec1) != len(vec2) or not vec1:
        return 0.0

    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def serialize_embedding(embedding: List[float]) -> str:
    """
    Serialize a 3D face embedding (list of floats) to JSON for DB storage.
    """
    return json.dumps(embedding)


def deserialize_embedding(data: str) -> List[float]:
    """
    Deserialize a JSON-encoded embedding string back to a list of floats.
    """
    if not data:
        return []
    try:
        value = json.loads(data)
        if isinstance(value, list):
            return [float(x) for x in value]
        return []
    except (TypeError, ValueError):
        return []


def verify_face(
    enrolled_embedding_json: str,
    probe_embedding: List[float],
    threshold: float = 0.8,
) -> Tuple[bool, float]:
    """
    Verify a 3D face embedding against an enrolled template.

    This function is model-agnostic: the actual 3D embedding is expected to be
    computed on the client (e.g., using 3D face landmarks / depth-aware model),
    and sent as a float vector. We simply compare vectors here.
    """
    enrolled_embedding = deserialize_embedding(enrolled_embedding_json)
    if not enrolled_embedding:
        return False, 0.0

    similarity = _cosine_similarity(enrolled_embedding, probe_embedding)
    return similarity >= threshold, similarity

