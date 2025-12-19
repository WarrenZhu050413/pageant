"""Tests for MetadataManager class."""

import json
from pathlib import Path

import pytest

# Use anyio for async tests (it's already a pytest plugin in our setup)
pytestmark = pytest.mark.anyio


class TestMetadataManagerLoadSave:
    """Test basic load and save functionality."""

    def test_load_creates_default_metadata_when_file_missing(self, tmp_path):
        """When metadata file doesn't exist, load returns default structure."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()

        assert "prompts" in data
        assert "favorites" in data
        assert "templates" in data
        assert "stories" in data
        assert "collections" in data
        assert "sessions" in data
        assert data["prompts"] == []

    def test_load_reads_existing_metadata(self, tmp_path):
        """When metadata file exists, load reads it correctly."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Create existing metadata
        existing_data = {
            "prompts": [{"id": "test-1", "prompt": "Test prompt"}],
            "favorites": ["img-1"],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(existing_data, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()

        assert data["prompts"][0]["id"] == "test-1"
        assert data["favorites"] == ["img-1"]

    def test_save_writes_metadata_to_disk(self, tmp_path):
        """Save writes data to metadata file."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        manager = MetadataManager(metadata_path, images_dir)
        test_data = {
            "prompts": [{"id": "new-1", "prompt": "New prompt"}],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        manager.save(test_data)

        # Verify file was written
        assert metadata_path.exists()
        with open(metadata_path) as f:
            saved_data = json.load(f)
        assert saved_data["prompts"][0]["id"] == "new-1"

    def test_load_migrates_old_images_structure(self, tmp_path):
        """Load migrates old 'images' array to 'prompts' structure."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Create old-style metadata with 'images' array
        old_data = {
            "images": [
                {
                    "id": "img-1",
                    "prompt": "A cat",
                    "title": "Cat Image",
                    "category": "Animals",
                    "generated_at": "2025-01-01T00:00:00",
                }
            ],
            "favorites": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(old_data, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()

        # Should have migrated to prompts structure
        assert "prompts" in data
        assert len(data["prompts"]) == 1
        assert data["prompts"][0]["prompt"] == "A cat"
        assert data["prompts"][0]["images"][0]["id"] == "img-1"


class TestMetadataManagerFindImage:
    """Test find_image_by_id functionality."""

    def test_find_image_returns_image_and_prompt(self, tmp_path):
        """find_image_by_id returns (image_data, prompt_data) tuple when found."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Create test image file
        (images_dir / "test-image.png").write_bytes(b"\x89PNG\r\n\x1a\n")

        metadata = {
            "prompts": [{
                "id": "prompt-1",
                "prompt": "A cat",
                "images": [{
                    "id": "img-123",
                    "image_path": "test-image.png",
                    "mime_type": "image/png",
                }]
            }],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()
        img_data, prompt_data = manager.find_image_by_id(data, "img-123")

        assert img_data is not None
        assert img_data["id"] == "img-123"
        assert prompt_data is not None
        assert prompt_data["id"] == "prompt-1"

    def test_find_image_returns_none_when_not_found(self, tmp_path):
        """find_image_by_id returns (None, None) when image not found."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()
        img_data, prompt_data = manager.find_image_by_id(data, "nonexistent")

        assert img_data is None
        assert prompt_data is None

    def test_find_image_searches_all_prompts(self, tmp_path):
        """find_image_by_id searches through all prompts."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Create test image files
        (images_dir / "img1.png").write_bytes(b"\x89PNG")
        (images_dir / "img2.png").write_bytes(b"\x89PNG")

        metadata = {
            "prompts": [
                {
                    "id": "prompt-1",
                    "prompt": "First",
                    "images": [{"id": "img-1", "image_path": "img1.png"}]
                },
                {
                    "id": "prompt-2",
                    "prompt": "Second",
                    "images": [{"id": "img-2", "image_path": "img2.png"}]
                },
            ],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()

        # Should find image in second prompt
        img_data, prompt_data = manager.find_image_by_id(data, "img-2")
        assert img_data["id"] == "img-2"
        assert prompt_data["id"] == "prompt-2"


class TestMetadataManagerFindPrompt:
    """Test find_prompt_by_id functionality."""

    def test_find_prompt_returns_prompt_when_found(self, tmp_path):
        """find_prompt_by_id returns prompt dict when found."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [
                {"id": "prompt-1", "prompt": "First prompt"},
                {"id": "prompt-2", "prompt": "Second prompt"},
            ],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()
        prompt = manager.find_prompt_by_id(data, "prompt-2")

        assert prompt is not None
        assert prompt["id"] == "prompt-2"
        assert prompt["prompt"] == "Second prompt"

    def test_find_prompt_returns_none_when_not_found(self, tmp_path):
        """find_prompt_by_id returns None when prompt not found."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [{"id": "prompt-1", "prompt": "First prompt"}],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        data = manager.load()
        prompt = manager.find_prompt_by_id(data, "nonexistent")

        assert prompt is None


class TestMetadataManagerContextManager:
    """Test context manager functionality."""

    def test_context_manager_loads_metadata(self, tmp_path):
        """Context manager loads metadata on entry."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [{"id": "p1", "prompt": "Test"}],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        with manager as data:
            assert data["prompts"][0]["id"] == "p1"

    def test_context_manager_saves_on_exit(self, tmp_path):
        """Context manager saves metadata on exit."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        manager = MetadataManager(metadata_path, images_dir)
        with manager as data:
            data["prompts"].append({"id": "new-prompt", "prompt": "Added"})

        # Verify file was saved
        with open(metadata_path) as f:
            saved = json.load(f)
        assert len(saved["prompts"]) == 1
        assert saved["prompts"][0]["id"] == "new-prompt"

    def test_context_manager_saves_on_exception(self, tmp_path):
        """Context manager saves even when exception occurs."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        manager = MetadataManager(metadata_path, images_dir)
        try:
            with manager as data:
                data["prompts"].append({"id": "before-error", "prompt": "Test"})
                raise ValueError("Test error")
        except ValueError:
            pass

        # Verify file was still saved
        with open(metadata_path) as f:
            saved = json.load(f)
        assert len(saved["prompts"]) == 1
        assert saved["prompts"][0]["id"] == "before-error"


class TestMetadataManagerAsyncAtomic:
    """Test async atomic() context manager functionality."""

    async def test_atomic_loads_metadata(self, tmp_path):
        """atomic() loads metadata on entry."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [{"id": "p1", "prompt": "Test"}],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        manager = MetadataManager(metadata_path, images_dir)
        async with manager.atomic() as data:
            assert data["prompts"][0]["id"] == "p1"

    async def test_atomic_saves_on_exit(self, tmp_path):
        """atomic() saves metadata on exit."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        manager = MetadataManager(metadata_path, images_dir)
        async with manager.atomic() as data:
            data["prompts"].append({"id": "new-prompt", "prompt": "Added"})

        # Verify file was saved
        with open(metadata_path) as f:
            saved = json.load(f)
        assert len(saved["prompts"]) == 1
        assert saved["prompts"][0]["id"] == "new-prompt"

    async def test_atomic_concurrent_writes_preserve_all_data(self, tmp_path):
        """Concurrent atomic() calls should serialize writes, preserving all data.

        This is the key test for the race condition fix. Multiple coroutines
        writing to metadata concurrently should not overwrite each other.
        """
        import asyncio
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Start with empty prompts
        initial_metadata = {
            "prompts": [],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
            "tokens": [],
        }
        with open(metadata_path, "w") as f:
            json.dump(initial_metadata, f)

        manager = MetadataManager(metadata_path, images_dir)

        async def add_token(token_id: str, delay: float = 0):
            """Simulate a concept generation: read, delay (simulating API call), write."""
            # Simulate slow Gemini API call BEFORE acquiring lock
            await asyncio.sleep(delay)

            # Now acquire lock and write
            async with manager.atomic() as data:
                if "tokens" not in data:
                    data["tokens"] = []
                data["tokens"].append({"id": token_id, "name": f"Token {token_id}"})

        # Launch 5 concurrent writes with slight stagger
        tasks = [
            add_token("token-1", delay=0.01),
            add_token("token-2", delay=0.02),
            add_token("token-3", delay=0.01),
            add_token("token-4", delay=0.03),
            add_token("token-5", delay=0.02),
        ]
        await asyncio.gather(*tasks)

        # Verify ALL tokens were saved (no overwrites)
        with open(metadata_path) as f:
            saved = json.load(f)

        token_ids = {t["id"] for t in saved["tokens"]}
        assert token_ids == {"token-1", "token-2", "token-3", "token-4", "token-5"}, (
            f"Expected all 5 tokens, got {token_ids}. Race condition detected!"
        )

    async def test_atomic_does_not_block_event_loop(self, tmp_path):
        """atomic() should not block the event loop while waiting for lock.

        This verifies that other coroutines can run while one coroutine
        holds the lock.
        """
        import asyncio
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        manager = MetadataManager(metadata_path, images_dir)

        events = []

        async def worker_with_lock(worker_id: str):
            """Worker that holds the lock for a bit."""
            async with manager.atomic() as data:
                events.append(f"{worker_id}-acquired")
                await asyncio.sleep(0.05)  # Hold lock briefly
                data["prompts"].append({"id": worker_id})
                events.append(f"{worker_id}-released")

        async def other_work():
            """Other async work that should NOT be blocked."""
            await asyncio.sleep(0.01)
            events.append("other-work-done")

        # Start worker that will hold lock
        task1 = asyncio.create_task(worker_with_lock("worker-1"))
        await asyncio.sleep(0.01)  # Let worker-1 acquire lock

        # Start other work and second worker
        task2 = asyncio.create_task(other_work())
        task3 = asyncio.create_task(worker_with_lock("worker-2"))

        await asyncio.gather(task1, task2, task3)

        # other_work should complete while worker-1 holds the lock
        # (because lock waiting happens in thread pool, not blocking event loop)
        assert "other-work-done" in events, "Event loop was blocked!"

        # Verify the order shows worker-1 completed before worker-2 started
        worker1_released_idx = events.index("worker-1-released")
        worker2_acquired_idx = events.index("worker-2-acquired")
        assert worker1_released_idx < worker2_acquired_idx, (
            "Lock serialization failed - worker-2 acquired before worker-1 released"
        )


class TestMetadataManagerDeleteImage:
    """Test delete_image_file functionality."""

    def test_delete_image_removes_file(self, tmp_path):
        """delete_image_file removes the image file from disk."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Create test image file
        image_file = images_dir / "test-image.png"
        image_file.write_bytes(b"\x89PNG\r\n\x1a\n")
        assert image_file.exists()

        metadata = {
            "prompts": [],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }

        manager = MetadataManager(metadata_path, images_dir)
        manager.delete_image_file(metadata, "img-1", "test-image.png")

        assert not image_file.exists()

    def test_delete_image_removes_from_favorites(self, tmp_path):
        """delete_image_file removes image ID from favorites list."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        # Create test image file
        (images_dir / "test.png").write_bytes(b"\x89PNG")

        metadata = {
            "prompts": [],
            "favorites": ["img-1", "img-2", "img-3"],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }

        manager = MetadataManager(metadata_path, images_dir)
        manager.delete_image_file(metadata, "img-2", "test.png")

        assert metadata["favorites"] == ["img-1", "img-3"]

    def test_delete_image_handles_missing_file(self, tmp_path):
        """delete_image_file handles missing files gracefully."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [],
            "favorites": ["img-1"],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }

        manager = MetadataManager(metadata_path, images_dir)
        # Should not raise an exception
        manager.delete_image_file(metadata, "img-1", "nonexistent.png")

        # Should still remove from favorites
        assert metadata["favorites"] == []

    def test_delete_image_handles_none_path(self, tmp_path):
        """delete_image_file handles None image_path gracefully."""
        from metadata_manager import MetadataManager

        images_dir = tmp_path / "generated_images"
        images_dir.mkdir()
        metadata_path = images_dir / "metadata.json"

        metadata = {
            "prompts": [],
            "favorites": ["img-1"],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }

        manager = MetadataManager(metadata_path, images_dir)
        # Should not raise an exception
        manager.delete_image_file(metadata, "img-1", None)

        # Should still remove from favorites
        assert metadata["favorites"] == []


class TestResponseModels:
    """Test standardized API response models."""

    def test_list_response_structure(self):
        """ListResponse has items and count fields."""
        from server import ListResponse

        response = ListResponse(items=[{"id": "1"}, {"id": "2"}], count=2)
        assert response.items == [{"id": "1"}, {"id": "2"}]
        assert response.count == 2

    def test_list_response_auto_count(self):
        """ListResponse auto-calculates count if not provided."""
        from server import ListResponse

        response = ListResponse(items=[{"id": "1"}, {"id": "2"}, {"id": "3"}])
        assert response.count == 3

    def test_mutation_response_success(self):
        """MutationResponse indicates success."""
        from server import MutationResponse

        response = MutationResponse(success=True, id="item-123")
        assert response.success is True
        assert response.id == "item-123"


