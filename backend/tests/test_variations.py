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


class TestVariationGeneration:
    """Tests for the 2-step variation generation flow."""

    def test_generate_creates_varied_prompts(self, client):
        """Generation endpoint uses text model for prompt variations."""
        # This test will need mocking once implemented
        # For now, just verify the endpoint still works
        # Full integration test would require live API calls
        pass  # TODO: Implement E2E test with actual generation
