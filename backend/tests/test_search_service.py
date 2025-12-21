"""Tests for the search service components."""

import numpy as np
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Import the modules we're testing
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.search.vector_store import VectorStore, _escape_sql_string


class TestEscapeSqlString:
    """Test SQL string escaping for injection prevention."""

    def test_valid_image_id(self):
        """Valid image IDs should pass through."""
        assert _escape_sql_string("img-abc12345") == "img-abc12345"
        assert _escape_sql_string("img-00000000") == "img-00000000"

    def test_valid_with_dots(self):
        """IDs with dots should pass."""
        assert _escape_sql_string("file.jpg") == "file.jpg"
        assert _escape_sql_string("img-abc.test") == "img-abc.test"

    def test_valid_with_underscores(self):
        """IDs with underscores should pass."""
        assert _escape_sql_string("img_abc_123") == "img_abc_123"

    def test_rejects_single_quote(self):
        """Single quotes should be rejected (SQL injection attempt)."""
        with pytest.raises(ValueError, match="Invalid ID format"):
            _escape_sql_string("img'; DROP TABLE images;--")

    def test_rejects_spaces(self):
        """Spaces should be rejected."""
        with pytest.raises(ValueError, match="Invalid ID format"):
            _escape_sql_string("img abc")

    def test_rejects_semicolons(self):
        """Semicolons should be rejected."""
        with pytest.raises(ValueError, match="Invalid ID format"):
            _escape_sql_string("img;abc")

    def test_rejects_special_chars(self):
        """Special characters should be rejected."""
        for char in ["'", '"', ";", "(", ")", " ", "\n", "\t", "=", "<", ">"]:
            with pytest.raises(ValueError, match="Invalid ID format"):
                _escape_sql_string(f"img{char}test")


