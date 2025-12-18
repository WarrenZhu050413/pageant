"""Tests for prompt template formatting with SafeDict.

The SafeDict class handles missing placeholders gracefully, returning
empty strings instead of raising KeyError. This is critical for
backwards compatibility with saved user prompts that may not have
all the new placeholders.
"""

import pytest


class TestSafeDict:
    """Tests for SafeDict placeholder handling."""

    def test_safedict_returns_empty_for_missing_keys(self):
        """SafeDict should return empty string for missing keys."""
        class SafeDict(dict):
            def __missing__(self, key):
                return ""

        template = "Hello {name}, welcome to {place}!"
        values = SafeDict({"name": "World"})

        # Should not raise KeyError for missing 'place'
        result = template.format_map(values)
        assert result == "Hello World, welcome to !"

    def test_safedict_preserves_existing_values(self):
        """SafeDict should preserve values that are provided."""
        class SafeDict(dict):
            def __missing__(self, key):
                return ""

        template = "{greeting} {name}! Count: {count}"
        values = SafeDict({
            "greeting": "Hello",
            "name": "User",
            "count": 5
        })

        result = template.format_map(values)
        assert result == "Hello User! Count: 5"

    def test_old_prompt_template_without_new_placeholders(self):
        """Old saved prompts without new placeholders should still work."""
        class SafeDict(dict):
            def __missing__(self, key):
                return ""

        # Simulates an old saved variation_prompt without title_context or context_assignment_section
        old_template = """You are a creative director.

Generate {count} scene descriptions based on:
"{base_prompt}"

Requirements:
1. Each scene must be vivid
2. Vary lighting and mood
"""

        format_values = SafeDict({
            "base_prompt": "A sunset over mountains",
            "count": 3,
            "title_context": "USER TITLE: Mountain Sunset",  # New placeholder, not in old template
            "context_assignment_section": "CONTEXT IMAGES: ...",  # New placeholder, not in old template
        })

        # Should work without error (extra values are ignored by format_map)
        result = old_template.format_map(format_values)
        assert "A sunset over mountains" in result
        assert "3" in result
        # The new placeholders shouldn't appear since they're not in the template
        assert "USER TITLE" not in result
        assert "CONTEXT IMAGES" not in result

    def test_new_prompt_template_with_all_placeholders(self):
        """New prompts with all placeholders should work correctly."""
        class SafeDict(dict):
            def __missing__(self, key):
                return ""

        # Simulates the new variation_structured.txt template
        new_template = """You are a creative director.

{title_context}

Generate {count} scene descriptions based on:
"{base_prompt}"

{context_assignment_section}

Requirements:
1. Each scene must be vivid
"""

        format_values = SafeDict({
            "base_prompt": "A sunset over mountains",
            "count": 3,
            "title_context": 'USER TITLE: "Mountain Sunset"',
            "context_assignment_section": "CONTEXT IMAGES: Reference image provided.",
        })

        result = new_template.format_map(format_values)
        assert "A sunset over mountains" in result
        assert "3" in result
        assert 'USER TITLE: "Mountain Sunset"' in result
        assert "CONTEXT IMAGES: Reference image provided." in result

    def test_new_template_with_empty_optional_sections(self):
        """New template should handle empty optional sections gracefully."""
        class SafeDict(dict):
            def __missing__(self, key):
                return ""

        new_template = """Creative director prompt.

{title_context}

Generate {count} variations of:
"{base_prompt}"

{context_assignment_section}

Make them vivid.
"""

        # No title or context provided (empty strings)
        format_values = SafeDict({
            "base_prompt": "A cat",
            "count": 2,
            "title_context": "",
            "context_assignment_section": "",
        })

        result = new_template.format_map(format_values)
        assert "A cat" in result
        assert "2" in result
        # Empty placeholders should result in blank lines (which is fine)

    def test_standard_format_raises_on_missing(self):
        """Standard str.format() raises KeyError for missing keys."""
        template = "Hello {name}, welcome to {place}!"

        with pytest.raises(KeyError):
            template.format(name="World")  # Missing 'place'

    def test_format_map_with_regular_dict_raises(self):
        """format_map with regular dict also raises KeyError."""
        template = "Hello {name}, welcome to {place}!"

        with pytest.raises(KeyError):
            template.format_map({"name": "World"})  # Missing 'place'


class TestPromptTemplateIntegration:
    """Integration tests for prompt template handling in the system."""

    def test_variation_prompt_has_required_placeholders(self):
        """Default variation prompt should have all required placeholders."""
        import sys
        from pathlib import Path

        # Add backend to path
        backend_dir = Path(__file__).parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        from config import load_variation_prompt

        template = load_variation_prompt()

        # Required placeholders that must be in the template
        assert "{base_prompt}" in template
        assert "{count}" in template

        # New placeholders that should be in the default template
        assert "{title_context}" in template
        assert "{context_assignment_section}" in template

    def test_iteration_prompt_has_required_placeholders(self):
        """Default iteration prompt should have required placeholders."""
        import sys
        from pathlib import Path

        backend_dir = Path(__file__).parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        from config import load_iteration_prompt

        template = load_iteration_prompt()

        # Required placeholders for iteration prompt
        assert "{original_prompt}" in template
        assert "{focus}" in template
