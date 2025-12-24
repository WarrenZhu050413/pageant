"""Tests for batch image enhancement functionality.

Tests the /api/enhance-images endpoint which:
- Takes multiple image IDs
- Processes them in parallel (up to MAX_CONCURRENT_OPERATIONS)
- Groups all enhanced images into a single generation
"""

import base64
from unittest.mock import AsyncMock, patch
import pytest


@pytest.fixture
def multi_image_metadata(test_data_dir):
    """Create metadata with multiple images for batch testing."""
    import json

    images_dir = test_data_dir / "generated_images"
    metadata_path = images_dir / "metadata.json"

    # Create multiple test images
    for i in range(5):
        (images_dir / f"test-image-{i}.png").write_bytes(
            b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        )

    metadata = {
        "generated_at": "2025-12-13T00:00:00",
        "model": "gemini-3-pro-image-preview",
        "prompts": [
            {
                "id": "prompt-batch-test",
                "prompt": "Batch test prompt",
                "title": "Batch Test Images",
                "created_at": "2025-12-13T00:00:00",
                "images": [
                    {
                        "id": f"img-batch-{i}",
                        "image_path": f"test-image-{i}.png",
                        "mime_type": "image/png",
                        "generated_at": "2025-12-13T00:00:00",
                        "design_dimensions": {"color": {"axis": "color", "name": "Test"}},
                        "annotation": f"Test image {i}",
                    }
                    for i in range(5)
                ],
            }
        ],
        "favorites": [],
        "templates": [],
        "collections": [],
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return [f"img-batch-{i}" for i in range(5)]


def test_settings_returns_max_concurrent_operations(client):
    """GET /api/settings includes max_concurrent_operations."""
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "max_concurrent_operations" in data
    assert data["max_concurrent_operations"] == 6  # Default from config


def test_batch_enhance_empty_ids_returns_400(client):
    """POST /api/enhance-images with empty list returns 400."""
    response = client.post("/api/enhance-images", json={"image_ids": []})
    assert response.status_code == 400
    assert "No image IDs" in response.json()["detail"]


def test_batch_enhance_nonexistent_images_returns_500(client):
    """POST /api/enhance-images with all nonexistent images returns 500."""
    response = client.post(
        "/api/enhance-images",
        json={"image_ids": ["nonexistent-1", "nonexistent-2"]},
    )
    assert response.status_code == 500
    assert "No images were successfully enhanced" in response.json()["detail"]


def test_batch_enhance_creates_single_generation(client, test_data_dir, multi_image_metadata):
    """POST /api/enhance-images groups all images into one generation."""
    # Mock the gemini enhance_image to return fake enhanced image
    fake_image_data = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50).decode()

    class FakeImageResult:
        def __init__(self):
            self.images = [{"data": fake_image_data, "mime_type": "image/png"}]

    with patch("server.gemini") as mock_gemini:
        mock_gemini.enhance_image = AsyncMock(return_value=FakeImageResult())

        response = client.post(
            "/api/enhance-images",
            json={"image_ids": multi_image_metadata[:3]},  # Enhance 3 images
        )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["total_requested"] == 3
    assert data["total_enhanced"] == 3
    assert len(data["images"]) == 3
    assert "prompt_id" in data
    assert data["prompt_id"].startswith("enhanced-batch-")

    # Verify all images are in a single generation
    prompts_response = client.get("/api/prompts")
    prompts = prompts_response.json()["prompts"]

    # Find the enhanced batch generation
    batch_gen = None
    for prompt in prompts:
        if prompt["id"] == data["prompt_id"]:
            batch_gen = prompt
            break

    assert batch_gen is not None
    assert batch_gen["title"] == "Enhanced Uploaded Images"
    assert len(batch_gen["images"]) == 3


def test_batch_enhance_preserves_design_dimensions(client, test_data_dir, multi_image_metadata):
    """Enhanced images preserve design_dimensions from source."""
    fake_image_data = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50).decode()

    class FakeImageResult:
        def __init__(self):
            self.images = [{"data": fake_image_data, "mime_type": "image/png"}]

    with patch("server.gemini") as mock_gemini:
        mock_gemini.enhance_image = AsyncMock(return_value=FakeImageResult())

        response = client.post(
            "/api/enhance-images",
            json={"image_ids": [multi_image_metadata[0]]},
        )

    assert response.status_code == 200
    data = response.json()

    # Check that design_dimensions were copied
    enhanced_image = data["images"][0]
    assert "design_dimensions" in enhanced_image
    assert enhanced_image["design_dimensions"]["color"]["axis"] == "color"


def test_batch_enhance_preserves_annotation(client, test_data_dir, multi_image_metadata):
    """Enhanced images preserve annotation from source."""
    fake_image_data = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50).decode()

    class FakeImageResult:
        def __init__(self):
            self.images = [{"data": fake_image_data, "mime_type": "image/png"}]

    with patch("server.gemini") as mock_gemini:
        mock_gemini.enhance_image = AsyncMock(return_value=FakeImageResult())

        response = client.post(
            "/api/enhance-images",
            json={"image_ids": [multi_image_metadata[0]]},
        )

    assert response.status_code == 200
    enhanced_image = response.json()["images"][0]
    assert enhanced_image.get("annotation") == "Test image 0"


def test_batch_enhance_partial_failure(client, test_data_dir, multi_image_metadata):
    """Batch enhance continues even if some images fail."""
    fake_image_data = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50).decode()
    call_count = 0

    class FakeImageResult:
        def __init__(self):
            self.images = [{"data": fake_image_data, "mime_type": "image/png"}]

    async def mock_enhance(image_bytes, mime_type):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise Exception("Simulated failure")
        return FakeImageResult()

    with patch("server.gemini") as mock_gemini:
        mock_gemini.enhance_image = mock_enhance

        response = client.post(
            "/api/enhance-images",
            json={"image_ids": multi_image_metadata[:3]},
        )

    assert response.status_code == 200
    data = response.json()

    # Should have enhanced 2 out of 3
    assert data["total_requested"] == 3
    assert data["total_enhanced"] == 2


def test_batch_enhance_sets_source_image_id(client, test_data_dir, multi_image_metadata):
    """Enhanced images have source_image_id pointing to original."""
    fake_image_data = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50).decode()

    class FakeImageResult:
        def __init__(self):
            self.images = [{"data": fake_image_data, "mime_type": "image/png"}]

    with patch("server.gemini") as mock_gemini:
        mock_gemini.enhance_image = AsyncMock(return_value=FakeImageResult())

        response = client.post(
            "/api/enhance-images",
            json={"image_ids": [multi_image_metadata[0]]},
        )

    assert response.status_code == 200
    enhanced_image = response.json()["images"][0]
    assert enhanced_image["source_image_id"] == multi_image_metadata[0]
