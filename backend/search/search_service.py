"""
High-level search service orchestrating embeddings and vector store.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .embedding_service import get_embedding_service
from .vector_store import get_vector_store

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single search result."""

    id: str
    image_path: str
    prompt_id: str
    score: float  # 0-1 similarity score


class SearchService:
    """High-level search service for semantic image search."""

    def __init__(self, images_dir: str | Path):
        """
        Initialize the search service.

        Args:
            images_dir: Base directory for generated images
        """
        self.images_dir = Path(images_dir)
        self.embedding_service = get_embedding_service()
        self.vector_store = get_vector_store(self.images_dir / "search_index")

    def search_by_text(self, query: str, limit: int = 20) -> list[SearchResult]:
        """
        Search images by text query using semantic embedding.

        Args:
            query: Text query
            limit: Maximum results

        Returns:
            List of SearchResult sorted by similarity
        """
        if not query.strip():
            return []

        logger.info(f"Semantic text search: '{query}' (limit={limit})")

        # Generate text embedding
        query_vector = self.embedding_service.embed_text(query)

        # Search vector store
        results = self.vector_store.search_by_vector(query_vector, limit=limit)

        return [
            SearchResult(
                id=r["id"],
                image_path=r["image_path"],
                prompt_id=r["prompt_id"],
                score=r["score"],
            )
            for r in results
        ]

    def search_by_image(
        self,
        image_id: str,
        image_path: str,
        limit: int = 20,
    ) -> list[SearchResult]:
        """
        Find images similar to a given image.

        Args:
            image_id: ID of the source image
            image_path: Path to the source image
            limit: Maximum results (excluding the source image)

        Returns:
            List of SearchResult sorted by similarity
        """
        logger.info(f"Similar image search: {image_id} (limit={limit})")

        full_path = self.images_dir / image_path

        # Generate image embedding
        query_vector = self.embedding_service.embed_image(full_path)

        # Search, excluding the source image
        results = self.vector_store.search_by_vector(
            query_vector,
            limit=limit,
            exclude_ids=[image_id],
        )

        return [
            SearchResult(
                id=r["id"],
                image_path=r["image_path"],
                prompt_id=r["prompt_id"],
                score=r["score"],
            )
            for r in results
        ]

    def index_image(
        self,
        image_id: str,
        image_path: str,
        prompt_id: str,
        prompt_text: str = "",
    ) -> bool:
        """
        Index a single image.

        Args:
            image_id: Image ID
            image_path: Relative path to image
            prompt_id: Parent prompt ID
            prompt_text: Generation prompt text

        Returns:
            True if indexed successfully
        """
        full_path = self.images_dir / image_path

        if not full_path.exists():
            logger.warning(f"Image not found: {full_path}")
            return False

        if self.vector_store.is_indexed(image_id):
            logger.debug(f"Image already indexed: {image_id}")
            return True

        try:
            # Generate embedding
            vector = self.embedding_service.embed_image(full_path)

            # Store in vector database
            self.vector_store.add_image(
                image_id=image_id,
                image_path=image_path,
                vector=vector,
                prompt_id=prompt_id,
                prompt_text=prompt_text,
            )

            logger.info(f"Indexed image: {image_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to index image {image_id}: {e}")
            return False

    def index_images_batch(
        self,
        images: list[dict],
    ) -> tuple[int, int]:
        """
        Index multiple images.

        Args:
            images: List of dicts with id, image_path, prompt_id, prompt_text

        Returns:
            Tuple of (indexed_count, failed_count)
        """
        indexed = 0
        failed = 0

        for img in images:
            success = self.index_image(
                image_id=img["id"],
                image_path=img["image_path"],
                prompt_id=img["prompt_id"],
                prompt_text=img.get("prompt_text", ""),
            )
            if success:
                indexed += 1
            else:
                failed += 1

        logger.info(f"Batch indexing complete: {indexed} indexed, {failed} failed")
        return indexed, failed

    def get_indexed_ids(self) -> set[str]:
        """Get all indexed image IDs."""
        return self.vector_store.get_indexed_ids()

    def get_stats(self) -> dict:
        """Get index statistics."""
        return {
            "indexed_count": self.vector_store.count(),
            "embedding_dim": self.embedding_service.EMBEDDING_DIM,
        }


# Global singleton
_search_service: Optional[SearchService] = None


def get_search_service(images_dir: Optional[str | Path] = None) -> SearchService:
    """Get the global search service instance."""
    global _search_service
    if _search_service is None:
        if images_dir is None:
            images_dir = Path(__file__).parent.parent.parent / "generated_images"
        _search_service = SearchService(images_dir)
    return _search_service
