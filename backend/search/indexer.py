"""
Background indexing worker using asyncio.Queue.
Non-blocking queue-based indexing that runs on app startup.
"""

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class IndexJob:
    """A job to index one or more images."""

    image_id: str
    image_path: str
    prompt_id: str
    prompt_text: str = ""


class BackgroundIndexer:
    """Background worker for async image indexing."""

    # Maximum queue size to prevent unbounded memory growth
    MAX_QUEUE_SIZE = 1000

    def __init__(self, images_dir: str | Path):
        """
        Initialize the background indexer.

        Args:
            images_dir: Base directory for generated images
        """
        self.images_dir = Path(images_dir)
        self.queue: asyncio.Queue[IndexJob] = asyncio.Queue(maxsize=self.MAX_QUEUE_SIZE)
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._search_service = None

    @property
    def search_service(self):
        """Lazy import to avoid circular dependencies."""
        if self._search_service is None:
            from .search_service import get_search_service
            self._search_service = get_search_service(self.images_dir)
        return self._search_service

    async def start(self) -> None:
        """Start the background worker."""
        if self._running:
            logger.warning("Background indexer already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._worker())
        logger.info("Background indexer started")

    async def stop(self) -> None:
        """Stop the background worker gracefully."""
        if not self._running:
            return

        self._running = False

        # Process remaining items
        while not self.queue.empty():
            try:
                job = self.queue.get_nowait()
                await self._process_job(job)
            except asyncio.QueueEmpty:
                break

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        logger.info("Background indexer stopped")

    async def _worker(self) -> None:
        """Main worker loop."""
        logger.info("Background indexer worker started")

        while self._running:
            try:
                # Wait for a job with timeout to allow clean shutdown
                job = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                await self._process_job(job)
                self.queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in indexer worker: {e}")

    async def _process_job(self, job: IndexJob) -> None:
        """Process a single indexing job."""
        try:
            logger.debug(f"Processing job: {job.image_id}")
            # Run blocking embedding in thread pool
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                self.search_service.index_image,
                job.image_id,
                job.image_path,
                job.prompt_id,
                job.prompt_text,
            )
            logger.debug(f"Completed job: {job.image_id}")
        except Exception as e:
            logger.error(f"Failed to index {job.image_id}: {e}", exc_info=True)

    def queue_for_indexing(
        self,
        image_id: str,
        image_path: str,
        prompt_id: str,
        prompt_text: str = "",
    ) -> None:
        """
        Queue an image for background indexing.

        This is non-blocking and returns immediately.
        """
        job = IndexJob(
            image_id=image_id,
            image_path=image_path,
            prompt_id=prompt_id,
            prompt_text=prompt_text,
        )
        try:
            self.queue.put_nowait(job)
            logger.debug(f"Queued for indexing: {image_id}")
        except asyncio.QueueFull:
            logger.warning(f"Index queue full, dropping: {image_id}")

    def queue_multiple(self, images: list[dict]) -> int:
        """
        Queue multiple images for indexing.

        Args:
            images: List of dicts with id, image_path, prompt_id, prompt_text

        Returns:
            Number of images queued
        """
        count = 0
        for img in images:
            self.queue_for_indexing(
                image_id=img["id"],
                image_path=img["image_path"],
                prompt_id=img["prompt_id"],
                prompt_text=img.get("prompt_text", ""),
            )
            count += 1
        return count

    @property
    def pending_count(self) -> int:
        """Number of jobs waiting in queue."""
        return self.queue.qsize()

    @property
    def is_running(self) -> bool:
        """Whether the worker is running."""
        return self._running


# Global singleton
_indexer: Optional[BackgroundIndexer] = None


def get_background_indexer(images_dir: Optional[str | Path] = None) -> BackgroundIndexer:
    """Get the global background indexer instance."""
    global _indexer
    if _indexer is None:
        if images_dir is None:
            images_dir = Path(__file__).parent.parent.parent / "generated_images"
        _indexer = BackgroundIndexer(images_dir)
    return _indexer
