"""Story Writing Assistant - AI-guided chapter and narrative creation.

Uses Gemini Flash to help users write chapter narratives and suggest
next chapters based on story context.
"""

import logging
import time
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Configure module logger
logger = logging.getLogger(__name__)


# =============================================================================
# Pydantic Models
# =============================================================================


class ChapterSuggestion(BaseModel):
    """A single chapter suggestion."""

    title: str = Field(description="Suggested chapter title")
    narrative: str = Field(description="Suggested narrative text for the chapter")
    rationale: str = Field(description="Brief explanation of why this chapter fits the story")


class ChapterSuggestionsResponse(BaseModel):
    """Response containing suggested chapters."""

    suggestions: list[ChapterSuggestion] = Field(
        min_length=1, max_length=4, description="1-4 chapter suggestions"
    )


class NarrativeRewriteResponse(BaseModel):
    """Response containing rewritten narrative."""

    narrative: str = Field(description="Improved/expanded narrative text")
    changes_summary: str = Field(description="Brief summary of what was changed/improved")


# =============================================================================
# System Prompts
# =============================================================================

CHAPTER_SUGGESTION_PROMPT = """You are a story writing assistant for a visual narrative/storybook studio.

Your job is to suggest the next chapter(s) in a story based on the existing story context.

## Guidelines

1. **Analyze the story context**: Look at the story title, description, existing chapters, and characters
2. **Suggest 1-4 chapters**: Each should be a natural continuation of the narrative
3. **Write visual narratives**: Remember these chapters will be illustrated, so focus on:
   - Visual descriptions that can be depicted in images
   - Clear scene-setting and atmosphere
   - Character actions and expressions
   - Avoid abstract concepts that can't be visualized
4. **Maintain consistency**: Keep character personalities and story tone consistent
5. **Provide variety**: Offer different narrative directions (action, emotional, atmospheric, etc.)

## Response Format

Return JSON with 1-4 chapter suggestions. Each suggestion should have:
- `title`: A concise, evocative chapter title
- `narrative`: 2-4 sentences describing what happens, optimized for visual generation
- `rationale`: Brief explanation of why this fits the story

## Example

Story: "Luna's Adventure"
Existing chapters: "The Beginning" (Luna finds a mysterious map)

Suggestions:
1. Title: "Into the Forest"
   Narrative: "Luna ventures into the misty forest, following the ancient map. Twisted trees loom overhead as shafts of golden light pierce the canopy. She discovers a hidden path marked by glowing mushrooms."
   Rationale: "Natural next step after finding the map - beginning the journey"

2. Title: "The First Clue"
   Narrative: "At a moss-covered stone bridge, Luna finds a riddle carved into the weathered rock. She studies it carefully, her expression shifting from confusion to determination."
   Rationale: "Introduces puzzle elements and shows character development"
"""

NARRATIVE_REWRITE_PROMPT = """You are a story writing assistant for a visual narrative/storybook studio.

Your job is to improve and expand a chapter narrative for visual storytelling.

## Guidelines

1. **Focus on visual details**: Add descriptions that can be illustrated
2. **Keep it concise**: 2-5 sentences, not a full novel
3. **Enhance atmosphere**: Add sensory details (lighting, colors, mood)
4. **Character expressions**: How do characters look/feel?
5. **Scene composition**: What's in the foreground/background?
6. **Maintain the core idea**: Don't change the fundamental story beat

## What to improve

- Vague descriptions → Specific visual details
- Abstract emotions → Physical manifestations
- Static scenes → Dynamic moments
- Generic settings → Distinctive environments

## Example

Original: "Luna was scared in the dark forest."

Improved: "Luna trembles among towering shadows, her eyes wide as twisted branches reach toward a blood-red moon. Mist curls around her ankles while strange lights flicker in the distant darkness."
"""


# =============================================================================
# Service Class
# =============================================================================


