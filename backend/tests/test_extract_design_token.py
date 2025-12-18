"""Tests for the extract-design-token endpoint (TDD)."""
import json
import pytest
from unittest.mock import AsyncMock, patch

from gemini_service import DesignTokenExtraction


class TestExtractDesignTokenEndpoint:
    """Test the POST /api/extract-design-token endpoint."""

    def test_extract_design_token_success(self, client, test_data_dir):
        """Test successful design token extraction from image with annotation."""
        # Update metadata with annotation and liked_axes
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        with open(metadata_path) as f:
            metadata = json.load(f)

        # Add annotation and liked_axes to the test image
        metadata["prompts"][0]["images"][0]["annotation"] = "Love the warm golden lighting"
        metadata["prompts"][0]["images"][0]["liked_axes"] = {
            "colors": ["warm", "golden-hour"],
            "mood": ["serene"],
        }
        metadata["library"] = []

        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        # Mock Gemini extraction - use actual model instance
        mock_extraction = DesignTokenExtraction(
            name="Golden Hour Warmth",
            text="warm golden hour lighting with soft ambient shadows",
            style_tags=["warm", "golden-hour", "soft-lighting", "ambient"],
            category="lighting",
        )

        with patch("server.gemini") as mock_gemini:
            mock_gemini.extract_design_token = AsyncMock(return_value=mock_extraction)

            response = client.post(
                "/api/extract-design-token",
                json={"image_id": "img-test123"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["item"] is not None
            assert data["item"]["type"] == "design-token"
            assert data["item"]["name"] == "Golden Hour Warmth"
            assert data["item"]["text"] == "warm golden hour lighting with soft ambient shadows"
            assert data["item"]["source_image_id"] == "img-test123"
            assert data["item"]["source_prompt_id"] == "prompt-test123"
            assert "extracted_from" in data["item"]
            assert data["item"]["extracted_from"]["annotation"] == "Love the warm golden lighting"

    def test_extract_design_token_with_explicit_values(self, client, test_data_dir):
        """Test extraction with explicitly provided annotation and liked_tags."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        with open(metadata_path) as f:
            metadata = json.load(f)
        metadata["library"] = []
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        mock_extraction = DesignTokenExtraction(
            name="Custom Token",
            text="custom prompt fragment",
            style_tags=["custom"],
            category="mixed",
        )

        with patch("server.gemini") as mock_gemini:
            mock_gemini.extract_design_token = AsyncMock(return_value=mock_extraction)

            response = client.post(
                "/api/extract-design-token",
                json={
                    "image_id": "img-test123",
                    "annotation": "Custom annotation override",
                    "liked_tags": ["custom-tag-1", "custom-tag-2"],
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["item"]["extracted_from"]["annotation"] == "Custom annotation override"
            assert data["item"]["extracted_from"]["liked_tags"] == ["custom-tag-1", "custom-tag-2"]

    def test_extract_design_token_image_not_found(self, client):
        """Test 404 when image doesn't exist."""
        response = client.post(
            "/api/extract-design-token",
            json={"image_id": "nonexistent-image"},
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_extract_design_token_liked_tags_only(self, client, test_data_dir):
        """Test extraction when image has liked_tags but no annotation."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        with open(metadata_path) as f:
            metadata = json.load(f)

        # Add liked_axes but no annotation
        metadata["prompts"][0]["images"][0]["liked_axes"] = {
            "colors": ["vibrant", "neon"],
        }
        # Explicitly no annotation
        if "annotation" in metadata["prompts"][0]["images"][0]:
            del metadata["prompts"][0]["images"][0]["annotation"]
        metadata["library"] = []

        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        mock_extraction = DesignTokenExtraction(
            name="Neon Vibes",
            text="vibrant neon colors",
            style_tags=["vibrant", "neon"],
            category="color",
        )

        with patch("server.gemini") as mock_gemini:
            mock_gemini.extract_design_token = AsyncMock(return_value=mock_extraction)

            response = client.post(
                "/api/extract-design-token",
                json={"image_id": "img-test123"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            # Liked tags should be flattened from liked_axes
            assert "vibrant" in data["item"]["extracted_from"]["liked_tags"]
            assert "neon" in data["item"]["extracted_from"]["liked_tags"]

    def test_extract_design_token_gemini_error(self, client, test_data_dir):
        """Test handling of Gemini extraction failure."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        with open(metadata_path) as f:
            metadata = json.load(f)
        metadata["library"] = []
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        with patch("server.gemini") as mock_gemini:
            mock_gemini.extract_design_token = AsyncMock(
                side_effect=Exception("Gemini API error")
            )

            response = client.post(
                "/api/extract-design-token",
                json={"image_id": "img-test123"},
            )

            assert response.status_code == 200  # Endpoint returns 200 with error in body
            data = response.json()
            assert data["success"] is False
            assert "error" in data
            assert "Gemini API error" in data["error"]


class TestDesignTokenExtractionModel:
    """Test the Gemini extraction Pydantic model."""

    def test_design_token_extraction_valid(self):
        """Test valid DesignTokenExtraction model creation."""
        from gemini_service import DesignTokenExtraction

        extraction = DesignTokenExtraction(
            name="Warm Glow",
            text="soft warm lighting with golden tones",
            style_tags=["warm", "golden", "soft-light"],
            category="lighting",
        )

        assert extraction.name == "Warm Glow"
        assert extraction.text == "soft warm lighting with golden tones"
        assert len(extraction.style_tags) == 3
        assert extraction.category == "lighting"

    def test_design_token_extraction_default_category(self):
        """Test DesignTokenExtraction with default category."""
        from gemini_service import DesignTokenExtraction

        extraction = DesignTokenExtraction(
            name="Cool Tones",
            text="cool blue tones with high contrast",
            style_tags=["cool", "blue", "high-contrast"],
        )

        assert extraction.category == "extracted"  # Default value
