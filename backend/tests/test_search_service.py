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
        assert "images" in vector_store.db.list_tables()

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