class TestVectorStore:
    """Test VectorStore functionality."""

    @pytest.fixture
    def temp_db_path(self):
        """Create a temporary database path."""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir) / "test_index"
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def vector_store(self, temp_db_path):
        """Create a VectorStore instance for testing."""
        return VectorStore(temp_db_path)

    def test_init_creates_directory(self, temp_db_path):
        """VectorStore should create the database directory."""
        store = VectorStore(temp_db_path)
        assert temp_db_path.exists()

    def test_table_creation(self, vector_store):
        """Accessing table should create it if not exists."""
        table = vector_store.table
        assert table is not None
        tables_response = vector_store.db.list_tables()
        # LanceDB returns ListTablesResponse object with .tables attribute
        table_names = tables_response.tables if hasattr(tables_response, 'tables') else list(tables_response)
        assert "images" in table_names

    def test_add_and_retrieve_image(self, vector_store):
        """Should be able to add and check if image is indexed."""
        # Create a dummy 768-dim vector
        vector = np.random.randn(768).astype(np.float32)
        vector = vector / np.linalg.norm(vector)  # Normalize

        vector_store.add_image(
            image_id="img-test1234",
            image_path="test.jpg",
            vector=vector,
            prompt_id="prompt-1",
            prompt_text="test prompt",
        )

        assert vector_store.is_indexed("img-test1234")
        assert not vector_store.is_indexed("img-nonexistent")

    def test_count(self, vector_store):
        """Count should reflect number of indexed images."""
        assert vector_store.count() == 0

        vector = np.random.randn(768).astype(np.float32)
        vector = vector / np.linalg.norm(vector)

        vector_store.add_image(
            image_id="img-test0001",
            image_path="test1.jpg",
            vector=vector,
            prompt_id="prompt-1",
        )
        assert vector_store.count() == 1

        vector_store.add_image(
            image_id="img-test0002",
            image_path="test2.jpg",
            vector=vector,
            prompt_id="prompt-1",
        )
        assert vector_store.count() == 2

    def test_duplicate_add_skipped(self, vector_store):
        """Adding the same image ID twice should skip."""
        vector = np.random.randn(768).astype(np.float32)
        vector = vector / np.linalg.norm(vector)

        vector_store.add_image(
            image_id="img-duplicate",
            image_path="test.jpg",
            vector=vector,
            prompt_id="prompt-1",
        )
        # Add again - should be skipped
        vector_store.add_image(
            image_id="img-duplicate",
            image_path="test2.jpg",  # Different path
            vector=vector,
            prompt_id="prompt-2",
        )

        assert vector_store.count() == 1

    def test_delete_image(self, vector_store):
        """Should be able to delete an indexed image."""
        vector = np.random.randn(768).astype(np.float32)
        vector = vector / np.linalg.norm(vector)

        vector_store.add_image(
            image_id="img-todelete",
            image_path="test.jpg",
            vector=vector,
            prompt_id="prompt-1",
        )
        assert vector_store.is_indexed("img-todelete")

        result = vector_store.delete_image("img-todelete")
        assert result is True
        assert not vector_store.is_indexed("img-todelete")

    def test_delete_nonexistent(self, vector_store):
        """Deleting non-existent image should not raise error."""
        # This shouldn't raise, but may return True (LanceDB delete behavior)
        vector_store.delete_image("img-nonexistent")

    def test_get_indexed_ids(self, vector_store):
        """Should return all indexed image IDs."""
        vector = np.random.randn(768).astype(np.float32)
        vector = vector / np.linalg.norm(vector)

        for i in range(3):
            vector_store.add_image(
                image_id=f"img-batch{i:04d}",
                image_path=f"test{i}.jpg",
                vector=vector,
                prompt_id="prompt-1",
            )

        ids = vector_store.get_indexed_ids()
        assert len(ids) == 3
        assert "img-batch0000" in ids
        assert "img-batch0001" in ids
        assert "img-batch0002" in ids

    def test_search_by_vector(self, vector_store):
        """Search should return similar vectors."""
        # Add some vectors
        for i in range(5):
            vector = np.zeros(768, dtype=np.float32)
            vector[i] = 1.0  # Each vector has a 1 in a different position
            vector_store.add_image(
                image_id=f"img-search{i:04d}",
                image_path=f"test{i}.jpg",
                vector=vector,
                prompt_id="prompt-1",
            )

        # Search with a query that matches the first vector
        query = np.zeros(768, dtype=np.float32)
        query[0] = 1.0

        results = vector_store.search_by_vector(query, limit=3)

        assert len(results) <= 3
        # First result should be the matching vector
        assert results[0]["id"] == "img-search0000"
        # Score should be high (close to 1.0)
        assert results[0]["score"] > 0.9

    def test_search_excludes_ids(self, vector_store):
        """Search should exclude specified IDs."""
        # Add identical vectors
        vector = np.random.randn(768).astype(np.float32)
        vector = vector / np.linalg.norm(vector)

        for i in range(3):
            vector_store.add_image(
                image_id=f"img-exclude{i}",
                image_path=f"test{i}.jpg",
                vector=vector,
                prompt_id="prompt-1",
            )

        results = vector_store.search_by_vector(
            vector, limit=10, exclude_ids=["img-exclude0"]
        )

        result_ids = [r["id"] for r in results]
        assert "img-exclude0" not in result_ids

    def test_similarity_score_range(self, vector_store):
        """Similarity scores should be in valid 0-1 range."""
        # Add two opposite vectors
        v1 = np.zeros(768, dtype=np.float32)
        v1[0] = 1.0
        v2 = np.zeros(768, dtype=np.float32)
        v2[0] = -1.0  # Opposite direction

        vector_store.add_image(
            image_id="img-pos",
            image_path="pos.jpg",
            vector=v1,
            prompt_id="prompt-1",
        )
        vector_store.add_image(
            image_id="img-neg",
            image_path="neg.jpg",
            vector=v2,
            prompt_id="prompt-1",
        )

        results = vector_store.search_by_vector(v1, limit=10)

        for r in results:
            assert 0.0 <= r["score"] <= 1.0, f"Score {r['score']} out of range"


class TestSqlInjectionPrevention:
    """Test that SQL injection is prevented in all methods."""

    @pytest.fixture
    def temp_db_path(self):
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir) / "test_index"
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def vector_store(self, temp_db_path):
        return VectorStore(temp_db_path)

    def test_delete_rejects_injection(self, vector_store):
        """Delete should reject SQL injection attempts."""
        result = vector_store.delete_image("img'; DROP TABLE images;--")
        assert result is False  # Should fail gracefully

    def test_is_indexed_rejects_injection(self, vector_store):
        """is_indexed should reject SQL injection attempts."""
        result = vector_store.is_indexed("img' OR '1'='1")
        assert result is False  # Should fail gracefully


