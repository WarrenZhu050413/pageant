"""Tests for story CRUD functionality.

TDD: Write these tests FIRST, then implement the endpoints.
"""

import pytest


class TestStoryCreate:
    """Tests for POST /api/stories."""

    def test_create_story(self, client):
        """POST /api/stories creates a new story."""
        response = client.post(
            "/api/stories",
            json={"title": "Summer Transformation"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["id"].startswith("story-")
        assert data["title"] == "Summer Transformation"
        assert data["chapters"] == []

    def test_create_story_with_description(self, client):
        """POST /api/stories can include description."""
        response = client.post(
            "/api/stories",
            json={
                "title": "My Journey",
                "description": "A story about change",
            },
        )
        assert response.status_code == 200
        assert response.json()["description"] == "A story about change"


class TestStoryList:
    """Tests for GET /api/stories."""

    def test_list_stories_empty(self, client):
        """GET /api/stories returns empty list initially."""
        response = client.get("/api/stories")
        assert response.status_code == 200
        assert response.json()["stories"] == []

    def test_list_stories(self, client):
        """GET /api/stories returns all stories."""
        client.post("/api/stories", json={"title": "Story 1"})
        client.post("/api/stories", json={"title": "Story 2"})

        response = client.get("/api/stories")
        assert response.status_code == 200
        stories = response.json()["stories"]
        assert len(stories) == 2
        titles = [s["title"] for s in stories]
        assert "Story 1" in titles
        assert "Story 2" in titles


class TestStoryGet:
    """Tests for GET /api/stories/{id}."""

    def test_get_story(self, client):
        """GET /api/stories/{id} returns the story."""
        create_resp = client.post("/api/stories", json={"title": "Test Story"})
        story_id = create_resp.json()["id"]

        response = client.get(f"/api/stories/{story_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "Test Story"

    def test_get_nonexistent_story(self, client):
        """GET /api/stories/{id} returns 404 for unknown story."""
        response = client.get("/api/stories/story-nonexistent")
        assert response.status_code == 404


class TestStoryUpdate:
    """Tests for PUT /api/stories/{id}."""

    def test_update_story(self, client):
        """PUT /api/stories/{id} updates story metadata."""
        create_resp = client.post("/api/stories", json={"title": "Original"})
        story_id = create_resp.json()["id"]

        response = client.put(
            f"/api/stories/{story_id}",
            json={"title": "Updated Title", "description": "New description"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"
        assert response.json()["description"] == "New description"


class TestStoryDelete:
    """Tests for DELETE /api/stories/{id}."""

    def test_delete_story(self, client):
        """DELETE /api/stories/{id} removes story."""
        create_resp = client.post("/api/stories", json={"title": "To Delete"})
        story_id = create_resp.json()["id"]

        response = client.delete(f"/api/stories/{story_id}")
        assert response.status_code == 200

        # Verify it's gone
        list_resp = client.get("/api/stories")
        assert len(list_resp.json()["stories"]) == 0


class TestChapterAdd:
    """Tests for POST /api/stories/{id}/chapters."""

    def test_add_chapter(self, client, sample_image_id):
        """POST /api/stories/{id}/chapters adds a chapter."""
        story = client.post("/api/stories", json={"title": "Test"}).json()

        response = client.post(
            f"/api/stories/{story['id']}/chapters",
            json={
                "text": "Chapter one text",
                "image_ids": [sample_image_id],
            },
        )
        assert response.status_code == 200
        chapters = response.json()["chapters"]
        assert len(chapters) == 1
        assert chapters[0]["text"] == "Chapter one text"
        assert sample_image_id in chapters[0]["image_ids"]

    def test_add_chapter_with_title(self, client):
        """POST /api/stories/{id}/chapters can include title."""
        story = client.post("/api/stories", json={"title": "Test"}).json()

        response = client.post(
            f"/api/stories/{story['id']}/chapters",
            json={
                "title": "The Beginning",
                "text": "It all started...",
            },
        )
        assert response.status_code == 200
        assert response.json()["chapters"][0]["title"] == "The Beginning"

    def test_add_multiple_chapters(self, client):
        """Multiple chapters are added in order."""
        story = client.post("/api/stories", json={"title": "Test"}).json()

        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 1"})
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 2"})
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 3"})

        response = client.get(f"/api/stories/{story['id']}")
        chapters = response.json()["chapters"]
        assert len(chapters) == 3
        assert chapters[0]["sequence"] == 1
        assert chapters[1]["sequence"] == 2
        assert chapters[2]["sequence"] == 3


class TestChapterUpdate:
    """Tests for PUT /api/stories/{id}/chapters/{ch_id}."""

    def test_update_chapter(self, client):
        """PUT /api/stories/{id}/chapters/{ch_id} updates chapter."""
        story = client.post("/api/stories", json={"title": "Test"}).json()
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Original"})

        story = client.get(f"/api/stories/{story['id']}").json()
        ch_id = story["chapters"][0]["id"]

        response = client.put(
            f"/api/stories/{story['id']}/chapters/{ch_id}",
            json={"text": "Updated text", "title": "New Title"},
        )
        assert response.status_code == 200
        updated_ch = next(
            ch for ch in response.json()["chapters"] if ch["id"] == ch_id
        )
        assert updated_ch["text"] == "Updated text"
        assert updated_ch["title"] == "New Title"


class TestChapterDelete:
    """Tests for DELETE /api/stories/{id}/chapters/{ch_id}."""

    def test_delete_chapter(self, client):
        """DELETE /api/stories/{id}/chapters/{ch_id} removes chapter."""
        story = client.post("/api/stories", json={"title": "Test"}).json()
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 1"})
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 2"})

        story = client.get(f"/api/stories/{story['id']}").json()
        ch_id = story["chapters"][0]["id"]

        response = client.delete(f"/api/stories/{story['id']}/chapters/{ch_id}")
        assert response.status_code == 200
        assert len(response.json()["chapters"]) == 1


class TestChapterReorder:
    """Tests for POST /api/stories/{id}/chapters/reorder."""

    def test_reorder_chapters(self, client):
        """POST /api/stories/{id}/chapters/reorder changes order."""
        story = client.post("/api/stories", json={"title": "Test"}).json()
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 1"})
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 2"})
        client.post(f"/api/stories/{story['id']}/chapters", json={"text": "Ch 3"})

        # Get chapter IDs
        story = client.get(f"/api/stories/{story['id']}").json()
        ch_ids = [ch["id"] for ch in story["chapters"]]

        # Reverse order
        response = client.post(
            f"/api/stories/{story['id']}/chapters/reorder",
            json={"chapter_ids": ch_ids[::-1]},
        )
        assert response.status_code == 200

        # Verify new order
        chapters = response.json()["chapters"]
        assert chapters[0]["text"] == "Ch 3"
        assert chapters[1]["text"] == "Ch 2"
        assert chapters[2]["text"] == "Ch 1"

        # Verify sequences updated
        assert chapters[0]["sequence"] == 1
        assert chapters[1]["sequence"] == 2
        assert chapters[2]["sequence"] == 3


class TestStoryPersistence:
    """Tests for story persistence."""

    def test_stories_persist(self, client, reload_metadata):
        """Stories persist in metadata.json."""
        client.post("/api/stories", json={"title": "Persistent Story"})

        reload_metadata()

        response = client.get("/api/stories")
        assert len(response.json()["stories"]) == 1
        assert response.json()["stories"][0]["title"] == "Persistent Story"
