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