class TestBackgroundIndexer:
    """Tests for the BackgroundIndexer async worker."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for testing."""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir)
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def indexer(self, temp_dir):
        """Create a BackgroundIndexer instance for testing."""
        from backend.search.indexer import BackgroundIndexer
        return BackgroundIndexer(temp_dir)

    def test_init(self, indexer, temp_dir):
        """BackgroundIndexer should initialize correctly."""
        assert indexer.images_dir == temp_dir
        assert indexer.pending_count == 0
        assert indexer.is_running is False

    def test_queue_for_indexing(self, indexer):
        """Should queue jobs for indexing."""
        indexer.queue_for_indexing(
            image_id="img-test1234",
            image_path="test.jpg",
            prompt_id="prompt-1",
            prompt_text="test prompt",
        )
        assert indexer.pending_count == 1

    def test_queue_multiple(self, indexer):
        """Should queue multiple jobs."""
        images = [
            {"id": "img-001", "image_path": "1.jpg", "prompt_id": "p1", "prompt_text": "text1"},
            {"id": "img-002", "image_path": "2.jpg", "prompt_id": "p1", "prompt_text": "text2"},
            {"id": "img-003", "image_path": "3.jpg", "prompt_id": "p2"},
        ]
        count = indexer.queue_multiple(images)
        assert count == 3
        assert indexer.pending_count == 3

    @pytest.mark.asyncio
    async def test_start_stop(self, indexer):
        """Should start and stop cleanly."""
        await indexer.start()
        assert indexer.is_running is True

        await indexer.stop()
        assert indexer.is_running is False

    @pytest.mark.asyncio
    async def test_start_twice(self, indexer):
        """Starting twice should be safe."""
        await indexer.start()
        await indexer.start()  # Should not raise
        assert indexer.is_running is True
        await indexer.stop()

    @pytest.mark.asyncio
    async def test_stop_when_not_running(self, indexer):
        """Stopping when not running should be safe."""
        await indexer.stop()  # Should not raise
        assert indexer.is_running is False

    def test_queue_full_behavior(self, indexer):
        """Should handle queue full gracefully."""
        import asyncio
        from backend.search.indexer import BackgroundIndexer

        # Create indexer with small queue
        small_queue_indexer = BackgroundIndexer(indexer.images_dir)
        small_queue_indexer.queue = MagicMock()
        # Use asyncio.QueueFull as that's what the code catches
        small_queue_indexer.queue.put_nowait.side_effect = [None, None, asyncio.QueueFull()]

        # These should not raise
        small_queue_indexer.queue_for_indexing("img-1", "1.jpg", "p1")
        small_queue_indexer.queue_for_indexing("img-2", "2.jpg", "p1")
        small_queue_indexer.queue_for_indexing("img-3", "3.jpg", "p1")  # This one drops silently


