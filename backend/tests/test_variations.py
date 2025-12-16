"""Tests for prompt variation system.

TDD: Write these tests FIRST, then implement the functionality.
"""

import pytest


class TestParseSceneVariations:
    """Tests for XML scene parsing."""

    def test_parse_single_scene(self):
        """Parse a single scene from XML."""
        from server import parse_scene_variations

        xml = '''
        <scenes>
          <scene id="1" type="faithful">
            <description>A bold portrait with dramatic lighting</description>
            <mood>dramatic</mood>
          </scene>
        </scenes>
        '''
        scenes = parse_scene_variations(xml)
        assert len(scenes) == 1
        assert scenes[0]["id"] == "1"
        assert scenes[0]["type"] == "faithful"
        assert scenes[0]["description"] == "A bold portrait with dramatic lighting"
        assert scenes[0]["mood"] == "dramatic"

    def test_parse_multiple_scenes(self):
        """Parse multiple scenes from XML."""
        from server import parse_scene_variations

        xml = '''
        <scenes>
          <scene id="1" type="faithful">
            <description>Scene one description</description>
            <mood>warm</mood>
          </scene>
          <scene id="2" type="exploration">
            <description>Scene two description</description>
            <mood>cool</mood>
          </scene>
          <scene id="3" type="exploration">
            <description>Scene three description</description>
            <mood>dramatic</mood>
          </scene>
        </scenes>
        '''
        scenes = parse_scene_variations(xml)
        assert len(scenes) == 3
        assert scenes[0]["id"] == "1"
        assert scenes[1]["id"] == "2"
        assert scenes[2]["id"] == "3"
        assert scenes[0]["type"] == "faithful"
        assert scenes[1]["type"] == "exploration"

    def test_parse_handles_whitespace(self):
        """Parse scenes with various whitespace."""
        from server import parse_scene_variations

        xml = '''<scenes>
<scene id="1" type="faithful">
<description>
  A description with
  multiple lines and   extra spaces
</description>
<mood>warm</mood>
</scene>
</scenes>'''
        scenes = parse_scene_variations(xml)
        assert len(scenes) == 1
        # Description should be stripped but internal whitespace preserved
        assert "multiple lines" in scenes[0]["description"]

    def test_parse_empty_response(self):
        """Handle empty or invalid XML gracefully."""
        from server import parse_scene_variations

        assert parse_scene_variations("") == []
        assert parse_scene_variations("no xml here") == []
        assert parse_scene_variations("<scenes></scenes>") == []


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
        # Default prompt should contain key elements
        assert "<scene" in data["variation_prompt"] or "{count}" in data["variation_prompt"]

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
