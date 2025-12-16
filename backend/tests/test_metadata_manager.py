"""Tests for MetadataManager class."""

import json
from pathlib import Path

import pytest


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
