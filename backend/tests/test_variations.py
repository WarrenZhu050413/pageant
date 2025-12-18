"""Tests for prompt variation system.

Uses Gemini structured JSON output for prompt variations.
"""

import pytest


class TestSettingsEndpoints:
    """Tests for settings API."""

    def test_get_settings(self, client):
        """GET /api/settings returns variation prompt and models."""
        response = client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "variation_prompt" in data
        assert "text_model" in data
        assert "image_model" in data
        # Default prompt should contain placeholders for structured output
        assert "{count}" in data["variation_prompt"]
        assert "{base_prompt}" in data["variation_prompt"]

    def test_update_settings(self, client):
        """PUT /api/settings updates variation prompt."""
        custom_prompt = "My custom variation prompt with {base_prompt} and {count}"
        response = client.put(
            "/api/settings",
            json={"variation_prompt": custom_prompt},
        )
        assert response.status_code == 200

        # Verify it persisted
        get_response = client.get("/api/settings")
        assert get_response.json()["variation_prompt"] == custom_prompt

    def test_settings_persist(self, client, reload_metadata):
        """Settings persist in metadata.json."""
        custom_prompt = "Persistent test prompt"
        client.put("/api/settings", json={"variation_prompt": custom_prompt})

        reload_metadata()

        response = client.get("/api/settings")
        assert response.json()["variation_prompt"] == custom_prompt

    def test_get_default_settings(self, client):
        """GET /api/settings/defaults returns default prompts from files."""
        response = client.get("/api/settings/defaults")
        assert response.status_code == 200
        data = response.json()

        # Should have both prompts
        assert "variation_prompt" in data
        assert "iteration_prompt" in data

        # Default prompts should have required placeholders
        assert "{count}" in data["variation_prompt"]
        assert "{base_prompt}" in data["variation_prompt"]
        # New placeholders should be in the default prompt
        assert "{title_context}" in data["variation_prompt"]
        assert "{context_assignment_section}" in data["variation_prompt"]

    def test_default_settings_differ_from_saved(self, client):
        """Default prompts should be independent of saved settings."""
        # Save a custom prompt
        custom_prompt = "Custom prompt without placeholders"
        client.put("/api/settings", json={"variation_prompt": custom_prompt})

        # Get current settings (should have custom)
        current = client.get("/api/settings").json()
        assert current["variation_prompt"] == custom_prompt

        # Get defaults (should have original template)
        defaults = client.get("/api/settings/defaults").json()
        assert defaults["variation_prompt"] != custom_prompt
        assert "{count}" in defaults["variation_prompt"]


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
