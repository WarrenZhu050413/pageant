"""Tests for varied_prompt field in image generation.

This tests the fix for the bug where prompts weren't updating when
switching between images in the InfoOverlay. The root cause was that
the backend was saving prompts as 'prompt_used' but the frontend
expected 'varied_prompt'.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import base64


@pytest.fixture
def mock_gemini_response():
    """Mock a successful Gemini image generation response."""
    # Create a minimal valid PNG (1x1 transparent pixel)
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    return {
        "images": [
            {
                "data": base64.b64encode(png_bytes).decode(),
                "mime_type": "image/png",
            }
        ]
    }


class TestVariedPromptField:
    """Tests ensuring varied_prompt is correctly saved on images."""

    def test_generate_images_endpoint_saves_varied_prompt(
        self, client, test_data_dir, mock_gemini_response
    ):
        """POST /api/generate-images should save varied_prompt on each image."""
        import server as server_module

        with patch.object(
            server_module.gemini, "generate_image", new_callable=AsyncMock
        ) as mock_gen:
            mock_result = MagicMock()
            mock_result.images = mock_gemini_response["images"]
            mock_gen.return_value = mock_result

            response = client.post(
                "/api/generate-images",
                json={
                    "title": "Test Varied Prompts",
                    "prompts": [
                        {"text": "First variation prompt", "mood": "dramatic"},
                        {"text": "Second variation prompt", "mood": "serene"},
                    ],
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["images"]) == 2

            # Verify varied_prompt is set on each image
            assert data["images"][0]["varied_prompt"] == "First variation prompt"
            assert data["images"][1]["varied_prompt"] == "Second variation prompt"

    def test_varied_prompt_persisted_in_metadata(
        self, client, test_data_dir, mock_gemini_response
    ):
        """varied_prompt should be persisted in metadata.json."""
        import server as server_module

        with patch.object(
            server_module.gemini, "generate_image", new_callable=AsyncMock
        ) as mock_gen:
            mock_result = MagicMock()
            mock_result.images = mock_gemini_response["images"]
            mock_gen.return_value = mock_result

            # Generate images
            client.post(
                "/api/generate-images",
                json={
                    "title": "Persistence Test",
                    "prompts": [
                        {"text": "Persistent prompt variation", "mood": "test"},
                    ],
                },
            )

            # Fetch prompts and verify persistence
            response = client.get("/api/prompts")
            assert response.status_code == 200
            prompts = response.json()["prompts"]

            # Find our test prompt
            test_prompt = next(
                (p for p in prompts if p["title"] == "Persistence Test"), None
            )
            assert test_prompt is not None, "Test prompt not found"
            assert len(test_prompt["images"]) == 1
            assert (
                test_prompt["images"][0]["varied_prompt"]
                == "Persistent prompt variation"
            )

    def test_each_image_has_unique_varied_prompt(
        self, client, test_data_dir, mock_gemini_response
    ):
        """Each image in a batch should have its own unique varied_prompt."""
        import server as server_module

        with patch.object(
            server_module.gemini, "generate_image", new_callable=AsyncMock
        ) as mock_gen:
            mock_result = MagicMock()
            mock_result.images = mock_gemini_response["images"]
            mock_gen.return_value = mock_result

            prompts = [
                {"text": "Variation A: dramatic lighting", "mood": "dark"},
                {"text": "Variation B: soft pastel colors", "mood": "light"},
                {"text": "Variation C: abstract composition", "mood": "artistic"},
            ]

            response = client.post(
                "/api/generate-images",
                json={"title": "Multi-Variation Test", "prompts": prompts},
            )

            assert response.status_code == 200
            data = response.json()
            images = data["images"]

            # Verify each image has the correct varied_prompt
            for i, img in enumerate(images):
                assert img["varied_prompt"] == prompts[i]["text"]

            # Verify all prompts are unique
            varied_prompts = [img["varied_prompt"] for img in images]
            assert len(varied_prompts) == len(set(varied_prompts)), (
                "All varied_prompts should be unique"
            )


class TestLegacyPromptUsedMigration:
    """Tests related to handling legacy prompt_used field."""

    def test_images_without_varied_prompt_fallback_to_base(
        self, client, test_data_dir
    ):
        """Images without varied_prompt should still be accessible."""
        # The existing test image in conftest doesn't have varied_prompt
        # This simulates legacy data

        response = client.get("/api/prompts")
        assert response.status_code == 200
        prompts = response.json()["prompts"]

        # Find the test image (from conftest)
        test_prompt = next(
            (p for p in prompts if p["id"] == "prompt-test123"), None
        )
        assert test_prompt is not None
        test_image = test_prompt["images"][0]

        # Legacy image won't have varied_prompt - that's expected
        # The frontend handles this by falling back to the parent prompt
        assert test_image["id"] == "img-test123"
