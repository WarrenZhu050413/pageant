"""Tests for image generation parameter validation.

Tests that:
1. Valid parameters are accepted
2. Invalid image_size values are rejected
3. Invalid aspect_ratio values are rejected
4. Invalid safety_level values are rejected
5. Negative seed values are rejected
"""

import pytest
from pydantic import ValidationError


class TestGenerateRequestValidation:
    """Tests for GenerateRequest parameter validation."""

    def test_valid_image_size_values(self):
        """All valid image_size values should be accepted."""
        from server import GenerateRequest

        for size in ["1K", "2K", "4K"]:
            req = GenerateRequest(prompt="test", image_size=size)
            assert req.image_size == size

    def test_invalid_image_size_rejected(self):
        """Invalid image_size values should raise ValidationError."""
        from server import GenerateRequest

        with pytest.raises(ValidationError) as exc_info:
            GenerateRequest(prompt="test", image_size="3K")
        assert "image_size" in str(exc_info.value)

    def test_valid_aspect_ratio_values(self):
        """All valid aspect_ratio values should be accepted."""
        from server import GenerateRequest

        valid_ratios = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]
        for ratio in valid_ratios:
            req = GenerateRequest(prompt="test", aspect_ratio=ratio)
            assert req.aspect_ratio == ratio

    def test_invalid_aspect_ratio_rejected(self):
        """Invalid aspect_ratio values should raise ValidationError."""
        from server import GenerateRequest

        with pytest.raises(ValidationError) as exc_info:
            GenerateRequest(prompt="test", aspect_ratio="5:4")
        assert "aspect_ratio" in str(exc_info.value)

    def test_valid_safety_level_values(self):
        """All valid safety_level values should be accepted."""
        from server import GenerateRequest

        valid_levels = [
            "BLOCK_NONE",
            "BLOCK_ONLY_HIGH",
            "BLOCK_MEDIUM_AND_ABOVE",
            "BLOCK_LOW_AND_ABOVE",
        ]
        for level in valid_levels:
            req = GenerateRequest(prompt="test", safety_level=level)
            assert req.safety_level == level

    def test_invalid_safety_level_rejected(self):
        """Invalid safety_level values should raise ValidationError."""
        from server import GenerateRequest

        with pytest.raises(ValidationError) as exc_info:
            GenerateRequest(prompt="test", safety_level="BLOCK_EVERYTHING")
        assert "safety_level" in str(exc_info.value)

    def test_valid_seed_values(self):
        """Non-negative seed values should be accepted."""
        from server import GenerateRequest

        req = GenerateRequest(prompt="test", seed=0)
        assert req.seed == 0

        req = GenerateRequest(prompt="test", seed=12345)
        assert req.seed == 12345

        req = GenerateRequest(prompt="test", seed=None)
        assert req.seed is None

    def test_negative_seed_rejected(self):
        """Negative seed values should raise ValidationError."""
        from server import GenerateRequest

        with pytest.raises(ValidationError) as exc_info:
            GenerateRequest(prompt="test", seed=-1)
        assert "seed" in str(exc_info.value).lower()

    def test_none_values_accepted(self):
        """None values should be accepted for all optional params."""
        from server import GenerateRequest

        req = GenerateRequest(
            prompt="test",
            image_size=None,
            aspect_ratio=None,
            seed=None,
            safety_level=None,
        )
        assert req.image_size is None
        assert req.aspect_ratio is None
        assert req.seed is None
        assert req.safety_level is None

    def test_all_params_together(self):
        """All valid params should work together."""
        from server import GenerateRequest

        req = GenerateRequest(
            prompt="test prompt",
            title="Test Title",
            image_size="2K",
            aspect_ratio="16:9",
            seed=42,
            safety_level="BLOCK_MEDIUM_AND_ABOVE",
        )
        assert req.prompt == "test prompt"
        assert req.image_size == "2K"
        assert req.aspect_ratio == "16:9"
        assert req.seed == 42
        assert req.safety_level == "BLOCK_MEDIUM_AND_ABOVE"


