"""Tests that verify google-genai types are used correctly."""

import pytest
from google.genai import types


class TestGenAITypes:
    """Verify we're using the correct google-genai type classes."""

    def test_image_config_exists(self):
        """ImageConfig should exist (not ImageGenerationConfig)."""
        assert hasattr(types, "ImageConfig"), "types.ImageConfig should exist"

    def test_image_config_accepts_image_size(self):
        """ImageConfig should accept image_size parameter."""
        config = types.ImageConfig(image_size="1K")
        assert config.image_size == "1K"

    def test_image_config_accepts_aspect_ratio(self):
        """ImageConfig should accept aspect_ratio parameter."""
        config = types.ImageConfig(aspect_ratio="16:9")
        assert config.aspect_ratio == "16:9"

    def test_generate_content_config_accepts_image_config(self):
        """GenerateContentConfig should accept image_config with ImageConfig."""
        image_config = types.ImageConfig(image_size="2K", aspect_ratio="1:1")
        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=image_config,
        )
        assert config.image_config is not None
        assert config.image_config.image_size == "2K"
        assert config.image_config.aspect_ratio == "1:1"

    def test_image_generation_config_does_not_exist(self):
        """ImageGenerationConfig should NOT exist (deprecated)."""
        assert not hasattr(types, "ImageGenerationConfig"), (
            "types.ImageGenerationConfig is deprecated, use types.ImageConfig"
        )
