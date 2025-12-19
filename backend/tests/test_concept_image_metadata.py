"""Tests for concept image metadata parity with regular images.

When generating concept images for tokens, they should be stored as full Prompt
entries with the same metadata structure as regular images.
"""

import json
import base64
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestCreateTokenWithConceptImage:
    """Test POST /api/tokens creates Prompt entry for concept images."""

    def test_create_token_with_concept_creates_prompt_entry(self, client, test_data_dir):
        """When generate_concept=True, should create a Prompt with is_concept=True."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        # Setup metadata with tokens array
        with open(metadata_path) as f:
            metadata = json.load(f)
        metadata["tokens"] = []
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        # Mock Gemini concept image generation
        mock_result = MagicMock()
        mock_result.images = [{"data": base64.b64encode(b"fake-image-data").decode()}]

        with patch("server.gemini") as mock_gemini:
            mock_gemini.generate_concept_image = AsyncMock(return_value=mock_result)

            response = client.post(
                "/api/tokens",
                json={
                    "name": "Warm Lighting",
                    "description": "Golden hour warmth",
                    "image_ids": ["img-test123"],
                    "prompts": [],
                    "creation_method": "ai-extraction",
                    "generate_concept": True,
                    "dimension": {
                        "axis": "lighting",
                        "name": "Warm Lighting",
                        "description": "Soft golden illumination",
                        "tags": ["warm", "golden", "soft"],
                        "generation_prompt": "Abstract warm golden lighting with soft gradients",
                        "source": "auto",
                        "confirmed": True,
                    },
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            token = data["token"]

            # Token should have concept references
            assert "concept_image_id" in token
            assert "concept_image_path" in token
            assert "concept_prompt_id" in token

            # Reload metadata to check Prompt was created
            with open(metadata_path) as f:
                updated_metadata = json.load(f)

            # Find the concept prompt
            concept_prompts = [
                p for p in updated_metadata["prompts"] if p.get("is_concept") is True
            ]
            assert len(concept_prompts) == 1

            concept_prompt = concept_prompts[0]
            assert concept_prompt["id"] == token["concept_prompt_id"]
            assert concept_prompt["is_concept"] is True
            assert concept_prompt["concept_axis"] == "lighting"
            assert concept_prompt["source_image_id"] == "img-test123"
            assert "Concept: Warm Lighting" in concept_prompt["title"]

            # Check the image has full metadata
            assert len(concept_prompt["images"]) == 1
            concept_image = concept_prompt["images"][0]
            assert concept_image["id"] == token["concept_image_id"]
            assert "design_dimensions" in concept_image
            assert "lighting" in concept_image["design_dimensions"]
            assert concept_image["varied_prompt"] == "Abstract warm golden lighting with soft gradients"
            assert concept_image["variation_title"] == "Warm Lighting"

    def test_create_token_without_concept_no_prompt_entry(self, client, test_data_dir):
        """When generate_concept=False, should NOT create a concept Prompt."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        with open(metadata_path) as f:
            metadata = json.load(f)
        metadata["tokens"] = []
        initial_prompt_count = len(metadata["prompts"])
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        response = client.post(
            "/api/tokens",
            json={
                "name": "Manual Token",
                "description": "Manually created",
                "image_ids": ["img-test123"],
                "prompts": ["some prompt fragment"],
                "creation_method": "manual",
                "generate_concept": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Token should NOT have concept references
        token = data["token"]
        assert token.get("concept_image_id") is None
        assert token.get("concept_prompt_id") is None

        # No new prompts should be added
        with open(metadata_path) as f:
            updated_metadata = json.load(f)
        assert len(updated_metadata["prompts"]) == initial_prompt_count


class TestGenerateTokenConcept:
    """Test POST /api/tokens/{id}/generate-concept creates Prompt entry."""

    def test_generate_concept_creates_prompt_entry(self, client, test_data_dir):
        """Generating concept for existing token should create Prompt entry."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        # Create a token without concept first
        with open(metadata_path) as f:
            metadata = json.load(f)

        token_id = "tok-test123"
        metadata["tokens"] = [
            {
                "id": token_id,
                "name": "Existing Token",
                "description": "Token needing concept",
                "created_at": "2025-01-01T00:00:00",
                "use_count": 0,
                "images": [{"id": "img-test123", "image_path": "test-image.png"}],
                "prompts": [],
                "creation_method": "ai-extraction",
                "extraction": {
                    "dimension": {
                        "axis": "mood",
                        "name": "Serene Calm",
                        "description": "Peaceful tranquility",
                        "tags": ["serene", "calm", "peaceful"],
                        "generation_prompt": "Abstract serene calm with soft flowing forms",
                        "source": "auto",
                        "confirmed": True,
                    },
                    "generation_prompt": "Abstract serene calm with soft flowing forms",
                },
            }
        ]
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        # Mock Gemini
        mock_result = MagicMock()
        mock_result.images = [{"data": base64.b64encode(b"fake-concept").decode()}]

        with patch("server.gemini") as mock_gemini:
            mock_gemini.generate_concept_image = AsyncMock(return_value=mock_result)

            response = client.post(f"/api/tokens/{token_id}/generate-concept")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "concept_image_path" in data
            assert "concept_image_id" in data

            # Check Prompt was created
            with open(metadata_path) as f:
                updated_metadata = json.load(f)

            concept_prompts = [
                p for p in updated_metadata["prompts"] if p.get("is_concept") is True
            ]
            assert len(concept_prompts) == 1

            concept_prompt = concept_prompts[0]
            assert concept_prompt["is_concept"] is True
            assert concept_prompt["concept_axis"] == "mood"
            assert "Serene Calm" in concept_prompt["title"]

            # Check image metadata
            concept_image = concept_prompt["images"][0]
            assert "design_dimensions" in concept_image
            assert "mood" in concept_image["design_dimensions"]

    def test_regenerate_concept_replaces_prompt_entry(self, client, test_data_dir):
        """Regenerating concept should replace the old Prompt entry."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        token_id = "tok-regen123"

        with open(metadata_path) as f:
            metadata = json.load(f)

        # Create token with existing concept
        metadata["tokens"] = [
            {
                "id": token_id,
                "name": "Token With Concept",
                "created_at": "2025-01-01T00:00:00",
                "use_count": 0,
                "images": [{"id": "img-test123", "image_path": "test-image.png"}],
                "prompts": [],
                "creation_method": "ai-extraction",
                "concept_image_id": f"concept-{token_id}",
                "concept_image_path": "old-concept.jpg",
                "concept_prompt_id": f"concept-prompt-{token_id}",
                "extraction": {
                    "dimension": {
                        "axis": "colors",
                        "name": "Vibrant Hues",
                        "description": "Bold saturated colors",
                        "tags": ["vibrant", "bold", "saturated"],
                        "generation_prompt": "Abstract vibrant bold colors",
                        "source": "auto",
                        "confirmed": True,
                    },
                    "generation_prompt": "Abstract vibrant bold colors",
                },
            }
        ]
        # Add old concept prompt
        metadata["prompts"].append({
            "id": f"concept-prompt-{token_id}",
            "prompt": "Old concept prompt",
            "title": "Concept: Old",
            "created_at": "2025-01-01T00:00:00",
            "images": [{"id": f"concept-{token_id}", "image_path": "old-concept.jpg"}],
            "is_concept": True,
            "concept_axis": "colors",
        })

        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        # Mock Gemini
        mock_result = MagicMock()
        mock_result.images = [{"data": base64.b64encode(b"new-concept").decode()}]

        with patch("server.gemini") as mock_gemini:
            mock_gemini.generate_concept_image = AsyncMock(return_value=mock_result)

            response = client.post(f"/api/tokens/{token_id}/generate-concept")

            assert response.status_code == 200

            # Check only ONE concept prompt exists (old one replaced)
            with open(metadata_path) as f:
                updated_metadata = json.load(f)

            concept_prompts = [
                p for p in updated_metadata["prompts"]
                if p.get("id") == f"concept-prompt-{token_id}"
            ]
            assert len(concept_prompts) == 1

            # Should have new image path
            concept_prompt = concept_prompts[0]
            assert concept_prompt["images"][0]["image_path"] != "old-concept.jpg"


class TestConceptPromptMetadataStructure:
    """Test that concept Prompt entries have correct structure."""

    def test_concept_prompt_has_required_fields(self, client, test_data_dir):
        """Concept Prompt should have all required ImageData fields."""
        images_dir = test_data_dir / "generated_images"
        metadata_path = images_dir / "metadata.json"

        with open(metadata_path) as f:
            metadata = json.load(f)
        metadata["tokens"] = []
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        mock_result = MagicMock()
        mock_result.images = [{"data": base64.b64encode(b"test").decode()}]

        with patch("server.gemini") as mock_gemini:
            mock_gemini.generate_concept_image = AsyncMock(return_value=mock_result)

            client.post(
                "/api/tokens",
                json={
                    "name": "Test Token",
                    "image_ids": ["img-test123"],
                    "prompts": [],
                    "creation_method": "ai-extraction",
                    "generate_concept": True,
                    "dimension": {
                        "axis": "aesthetic",
                        "name": "Dreamy Ethereal",
                        "description": "Soft dreamlike quality",
                        "tags": ["dreamy", "ethereal", "soft"],
                        "generation_prompt": "Abstract dreamy ethereal atmosphere",
                        "source": "auto",
                        "confirmed": True,
                    },
                },
            )

            with open(metadata_path) as f:
                updated_metadata = json.load(f)

            concept_prompts = [
                p for p in updated_metadata["prompts"] if p.get("is_concept")
            ]
            assert len(concept_prompts) == 1

            prompt = concept_prompts[0]
            image = prompt["images"][0]

            # Check Prompt-level fields
            assert "id" in prompt
            assert "prompt" in prompt
            assert "title" in prompt
            assert "created_at" in prompt
            assert prompt["is_concept"] is True
            assert "concept_axis" in prompt
            assert "source_image_id" in prompt

            # Check ImageData fields
            assert "id" in image
            assert "image_path" in image
            assert "mime_type" in image
            assert "generated_at" in image
            assert "varied_prompt" in image
            assert "variation_title" in image
            assert "design_dimensions" in image

            # Check design_dimensions structure
            dim = image["design_dimensions"]["aesthetic"]
            assert dim["axis"] == "aesthetic"
            assert dim["name"] == "Dreamy Ethereal"
            assert "tags" in dim
            assert "generation_prompt" in dim
