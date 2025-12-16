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