class TestGeneratePromptsRequestValidation:
    """Tests for GeneratePromptsRequest parameter validation."""

    def test_valid_params(self):
        """Valid params should be accepted."""
        from server import GeneratePromptsRequest

        req = GeneratePromptsRequest(
            prompt="test",
            image_size="4K",
            aspect_ratio="21:9",
            seed=100,
            safety_level="BLOCK_NONE",
        )
        assert req.image_size == "4K"
        assert req.aspect_ratio == "21:9"

    def test_invalid_params_rejected(self):
        """Invalid params should raise ValidationError."""
        from server import GeneratePromptsRequest

        with pytest.raises(ValidationError):
            GeneratePromptsRequest(prompt="test", image_size="invalid")

        with pytest.raises(ValidationError):
            GeneratePromptsRequest(prompt="test", seed=-5)


class TestGenerateFromPromptsRequestValidation:
    """Tests for GenerateFromPromptsRequest parameter validation."""

    def test_valid_params(self):
        """Valid params should be accepted."""
        from server import GenerateFromPromptsRequest

        req = GenerateFromPromptsRequest(
            title="Test",
            prompts=[{"text": "prompt 1"}],
            image_size="1K",
            aspect_ratio="3:4",
            seed=999,
            safety_level="BLOCK_ONLY_HIGH",
        )
        assert req.image_size == "1K"
        assert req.aspect_ratio == "3:4"

    def test_invalid_params_rejected(self):
        """Invalid params should raise ValidationError."""
        from server import GenerateFromPromptsRequest

        with pytest.raises(ValidationError):
            GenerateFromPromptsRequest(
                title="Test",
                prompts=[{"text": "test"}],
                aspect_ratio="invalid",
            )


class TestSettingsRequestValidation:
    """Tests for SettingsRequest parameter validation."""

    def test_valid_params(self):
        """Valid params should be accepted."""
        from server import SettingsRequest

        req = SettingsRequest(
            variation_prompt="test prompt",
            image_size="2K",
            aspect_ratio="9:16",
            seed=0,
            safety_level="BLOCK_LOW_AND_ABOVE",
        )
        assert req.image_size == "2K"
        assert req.aspect_ratio == "9:16"
        assert req.seed == 0
        assert req.safety_level == "BLOCK_LOW_AND_ABOVE"

    def test_invalid_params_rejected(self):
        """Invalid params should raise ValidationError."""
        from server import SettingsRequest

        with pytest.raises(ValidationError):
            SettingsRequest(
                variation_prompt="test",
                safety_level="BLOCK_UNKNOWN",
            )


class TestSettingsAPIValidation:
    """Tests for settings API parameter validation."""

    def test_update_settings_with_valid_params(self, client):
        """PUT /api/settings accepts valid image generation params."""
        response = client.put(
            "/api/settings",
            json={
                "variation_prompt": "test prompt",
                "image_size": "2K",
                "aspect_ratio": "16:9",
                "seed": 42,
                "safety_level": "BLOCK_MEDIUM_AND_ABOVE",
            },
        )
        assert response.status_code == 200

        # Verify they persisted
        get_response = client.get("/api/settings")
        data = get_response.json()
        assert data["image_size"] == "2K"
        assert data["aspect_ratio"] == "16:9"
        assert data["seed"] == 42
        assert data["safety_level"] == "BLOCK_MEDIUM_AND_ABOVE"

    def test_update_settings_rejects_invalid_image_size(self, client):
        """PUT /api/settings rejects invalid image_size."""
        response = client.put(
            "/api/settings",
            json={
                "variation_prompt": "test",
                "image_size": "5K",  # Invalid
            },
        )
        assert response.status_code == 422  # Validation error

    def test_update_settings_rejects_invalid_aspect_ratio(self, client):
        """PUT /api/settings rejects invalid aspect_ratio."""
        response = client.put(
            "/api/settings",
            json={
                "variation_prompt": "test",
                "aspect_ratio": "invalid",
            },
        )
        assert response.status_code == 422

    def test_update_settings_rejects_negative_seed(self, client):
        """PUT /api/settings rejects negative seed."""
        response = client.put(
            "/api/settings",
            json={
                "variation_prompt": "test",
                "seed": -1,
            },
        )
        assert response.status_code == 422

    def test_update_settings_rejects_invalid_safety_level(self, client):
        """PUT /api/settings rejects invalid safety_level."""
        response = client.put(
            "/api/settings",
            json={
                "variation_prompt": "test",
                "safety_level": "BLOCK_EVERYTHING",
            },
        )
        assert response.status_code == 422
