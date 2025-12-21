"""
LanceDB vector store for image embeddings.
Stores index in generated_images/search_index/
"""

import logging
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import lancedb
import numpy as np
import pyarrow as pa

from .embedding_service import EmbeddingService

logger = logging.getLogger(__name__)
_table_lock = threading.Lock()


def _escape_sql_string(value: str) -> str:
    """Escape a string for use in SQL WHERE clauses.

    Prevents SQL injection by escaping single quotes and validating format.
    """
    # Image IDs should match pattern: img-{8 hex chars} or similar
    # Reject anything that doesn't look like a valid ID
    if not re.match(r'^[\w\-\.]+$', value):
        raise ValueError(f"Invalid ID format: {value}")
    # Escape single quotes (SQL standard: '' escapes a single quote)
    return value.replace("'", "''")


class VectorStore:
    """LanceDB wrapper for storing and searching image embeddings."""

    TABLE_NAME = "images"

    def __init__(self, db_path: str | Path):
        """
        Initialize the vector store.

        Args:
            db_path: Path to LanceDB database directory
        """
        self.db_path = Path(db_path)
        self.db_path.mkdir(parents=True, exist_ok=True)
        self.db = lancedb.connect(str(self.db_path))
        self._table: Optional[lancedb.table.Table] = None

    def _get_table_names(self) -> list[str]:
        """Get list of table names, handling both old and new LanceDB API."""
        result = self.db.list_tables()
        # New API returns ListTablesResponse with .tables attribute
        if hasattr(result, 'tables'):
            return result.tables
        return list(result)

    @property
    def table(self) -> lancedb.table.Table:
        """Get or create the images table. Thread-safe."""
        if self._table is not None:
            return self._table

        with _table_lock:
            # Double-check after acquiring lock
            if self._table is not None:
                return self._table

            # Check if table exists
            if self.TABLE_NAME in self._get_table_names():
                self._table = self.db.open_table(self.TABLE_NAME)
            else:
                # Create table with schema
                schema = pa.schema([
                    pa.field("id", pa.string()),
                    pa.field("image_path", pa.string()),
                    pa.field("vector", pa.list_(pa.float32(), EmbeddingService.EMBEDDING_DIM)),
                    pa.field("prompt_id", pa.string()),
                    pa.field("prompt_text", pa.string()),
                    pa.field("indexed_at", pa.string()),
                ])
                try:
                    self._table = self.db.create_table(self.TABLE_NAME, schema=schema)
                    logger.info(f"Created LanceDB table: {self.TABLE_NAME}")
                except Exception as e:
                    if "already exists" in str(e):
                        # Race condition - another thread created it
                        self._table = self.db.open_table(self.TABLE_NAME)
                    else:
                        raise

        return self._table

    def add_image(
        self,
        image_id: str,
        image_path: str,
        vector: np.ndarray,
        prompt_id: str,
        prompt_text: str = "",
    ) -> None:
        """
        Add an image embedding to the store.

        Args:
            image_id: Unique image identifier
            image_path: Path to the image file
            vector: 768-dim embedding vector
            prompt_id: Parent prompt ID
            prompt_text: Generation prompt text (for FTS)
        """
        # Check if already indexed
        if self.is_indexed(image_id):
            logger.debug(f"Image {image_id} already indexed, skipping")
            return

        data = [{
            "id": image_id,
            "image_path": image_path,
            "vector": vector.tolist(),
            "prompt_id": prompt_id,
            "prompt_text": prompt_text,
            "indexed_at": datetime.now().isoformat(),
        }]

        self.table.add(data)
        logger.debug(f"Indexed image: {image_id}")

    def search_by_vector(
        self,
        query_vector: np.ndarray,
        limit: int = 20,
        exclude_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Search for similar images by vector.

        Args:
            query_vector: Query embedding vector
            limit: Maximum number of results
            exclude_ids: Image IDs to exclude from results

        Returns:
            List of results with id, image_path, prompt_id, and score
        """
        search = self.table.search(query_vector.tolist()).limit(limit + len(exclude_ids or []))

        results = search.to_list()

        # Filter out excluded IDs and add similarity score
        filtered = []
        for r in results:
            if exclude_ids and r["id"] in exclude_ids:
                continue
            # Convert L2 distance to similarity score
            # For normalized vectors, L2 distance ranges 0-2 (0=identical, 2=opposite)
            # Convert to 0-1 similarity: 1.0 = identical, 0.0 = opposite
            distance = r.get("_distance", 0)
            similarity = max(0.0, min(1.0, 1.0 - distance / 2.0))
            filtered.append({
                "id": r["id"],
                "image_path": r["image_path"],
                "prompt_id": r["prompt_id"],
                "score": similarity,
            })
            if len(filtered) >= limit:
                break

        return filtered

    def delete_image(self, image_id: str) -> bool:
        """
        Delete an image from the index.

        Args:
            image_id: Image ID to delete

        Returns:
            True if deleted, False if not found
        """
        try:
            safe_id = _escape_sql_string(image_id)
            self.table.delete(f"id = '{safe_id}'")
            logger.debug(f"Deleted image from index: {image_id}")
            return True
        except ValueError as e:
            logger.warning(f"Invalid image ID format for delete: {image_id} - {e}")
            return False
        except Exception as e:
            logger.warning(f"Failed to delete image {image_id}: {e}")
            return False

    def is_indexed(self, image_id: str) -> bool:
        """Check if an image is already indexed."""
        try:
            safe_id = _escape_sql_string(image_id)
            results = self.table.search().where(f"id = '{safe_id}'").limit(1).to_list()
            return len(results) > 0
        except ValueError as e:
            logger.warning(f"Invalid image ID format for is_indexed: {image_id} - {e}")
            return False
        except Exception as e:
            logger.warning(f"Failed to check if indexed {image_id}: {e}")
            return False

    def get_indexed_ids(self) -> set[str]:
        """Get all indexed image IDs."""
        try:
            # Use LanceDB's native arrow format instead of pandas
            results = self.table.to_arrow()
            return set(results["id"].to_pylist())
        except Exception as e:
            logger.error(f"Failed to get indexed IDs: {e}")
            return set()

    def count(self) -> int:
        """Get the number of indexed images."""
        try:
            return self.table.count_rows()
        except Exception as e:
            logger.error(f"Failed to count indexed images: {e}")
            return 0


# Global singleton instance
_vector_store: Optional[VectorStore] = None


def get_vector_store(db_path: Optional[str | Path] = None) -> VectorStore:
    """
    Get the global vector store instance.

    Args:
        db_path: Path to database (only used on first call)
    """
    global _vector_store
    if _vector_store is None:
        if db_path is None:
            # Default path relative to generated_images
            db_path = Path(__file__).parent.parent.parent / "generated_images" / "search_index"
        _vector_store = VectorStore(db_path)
    return _vector_store