class TestSearchService:
    """Tests for the SearchService orchestration layer."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for testing."""
        temp_dir = tempfile.mkdtemp()
        # Create subdirectories expected by SearchService
        (Path(temp_dir) / "search_index").mkdir()
        yield Path(temp_dir)
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def mock_embedding_service(self):
        """Create a mock embedding service."""
        mock = MagicMock()
        mock.EMBEDDING_DIM = 768
        # Return a normalized random vector
        def make_vector(*args, **kwargs):
            v = np.random.randn(768).astype(np.float32)
            return v / np.linalg.norm(v)
        mock.embed_image.side_effect = make_vector
        mock.embed_text.side_effect = make_vector
        return mock

    @pytest.fixture
    def search_service(self, temp_dir, mock_embedding_service):
        """Create a SearchService with mocked embedding."""
        from backend.search.search_service import SearchService
        service = SearchService(temp_dir)
        service.embedding_service = mock_embedding_service
        return service

    def test_init(self, search_service, temp_dir):
        """SearchService should initialize correctly."""
        assert search_service.images_dir == temp_dir
        assert search_service.embedding_service is not None
        assert search_service.vector_store is not None

    def test_search_by_text_empty_query(self, search_service):
        """Empty text query should return empty results."""
        results = search_service.search_by_text("")
        assert results == []
        results = search_service.search_by_text("   ")
        assert results == []

    def test_search_by_text(self, search_service, temp_dir):
        """Text search should work with indexed images."""
        # Create a test image file
        test_image = temp_dir / "test.jpg"
        from PIL import Image
        img = Image.new("RGB", (100, 100), color="red")
        img.save(test_image)

        # Index the image
        search_service.index_image(
            image_id="img-test001",
            image_path="test.jpg",
            prompt_id="prompt-1",
            prompt_text="a red square",
        )

        # Search
        results = search_service.search_by_text("red square")
        assert len(results) >= 1
        assert results[0].id == "img-test001"

    def test_index_image_file_not_found(self, search_service):
        """Should return False for non-existent image."""
        result = search_service.index_image(
            image_id="img-missing",
            image_path="nonexistent.jpg",
            prompt_id="prompt-1",
        )
        assert result is False

    def test_index_image_success(self, search_service, temp_dir):
        """Should successfully index an image."""
        # Create a test image file
        test_image = temp_dir / "test.jpg"
        from PIL import Image
        img = Image.new("RGB", (100, 100), color="blue")
        img.save(test_image)

        result = search_service.index_image(
            image_id="img-test002",
            image_path="test.jpg",
            prompt_id="prompt-1",
            prompt_text="a blue square",
        )
        assert result is True
        assert "img-test002" in search_service.get_indexed_ids()

    def test_index_image_already_indexed(self, search_service, temp_dir):
        """Should skip already indexed images."""
        # Create a test image file
        test_image = temp_dir / "test.jpg"
        from PIL import Image
        img = Image.new("RGB", (100, 100), color="green")
        img.save(test_image)

        # Index once
        search_service.index_image(
            image_id="img-test003",
            image_path="test.jpg",
            prompt_id="prompt-1",
        )
        # Index again - should return True (already indexed)
        result = search_service.index_image(
            image_id="img-test003",
            image_path="test.jpg",
            prompt_id="prompt-1",
        )
        assert result is True

    def test_index_images_batch(self, search_service, temp_dir):
        """Should batch index multiple images."""
        # Create test images
        from PIL import Image
        for i in range(3):
            img = Image.new("RGB", (100, 100), color=(i * 50, i * 50, i * 50))
            img.save(temp_dir / f"batch{i}.jpg")

        images = [
            {"id": f"img-batch{i}", "image_path": f"batch{i}.jpg", "prompt_id": "p1"}
            for i in range(3)
        ]
        # Add one non-existent image
        images.append({"id": "img-missing", "image_path": "missing.jpg", "prompt_id": "p1"})

        indexed, failed = search_service.index_images_batch(images)
        assert indexed == 3
        assert failed == 1

    def test_get_stats(self, search_service, temp_dir):
        """Should return correct stats."""
        # Create and index a test image
        from PIL import Image
        test_image = temp_dir / "stats_test.jpg"
        img = Image.new("RGB", (100, 100))
        img.save(test_image)

        # Get count before indexing
        initial_count = search_service.vector_store.count()

        search_service.index_image(
            image_id="img-stats",
            image_path="stats_test.jpg",
            prompt_id="prompt-1",
        )

        stats = search_service.get_stats()
        # Count should have increased by 1
        assert stats["indexed_count"] == initial_count + 1
        assert stats["embedding_dim"] == 768

    def test_search_by_image(self, search_service, temp_dir):
        """Should find similar images."""
        from PIL import Image

        # Create and index multiple test images
        for i in range(3):
            img = Image.new("RGB", (100, 100), color=(i * 80, i * 80, i * 80))
            img.save(temp_dir / f"similar{i}.jpg")
            search_service.index_image(
                image_id=f"img-similar{i}",
                image_path=f"similar{i}.jpg",
                prompt_id="prompt-1",
            )

        # Search by the first image
        results = search_service.search_by_image(
            image_id="img-similar0",
            image_path="similar0.jpg",
            limit=10,
        )

        # The source image should be excluded
        result_ids = [r.id for r in results]
        assert "img-similar0" not in result_ids
        # Other images should be in results
        assert len(results) >= 1