class StoryAssistantService:
    """Service for AI-assisted story writing."""

    def __init__(self, api_key: str):
        # Import config for model and timeout settings
        try:
            from backend.config import DEFAULT_FAST_TEXT_MODEL, GEMINI_TIMEOUT_MS
        except ImportError:
            from config import DEFAULT_FAST_TEXT_MODEL, GEMINI_TIMEOUT_MS

        self.model = DEFAULT_FAST_TEXT_MODEL
        http_options = types.HttpOptions(timeout=GEMINI_TIMEOUT_MS)
        self.client = genai.Client(api_key=api_key, http_options=http_options)

    async def suggest_chapters(
        self,
        story_title: str,
        story_description: str | None = None,
        existing_chapters: list[dict[str, Any]] | None = None,
        character_names: list[str] | None = None,
        num_suggestions: int = 3,
    ) -> ChapterSuggestionsResponse:
        """Suggest next chapter(s) for a story.

        Args:
            story_title: The story's title
            story_description: Optional story description
            existing_chapters: List of existing chapters with title and text
            character_names: Names of characters in the story
            num_suggestions: How many suggestions to generate (1-4)

        Returns:
            ChapterSuggestionsResponse with chapter suggestions
        """
        start_time = time.time()

        # Build context
        contents: list[str] = []

        contents.append(f"STORY TITLE: {story_title}")
        if story_description:
            contents.append(f"STORY DESCRIPTION: {story_description}")

        if character_names:
            contents.append(f"\nCHARACTERS: {', '.join(character_names)}")

        if existing_chapters:
            contents.append("\nEXISTING CHAPTERS:")
            for i, ch in enumerate(existing_chapters, 1):
                title = ch.get("title", f"Chapter {i}")
                text = ch.get("text", "")
                contents.append(f"\n{i}. \"{title}\"")
                if text:
                    contents.append(f"   {text}")
        else:
            contents.append("\nNo chapters yet - this will be the first chapter.")

        contents.append(f"\n\nPlease suggest {num_suggestions} possible next chapter(s).")

        logger.info(
            f"[story_suggest] Generating {num_suggestions} chapter suggestions for '{story_title}'"
        )

        config = types.GenerateContentConfig(
            system_instruction=CHAPTER_SUGGESTION_PROMPT,
            response_mime_type="application/json",
            response_schema=ChapterSuggestionsResponse,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents="\n".join(contents),
                config=config,
            )
            result = ChapterSuggestionsResponse.model_validate_json(response.text)
            elapsed = time.time() - start_time
            logger.info(
                f"[story_suggest] Generated {len(result.suggestions)} suggestions in {elapsed:.1f}s"
            )
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[story_suggest] Failed after {elapsed:.1f}s: {e}")
            raise

    async def rewrite_narrative(
        self,
        original_narrative: str,
        chapter_title: str | None = None,
        story_context: str | None = None,
        instruction: str | None = None,
    ) -> NarrativeRewriteResponse:
        """Improve/expand a chapter narrative.

        Args:
            original_narrative: The current narrative text
            chapter_title: Optional chapter title for context
            story_context: Optional story context
            instruction: Optional specific instruction (e.g., "make it darker", "add more action")

        Returns:
            NarrativeRewriteResponse with improved narrative
        """
        start_time = time.time()

        # Build context
        contents: list[str] = []

        if story_context:
            contents.append(f"STORY CONTEXT: {story_context}")

        if chapter_title:
            contents.append(f"CHAPTER TITLE: {chapter_title}")

        contents.append(f"\nORIGINAL NARRATIVE:\n{original_narrative}")

        if instruction:
            contents.append(f"\nSPECIFIC INSTRUCTION: {instruction}")
        else:
            contents.append("\nPlease improve this narrative for visual storytelling.")

        logger.info(
            f"[story_rewrite] Rewriting narrative"
            + (f" for '{chapter_title}'" if chapter_title else "")
        )

        config = types.GenerateContentConfig(
            system_instruction=NARRATIVE_REWRITE_PROMPT,
            response_mime_type="application/json",
            response_schema=NarrativeRewriteResponse,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents="\n".join(contents),
                config=config,
            )
            result = NarrativeRewriteResponse.model_validate_json(response.text)
            elapsed = time.time() - start_time
            logger.info(f"[story_rewrite] Completed in {elapsed:.1f}s: {result.changes_summary}")
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[story_rewrite] Failed after {elapsed:.1f}s: {e}")
            raise
