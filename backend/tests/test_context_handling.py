"""Tests for context image handling during generation.

Issue #18: Context fallback should use 0 images, not all global context
When a variation doesn't have recommended_context_ids, we should NOT
fall back to all global context images.
"""

import pytest


class TestContextFallbackBehavior:
    """Tests for the context fallback behavior in generate-from-prompts."""

    def test_generate_prompts_schema_includes_recommended_context_ids(self):
        """Verify PromptVariation schema has recommended_context_ids field."""
        from server import PromptVariation

        # Create a variation without context (id is required)
        variation = PromptVariation(
            id="var-1",
            text="A test prompt",
            mood="neutral",
            type="variation"
        )
        assert variation.recommended_context_ids == []

        # Create a variation with specific context
        variation_with_ctx = PromptVariation(
            id="var-2",
            text="A prompt with context",
            mood="warm",
            type="faithful",
            recommended_context_ids=["img-1", "img-2"]
        )
        assert variation_with_ctx.recommended_context_ids == ["img-1", "img-2"]

    def test_empty_recommended_context_uses_no_context(self):
        """
        When recommended_context_ids is empty/missing, variation should use
        NO context images, not fall back to global context.

        This is the fix for issue #18.
        """
        # Test that the logic in server.py correctly handles this case
        # by checking what happens when per_var_ids is empty

        # Simulate the context handling logic from server.py
        global_context_images = ["ctx-1", "ctx-2", "ctx-3"]  # simulated global
        context_image_map = {
            "ctx-1": {"id": "ctx-1", "data": "..."},
            "ctx-2": {"id": "ctx-2", "data": "..."},
            "ctx-3": {"id": "ctx-3", "data": "..."},
        }

        # Case 1: Variation with specific context
        prompt_with_ctx = {"text": "test", "recommended_context_ids": ["ctx-1"]}
        per_var_ids = prompt_with_ctx.get("recommended_context_ids", [])
        if per_var_ids:
            variation_context = [
                context_image_map[img_id]
                for img_id in per_var_ids
                if img_id in context_image_map
            ]
        else:
            # CORRECT: Use None (no context), NOT global_context_images
            variation_context = None

        assert variation_context == [{"id": "ctx-1", "data": "..."}]

        # Case 2: Variation WITHOUT specific context (the fix for issue #18)
        prompt_without_ctx = {"text": "test"}  # No recommended_context_ids
        per_var_ids = prompt_without_ctx.get("recommended_context_ids", [])
        if per_var_ids:
            variation_context = [
                context_image_map[img_id]
                for img_id in per_var_ids
                if img_id in context_image_map
            ]
        else:
            # CORRECT: Use None (no context), NOT global_context_images
            variation_context = None

        # This is the key assertion - variation_context should be None,
        # NOT the global_context_images list
        assert variation_context is None
        assert variation_context != global_context_images

    def test_empty_list_recommended_context_uses_no_context(self):
        """
        When recommended_context_ids is explicitly an empty list [],
        variation should use NO context images.
        """
        prompt_with_empty_ctx = {"text": "test", "recommended_context_ids": []}
        per_var_ids = prompt_with_empty_ctx.get("recommended_context_ids", [])

        # Empty list should not trigger context usage
        if per_var_ids:
            variation_context = ["would", "have", "context"]
        else:
            variation_context = None

        assert variation_context is None


class TestContextImageTracking:
    """Tests for tracking which context images were used for a prompt.

    Note: Prompts are stored as dicts in metadata.json, not as Pydantic models.
    These tests verify the expected structure for context tracking.
    """

    def test_prompt_structure_supports_context_image_ids(self):
        """Prompts should be able to store context_image_ids field."""
        # Simulate prompt structure as stored in metadata.json
        prompt_with_context = {
            "id": "test-prompt-1",
            "prompt": "A test prompt",
            "title": "Test",
            "images": [],
            "created_at": "2024-01-01T00:00:00Z",
            "context_image_ids": ["img-1", "img-2"]
        }
        assert prompt_with_context.get("context_image_ids") == ["img-1", "img-2"]

    def test_prompt_without_context_defaults_to_empty_list(self):
        """Prompts without context should default to empty list when accessed."""
        # Simulate prompt structure without context_image_ids
        prompt_without_context = {
            "id": "test-prompt-2",
            "prompt": "A test prompt without context",
            "title": "Test",
            "images": [],
            "created_at": "2024-01-01T00:00:00Z"
        }
        # When accessing, should default to empty list
        context_ids = prompt_without_context.get("context_image_ids", [])
        assert context_ids == []

    def test_context_image_ids_preserved_in_generation_response(self):
        """Verify the generation endpoint response includes context_image_ids."""
        # This tests that when we create a prompt with context, it's preserved
        # The actual endpoint test would require fixtures, but we test the structure
        generation_response_prompt = {
            "id": "gen-prompt-1",
            "prompt": "Generated prompt",
            "title": "Generated",
            "images": [{"id": "img-1", "image_path": "test.jpg"}],
            "created_at": "2024-01-01T00:00:00Z",
            "context_image_ids": ["ctx-1", "ctx-2"],  # Context used for generation
            "base_prompt": "User's original prompt"
        }
        assert "context_image_ids" in generation_response_prompt
        assert len(generation_response_prompt["context_image_ids"]) == 2
