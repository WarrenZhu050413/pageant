"""Tests for prompt variation system.

Uses Gemini structured JSON output for prompt variations.
"""

import pytest


class TestSettingsEndpoints:
    """Tests for settings API."""

    def test_get_settings(self, client):
        """GET /api/settings returns model info and generation defaults."""
        response = client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "text_model" in data
        assert "image_model" in data

    def test_update_settings(self, client):
        """PUT /api/settings updates image generation defaults."""
        response = client.put(
            "/api/settings",
            json={"image_size": "2K", "aspect_ratio": "16:9"},
        )
        assert response.status_code == 200

        # Verify it persisted
        get_response = client.get("/api/settings")
        data = get_response.json()
        assert data["image_size"] == "2K"
        assert data["aspect_ratio"] == "16:9"

    def test_settings_persist(self, client, reload_metadata):
        """Settings persist in metadata.json."""
        client.put("/api/settings", json={"seed": 12345})

        reload_metadata()

        response = client.get("/api/settings")
        assert response.json()["seed"] == 12345


class TestAxisPreferences:
    """Tests for design axis preference system."""

    def test_toggle_axis_like_standard_axis(self, client, sample_prompt_with_image):
        """Can like/unlike standard axes like 'colors'."""
        prompt_id, image_id = sample_prompt_with_image

        # Like a tag on the colors axis
        response = client.patch(
            f"/api/images/{image_id}/like-axis",
            json={"axis": "colors", "tag": "warm", "liked": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert "warm" in data["liked_axes"]["colors"]

    def test_toggle_axis_like_novel_axis(self, client, sample_prompt_with_image):
        """Can like tags on novel axes that Gemini generates dynamically."""
        prompt_id, image_id = sample_prompt_with_image

        # Like a tag on a novel axis (not in any hardcoded list)
        response = client.patch(
            f"/api/images/{image_id}/like-axis",
            json={"axis": "my_custom_axis", "tag": "custom_tag", "liked": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert "custom_tag" in data["liked_axes"]["my_custom_axis"]

    def test_toggle_axis_like_aesthetic(self, client, sample_prompt_with_image):
        """Can like 'aesthetic' axis (was previously rejected as invalid)."""
        prompt_id, image_id = sample_prompt_with_image

        response = client.patch(
            f"/api/images/{image_id}/like-axis",
            json={"axis": "aesthetic", "tag": "minimalist", "liked": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert "minimalist" in data["liked_axes"]["aesthetic"]

    def test_toggle_axis_like_typeface_feel(self, client, sample_prompt_with_image):
        """Can like 'typeface_feel' axis (correct naming from gemini_service)."""
        prompt_id, image_id = sample_prompt_with_image

        response = client.patch(
            f"/api/images/{image_id}/like-axis",
            json={"axis": "typeface_feel", "tag": "sans-serif", "liked": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert "sans-serif" in data["liked_axes"]["typeface_feel"]

    def test_preferences_aggregates_dynamic_axes(self, client, sample_prompt_with_image):
        """GET /api/preferences includes dynamically created axes."""
        prompt_id, image_id = sample_prompt_with_image

        # Like tags on various axes including novel ones
        client.patch(f"/api/images/{image_id}/like-axis",
                    json={"axis": "colors", "tag": "warm", "liked": True})
        client.patch(f"/api/images/{image_id}/like-axis",
                    json={"axis": "novel_axis", "tag": "novel_tag", "liked": True})

        # Get aggregated preferences
        response = client.get("/api/preferences")
        assert response.status_code == 200
        data = response.json()

        # Both standard and novel axes should be in preferences
        assert "colors" in data["preferences"]
        assert "novel_axis" in data["preferences"]
        assert data["preferences"]["colors"]["warm"] == 1
        assert data["preferences"]["novel_axis"]["novel_tag"] == 1


class TestVariationGeneration:
    """Tests for the 2-step variation generation flow."""

    def test_generate_creates_varied_prompts(self, client):
        """Generation endpoint uses text model for prompt variations."""
        # This test will need mocking once implemented
        # For now, just verify the endpoint still works
        # Full integration test would require live API calls
        pass  # TODO: Implement E2E test with actual generation
