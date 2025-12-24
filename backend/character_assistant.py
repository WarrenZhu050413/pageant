"""Character Creation Assistant - AI-guided character definition.

Uses Gemini Flash to analyze reference images and generate targeted questions
to help users create detailed, consistent character descriptions.
"""

import json
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


class CharacterOption(BaseModel):
    """A single option for a character question."""

    label: str = Field(description="Concise choice label (1-5 words)")
    description: str = Field(description="What this option means for the character")


class CharacterQuestion(BaseModel):
    """A single question with options."""

    question: str = Field(description="Clear question ending with ?")
    header: str = Field(description="Short category label (max 12 chars)")
    options: list[CharacterOption] = Field(
        min_length=2, max_length=4, description="2-4 distinct options"
    )
    multiSelect: bool = Field(
        default=False, description="Allow multiple selections"
    )


class CharacterQuestionsResponse(BaseModel):
    """Response containing generated questions."""

    questions: list[CharacterQuestion] = Field(
        min_length=1, max_length=4, description="1-4 targeted questions"
    )
    suggested_name: str | None = Field(
        default=None,
        description="AI-suggested name based on images (if no name provided)"
    )


class CharacterDescriptionResponse(BaseModel):
    """Response containing the generated character description."""

    description: str = Field(description="Detailed character description for image generation")
    summary: dict[str, str] = Field(
        description="Key attributes as category-value pairs"
    )


# =============================================================================
# System Prompts
# =============================================================================

CHARACTER_QUESTION_PROMPT = """You are a character creation assistant for an AI image generation studio.

Your job is to analyze reference images of a character and generate targeted questions that help the user define a clear, consistent character description for image generation.

## Guidelines

1. **Analyze the reference images**: Look at what's consistent across images - appearance, style, mood
2. **Generate 1-4 questions**: Focus on clarifying aspects needed for consistent generation
3. **Provide 2-4 options per question**: Each option should lead to meaningfully different character portrayals
4. **Mark recommended options**: Based on images, append "(Recommended)" to the best-fitting option's label
5. **Use clear headers**: Max 12 chars - "Role", "Personality", "Age", "Species", "Style", "Era", "Mood", "Traits"
6. **Consider what's visible**: Use image evidence to make smart recommendations

## Question Categories

Pick from these based on what would help define the character:

- **Role**: What is this character's role? Hero, sidekick, mentor, antagonist?
- **Personality**: Brave, shy, mischievous, wise, mysterious?
- **Species**: Human, animal, mythical creature, robot, hybrid?
- **Age**: Child, teen, young adult, middle-aged, elderly?
- **Style**: Realistic, cartoon, anime, painterly, pixel art?
- **Era**: Modern, historical, fantasy, sci-fi, steampunk?
- **Mood**: Cheerful, serious, brooding, playful, elegant?
- **Traits**: Any distinctive physical or personality traits?

## Example

For images showing a fluffy white dog:
- What role does this character play? (header: "Role", options: ["Main Hero (Recommended)", "Loyal Companion", "Wise Guide", "Comic Relief"])
- What's their personality? (header: "Personality", options: ["Brave & Bold", "Gentle & Kind (Recommended)", "Mischievous", "Noble & Dignified"])
- What visual style? (header: "Style", options: ["Realistic (Recommended)", "Cartoon/Animated", "Painterly", "Stylized"])

## Important

- Use the reference images to infer what fits best
- Keep options concrete and visualizable
- Focus on aspects that affect how the character should be depicted
- Put "(Recommended)" in the label field based on image analysis

If a character name was NOT provided, also suggest a fitting name in `suggested_name`.
"""

CHARACTER_DESCRIPTION_PROMPT = """You are a character creation assistant for an AI image generation studio.

Your job is to synthesize a detailed character description based on the reference images and user's answers to questions.

## Guidelines

1. **Create a rich description**: Write a detailed character description optimized for AI image generation
2. **Incorporate all answers**: Weave the user's selections naturally into the description
3. **Reference image qualities**: Describe consistent visual elements from the reference images
4. **Focus on visual details**: Appearance, clothing, accessories, distinctive features
5. **Include personality cues**: How personality manifests visually (expression, pose, energy)
6. **Keep it concise but complete**: Aim for 2-4 sentences that capture the essential visual identity

## Response Format

Return a JSON object with:
- `description`: The character description text (optimized for generation prompts)
- `summary`: Key attributes as category-value pairs (e.g., {"Role": "Hero", "Style": "Realistic", "Mood": "Adventurous"})

The summary should include 3-5 key defining attributes.

## Example

Reference images: fluffy white dog in various poses
Answers: Main Hero, Brave & Bold, Realistic style

Result:
{
  "description": "A fluffy white Samoyed with bright, intelligent eyes and a confident stance. Thick, cloud-like fur with a proud, plumed tail. Expressive face often showing determination and courage. Natural, realistic rendering with attention to fur texture and warm lighting.",
  "summary": {"Role": "Main Hero", "Personality": "Brave & Bold", "Style": "Realistic", "Coat": "Fluffy White"}
}
"""


