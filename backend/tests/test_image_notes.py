"""Tests for image notes/annotation functionality.

TDD: Write these tests FIRST, then implement the endpoint.
"""

import pytest


def test_update_image_notes(client, sample_image_id):
    """PATCH /api/images/{id}/notes updates notes and annotation."""
    response = client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"notes": "First buzz cut attempt", "annotation": "Before the change"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notes"] == "First buzz cut attempt"
    assert data["annotation"] == "Before the change"


def test_update_notes_only(client, sample_image_id):
    """PATCH /api/images/{id}/notes can update just notes."""
    response = client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"notes": "Just a note"},
    )
    assert response.status_code == 200
    assert response.json()["notes"] == "Just a note"


def test_update_annotation_only(client, sample_image_id):
    """PATCH /api/images/{id}/notes can update just annotation."""
    response = client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"annotation": "Short annotation"},
    )
    assert response.status_code == 200
    assert response.json()["annotation"] == "Short annotation"


def test_notes_returned_in_prompts_list(client, sample_image_id):
    """GET /api/prompts returns images with notes field."""
    # First set notes
    client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"notes": "Test note for visibility"},
    )

    # Then verify in list
    response = client.get("/api/prompts")
    assert response.status_code == 200
    prompts = response.json()["prompts"]

    # Find our test image
    found = False
    for prompt in prompts:
        for img in prompt.get("images", []):
            if img.get("id") == sample_image_id:
                assert img.get("notes") == "Test note for visibility"
                found = True
                break
    assert found, f"Image {sample_image_id} not found in prompts"


def test_notes_persist_after_reload(client, sample_image_id, reload_metadata):
    """Notes persist in metadata.json after reload."""
    # Set notes
    client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"notes": "Persistent note", "annotation": "Persistent annotation"},
    )

    # Simulate reload by calling reload_metadata
    reload_metadata()

    # Verify notes still exist
    response = client.get("/api/prompts")
    prompts = response.json()["prompts"]

    for prompt in prompts:
        for img in prompt.get("images", []):
            if img.get("id") == sample_image_id:
                assert img.get("notes") == "Persistent note"
                assert img.get("annotation") == "Persistent annotation"
                return

    pytest.fail(f"Image {sample_image_id} not found after reload")


def test_update_nonexistent_image_returns_404(client):
    """PATCH /api/images/{id}/notes returns 404 for unknown image."""
    response = client.patch(
        "/api/images/img-nonexistent/notes",
        json={"notes": "This should fail"},
    )
    assert response.status_code == 404


def test_empty_notes_and_annotation(client, sample_image_id):
    """PATCH /api/images/{id}/notes allows empty strings."""
    # First set some content
    client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"notes": "Some note", "annotation": "Some annotation"},
    )

    # Then clear it
    response = client.patch(
        f"/api/images/{sample_image_id}/notes",
        json={"notes": "", "annotation": ""},
    )
    assert response.status_code == 200
    assert response.json()["notes"] == ""
    assert response.json()["annotation"] == ""
