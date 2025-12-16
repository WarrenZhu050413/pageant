"""Pytest fixtures for gemini-pageant API tests."""

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Add backend directory to path for imports
BACKEND_DIR = Path(__file__).parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(scope="function")
def test_data_dir(tmp_path):
    """Create a temporary directory for test data."""
    images_dir = tmp_path / "generated_images"
    images_dir.mkdir()

    # Create initial metadata
    metadata = {
        "generated_at": "2025-12-13T00:00:00",
        "model": "gemini-3-pro-image-preview",
        "prompts": [
            {
                "id": "prompt-test123",
                "prompt": "Test prompt",
                "title": "Test Image",
                "category": "Test",
                "created_at": "2025-12-13T00:00:00",
                "images": [
                    {
                        "id": "img-test123",
                        "image_path": "test-image.png",
                        "mime_type": "image/png",
                        "generated_at": "2025-12-13T00:00:00",
                    }
                ],
            }
        ],
        "favorites": [],
        "templates": [],
        "stories": [],
        "collections": [],
    }

    with open(images_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    # Create a dummy test image file
    (images_dir / "test-image.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

    return tmp_path


@pytest.fixture(scope="function")
def client(test_data_dir, monkeypatch):
    """Create a test client with isolated data directory."""
    # Remove cached server module to allow re-patching
    if "server" in sys.modules:
        del sys.modules["server"]
    if "metadata_manager" in sys.modules:
        del sys.modules["metadata_manager"]

    # Patch paths
    images_dir = test_data_dir / "generated_images"
    metadata_path = images_dir / "metadata.json"

    # Import modules
    from metadata_manager import MetadataManager
    import server as server_module

    # Patch paths
    monkeypatch.setattr(server_module, "BASE_DIR", test_data_dir)
    monkeypatch.setattr(server_module, "IMAGES_DIR", images_dir)
    monkeypatch.setattr(server_module, "METADATA_PATH", metadata_path)

    # Create and patch new MetadataManager with test paths
    test_manager = MetadataManager(metadata_path, images_dir)
    monkeypatch.setattr(server_module, "_metadata_manager", test_manager)

    # Return test client
    return TestClient(server_module.app)


@pytest.fixture
def sample_image_id():
    """Return the test image ID."""
    return "img-test123"


@pytest.fixture
def sample_prompt_id():
    """Return the test prompt ID."""
    return "prompt-test123"


@pytest.fixture
def reload_metadata(test_data_dir, client):
    """Fixture that returns a function to reload metadata (simulating restart)."""
    def _reload():
        import server as server_module
        # Force reload by clearing any cached data
        # The load_metadata function reads from disk, so this should work
        pass
    return _reload