# =============================================================================
# Service Class
# =============================================================================


class CharacterAssistantService:
    """Service for AI-assisted character creation."""

    def __init__(self, api_key: str):
        # Import config for model and timeout settings
        try:
            from backend.config import DEFAULT_FAST_TEXT_MODEL, GEMINI_TIMEOUT_MS
        except ImportError:
            from config import DEFAULT_FAST_TEXT_MODEL, GEMINI_TIMEOUT_MS

        self.model = DEFAULT_FAST_TEXT_MODEL
        http_options = types.HttpOptions(timeout=GEMINI_TIMEOUT_MS)
        self.client = genai.Client(api_key=api_key, http_options=http_options)

    async def generate_questions(
        self,
        reference_images: list[tuple[bytes, str]],
        name: str | None = None,
        initial_description: str | None = None,
    ) -> CharacterQuestionsResponse:
        """Generate clarifying questions for character creation.

        Args:
            reference_images: List of (bytes, mime_type) tuples for reference images
            name: Optional character name (if not provided, AI may suggest one)
            initial_description: Optional initial description from user

        Returns:
            CharacterQuestionsResponse with 1-4 questions and optional name suggestion
        """
        start_time = time.time()

        # Build contents
        contents: list[Any] = []

        # Add name if provided
        if name:
            contents.append(f"Character name: {name}")
        else:
            contents.append("Character name: Not provided yet (please suggest one)")

        # Add initial description if provided
        if initial_description:
            contents.append(f"User's initial description: {initial_description}")

        # Add reference images
        contents.append(f"\n{len(reference_images)} reference image(s) provided:")
        for i, (img_bytes, mime_type) in enumerate(reference_images, 1):
            contents.append(f"\n[Reference Image {i}]")
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

        contents.append("\nGenerate questions to help define this character.")

        logger.info(
            f"[character_questions] Generating questions for character"
            f" (name={name}, images={len(reference_images)})"
        )

        config = types.GenerateContentConfig(
            system_instruction=CHARACTER_QUESTION_PROMPT,
            response_mime_type="application/json",
            response_schema=CharacterQuestionsResponse,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
            result = CharacterQuestionsResponse.model_validate_json(response.text)
            elapsed = time.time() - start_time
            logger.info(
                f"[character_questions] Generated {len(result.questions)} questions in {elapsed:.1f}s"
                + (f", suggested name: {result.suggested_name}" if result.suggested_name else "")
            )
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[character_questions] Failed after {elapsed:.1f}s: {e}")
            raise

    async def generate_description(
        self,
        reference_images: list[tuple[bytes, str]],
        name: str,
        questions: list[dict[str, Any]],
        answers: dict[str, str | list[str]],
        initial_description: str | None = None,
    ) -> CharacterDescriptionResponse:
        """Generate a character description based on images and Q&A.

        Args:
            reference_images: List of (bytes, mime_type) tuples
            name: Character name
            questions: The questions that were asked
            answers: User's answers keyed by question text
            initial_description: Optional initial description from user

        Returns:
            CharacterDescriptionResponse with description and summary
        """
        start_time = time.time()

        # Build contents
        contents: list[Any] = []

        contents.append(f"Character name: {name}")

        if initial_description:
            contents.append(f"User's initial notes: {initial_description}")

        # Add reference images
        contents.append(f"\n{len(reference_images)} reference image(s):")
        for i, (img_bytes, mime_type) in enumerate(reference_images, 1):
            contents.append(f"\n[Reference Image {i}]")
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

        # Add Q&A
        contents.append("\n\nUser's answers to questions:")
        for q in questions:
            q_text = q.get("question", "")
            answer = answers.get(q_text, "Not answered")
            if isinstance(answer, list):
                answer = ", ".join(answer)
            contents.append(f"\nQ: {q_text}")
            contents.append(f"A: {answer}")

        contents.append("\n\nGenerate a character description for image generation.")

        logger.info(
            f"[character_description] Generating description for {name}"
            f" with {len(questions)} Q&A pairs"
        )

        config = types.GenerateContentConfig(
            system_instruction=CHARACTER_DESCRIPTION_PROMPT,
            response_mime_type="application/json",
            response_schema=CharacterDescriptionResponse,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
            result = CharacterDescriptionResponse.model_validate_json(response.text)
            elapsed = time.time() - start_time
            logger.info(
                f"[character_description] Generated description in {elapsed:.1f}s: "
                f"{result.description[:100]}..."
            )
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[character_description] Failed after {elapsed:.1f}s: {e}")
            raise
