import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json

# Mock data
MOCK_IMAGE_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

@pytest.fixture
def mock_aiohttp(monkeypatch):
    """Mock aiohttp ClientSession to avoid real network calls."""
    mock_session = MagicMock()
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.read.return_value = MOCK_IMAGE_BYTES
    mock_response.headers = {"Content-Type": "image/png"}

    # Context manager setup for session.get()
    mock_get_ctx = MagicMock()
    mock_get_ctx.__aenter__.return_value = mock_response
    mock_get_ctx.__aexit__.return_value = None
    mock_session.get.return_value = mock_get_ctx

    # Context manager setup for ClientSession()
    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__.return_value = mock_session
    mock_session_ctx.__aexit__.return_value = None

    # Patch the aiohttp.ClientSession class
    with patch("aiohttp.ClientSession", return_value=mock_session_ctx) as mock:
        yield mock


def test_import_url_endpoint(client, mock_aiohttp, test_data_dir):
    """Test POST /api/import-url"""
    payload = {
        "url": "http://example.com/image.png",
        "tags": ["saved_tag_1", "saved_tag_2"],
        "pageUrl": "http://example.com"
    }

    response = client.post("/api/import-url", json=payload)
    
    # Verify response
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "id" in data
    
    # Verify file was created
    saved_id = data["id"]
    images_dir = test_data_dir / "generated_images"
    # Note: server logic adds extension based on mime type. mock is image/png -> .png
    expected_file = images_dir / f"{saved_id}.png"
    assert expected_file.exists()
    assert expected_file.read_bytes() == MOCK_IMAGE_BYTES
    
    # Verify metadata was updated
    metadata_path = images_dir / "metadata.json"
    with open(metadata_path) as f:
        metadata = json.load(f)
    
    # Find the new prompt entry
    saved_entry = None
    for prompt in metadata["prompts"]:
        for img in prompt["images"]:
            if img["id"] == saved_id:
                saved_entry = img
                break
        if saved_entry:
            break
            
    assert saved_entry is not None
    assert saved_entry["tags"] == payload["tags"]
    assert saved_entry["source_url"] == payload["url"]
    assert saved_entry["page_url"] == payload["pageUrl"]


def test_import_url_minimal_payload(client, mock_aiohttp, test_data_dir):
    """Test POST /api/import-url with only URL (no tags or pageUrl)."""
    payload = {"url": "http://example.com/image.png"}

    response = client.post("/api/import-url", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "id" in data

    # Verify metadata has empty tags and None pageUrl
    images_dir = test_data_dir / "generated_images"
    metadata_path = images_dir / "metadata.json"
    with open(metadata_path) as f:
        metadata = json.load(f)

    saved_entry = None
    for prompt in metadata["prompts"]:
        for img in prompt["images"]:
            if img["id"] == data["id"]:
                saved_entry = img
                break

    assert saved_entry is not None
    assert saved_entry["tags"] == []
    assert saved_entry["page_url"] is None


def test_import_url_fetch_failure(client, test_data_dir):
    """Test POST /api/import-url when fetch fails (non-200 response)."""
    # Mock a failed fetch
    mock_session = MagicMock()
    mock_response = AsyncMock()
    mock_response.status = 404

    mock_get_ctx = MagicMock()
    mock_get_ctx.__aenter__.return_value = mock_response
    mock_get_ctx.__aexit__.return_value = None
    mock_session.get.return_value = mock_get_ctx

    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__.return_value = mock_session
    mock_session_ctx.__aexit__.return_value = None

    with patch("aiohttp.ClientSession", return_value=mock_session_ctx):
        response = client.post("/api/import-url", json={"url": "http://example.com/notfound.png"})

    assert response.status_code == 400
    assert "Failed to fetch" in response.json()["detail"]


def test_import_url_jpeg_content_type(client, test_data_dir):
    """Test POST /api/import-url saves JPEG with correct extension."""
    mock_jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"  # JPEG magic bytes

    mock_session = MagicMock()
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.read.return_value = mock_jpeg_bytes
    mock_response.headers = {"Content-Type": "image/jpeg"}

    mock_get_ctx = MagicMock()
    mock_get_ctx.__aenter__.return_value = mock_response
    mock_get_ctx.__aexit__.return_value = None
    mock_session.get.return_value = mock_get_ctx

    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__.return_value = mock_session
    mock_session_ctx.__aexit__.return_value = None

    with patch("aiohttp.ClientSession", return_value=mock_session_ctx):
        response = client.post("/api/import-url", json={"url": "http://example.com/photo.jpg"})

    assert response.status_code == 200
    data = response.json()

    # Verify file has .jpg extension
    images_dir = test_data_dir / "generated_images"
    expected_file = images_dir / f"{data['id']}.jpg"
    assert expected_file.exists()


def test_import_url_missing_url(client):
    """Test POST /api/import-url with missing URL returns validation error."""
    response = client.post("/api/import-url", json={})

    assert response.status_code == 422  # Pydantic validation error

