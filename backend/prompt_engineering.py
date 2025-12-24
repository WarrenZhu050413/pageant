"""Prompt Engineering Workspace - Structured question-based prompt optimization.

Uses Gemini Flash to analyze prompts and generate targeted questions
following the AskUserQuestion schema pattern.
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
# Pydantic Models (AskUserQuestion schema)
# =============================================================================


class Option(BaseModel):
    """A single option for a question."""

    label: str = Field(description="Concise choice label (1-5 words)")
    description: str = Field(description="What this option means or implies")


class Question(BaseModel):
    """A single question with options."""

    question: str = Field(description="Clear question ending with ?")
    header: str = Field(description="Short category label (max 12 chars)")
    options: list[Option] = Field(
        min_length=2, max_length=4, description="2-4 distinct options"
    )
    multiSelect: bool = Field(
        default=False, description="Allow multiple selections"
    )


class QuestionsResponse(BaseModel):
    """Response containing generated questions."""

    questions: list[Question] = Field(
        min_length=1, max_length=4, description="1-4 targeted questions"
    )


class PromptSummaryItem(BaseModel):
    """A single key-value pair for prompt summary."""

    category: str = Field(description="Category name like Style, Lighting, Mood")
    value: str = Field(description="The chosen value for this category")


class OptimizedPromptResponse(BaseModel):
    """Response containing the optimized prompt."""

    optimized_prompt: str = Field(description="Enhanced prompt incorporating user answers")
    prompt_summary: list[PromptSummaryItem] = Field(
        description="Key decisions as category-value pairs, e.g. [{'category': 'Style', 'value': 'Photorealistic'}]"
    )


# =============================================================================
# System Prompts
# =============================================================================

QUESTION_GENERATION_PROMPT = """You are a prompt engineering assistant for an AI image generation studio.

Your job is to analyze the user's prompt and generate targeted questions that help them clarify their thinking and fill in missing pieces for effective image generation.

## Guidelines

1. **Identify gaps**: What key visual decisions hasn't the user made yet?
2. **Generate 1-4 questions**: Focus on the most impactful areas needing clarification
3. **Provide 2-4 options per question**: Each option should lead to meaningfully different images
4. **Mark recommended options in the label**: If one option fits best given context, append "(Recommended)" to its label text, NOT the description
5. **Use clear headers**: Max 12 characters - "Subject", "Setting", "Style", "Lighting", "Mood", "Framing", "Colors", "Era", "Detail"
6. **Consider context images**: Use them to infer preferences and make smarter recommendations

## Question Categories

Pick from these based on what's missing from the prompt:

- **Subject**: What exactly is depicted? Specific type, pose, expression, action?
- **Setting**: Where is this? Indoor/outdoor? Specific location or abstract?
- **Style**: Photorealistic, illustration, painting, 3D render, vintage photo, anime?
- **Lighting**: Natural/artificial? Time of day? Dramatic or soft? Direction?
- **Mood**: Emotional tone - serene, tense, joyful, melancholic, mysterious?
- **Framing**: Close-up, medium shot, wide establishing? Camera angle?
- **Colors**: Warm/cool palette? Saturated/muted? Specific color scheme?
- **Era**: Contemporary, retro, futuristic, historical period?
- **Detail**: Highly detailed or minimalist? Textured or smooth?
- **Materials**: What textures and surfaces are prominent?

## Example

For prompt "a cat in a garden":
- What type of cat? (header: "Subject", options: ["Fluffy Persian (Recommended)", "Sleek Siamese", "Orange Tabby", "Black Cat"])
- What style? (header: "Style", options: ["Photorealistic", "Watercolor", "Digital Art", "Vintage Photo"])
- What lighting? (header: "Lighting", options: ["Golden Hour (Recommended)", "Bright Midday", "Soft Morning Mist", "Dappled Shade"])

## Important

- Don't ask about things already specified in the prompt
- Prioritize questions that would most improve the final image
- If context images are provided, use them to recommend options that match their aesthetic
- Keep options concrete and visualizable
- Put "(Recommended)" in the label field, not the description
"""

OPTIMIZATION_PROMPT = """You are a prompt engineering assistant for an AI image generation studio.

Your job is to take the user's original prompt and their answers to clarifying questions, then synthesize an enhanced, optimized prompt.

## Guidelines

1. **Incorporate all answers**: Weave the user's selections naturally into the prompt
2. **Maintain the original intent**: Don't change what the user wanted, just add specificity
3. **Use descriptive language**: Include sensory details, mood, and atmosphere
4. **Front-load important details**: Put the most important elements first
5. **Consider context images**: If described, reference their aesthetic qualities
6. **Create an effective prompt**: Focus on clarity and visual specificity, not length

## Response Format

Return a valid JSON object with:
- `optimized_prompt`: The enhanced prompt text
- `prompt_summary`: A list of key decisions as category-value pairs (e.g., [{"category": "Style", "value": "Photorealistic"}, {"category": "Lighting", "value": "Golden Hour"}])

The summary should only include the most important 3-6 decisions that define the image. Use the category names from the questions.

## Example

Original: "a cat in a garden"
Answers: Persian cat, watercolor style, golden hour
Result:
{
  "optimized_prompt": "A fluffy Persian cat lounging in a cottage garden during golden hour, painted in soft watercolor style with warm sunset tones filtering through the flower beds.",
  "prompt_summary": [{"category": "Subject", "value": "Persian Cat"}, {"category": "Style", "value": "Watercolor"}, {"category": "Lighting", "value": "Golden Hour"}]
}
"""

REFINEMENT_PROMPT = """You are a prompt engineering assistant continuing to refine an image generation prompt.

The user has already gone through one or more rounds of questions and answers. Now they want to further refine.

## Context

You will receive:
1. The original prompt
2. History of previous question-answer rounds and resulting prompts
3. The current optimized prompt

## Your Task

Generate NEW questions that:
1. **Don't repeat previous questions**: Check the history to avoid redundancy
2. **Go deeper**: Now that basics are covered, ask about finer details
3. **Explore adjacent aspects**: If style was covered, maybe explore composition or technical details
4. **Build on context**: Use the accumulated prompt to ask more sophisticated questions
5. **Mark recommendations in labels**: Append "(Recommended)" to the label text of the best option

## Question Categories for Refinement

Pick from these based on what hasn't been covered:

- **Detail**: Specific textures, materials, surface qualities
- **Framing**: Camera angle, distance, focal point
- **Colors**: Color temperature, saturation, specific palette
- **Atmosphere**: Weather, time of day nuances, ambient effects
- **Materials**: Fabric types, metal finishes, organic textures
- **Era**: Period-specific details, technology level
- **Context**: Story moment, narrative implication

Return 1-4 new questions that would further improve the prompt.
"""


# =============================================================================
# Service Class
# =============================================================================


class PromptEngineeringService:
    """Service for generating questions and optimizing prompts."""

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
        prompt: str,
        context_images: list[tuple[bytes, str]] | None = None,
        history: list[dict[str, Any]] | None = None,
    ) -> QuestionsResponse:
        """Generate clarifying questions for a prompt.

        Args:
            prompt: The user's current prompt text
            context_images: Optional list of (bytes, mime_type) tuples
            history: Optional list of previous rounds {questions, answers, optimized_prompt}

        Returns:
            QuestionsResponse with 1-4 questions
        """
        start_time = time.time()

        # Choose system prompt based on whether this is first round or refinement
        if history and len(history) > 0:
            system_prompt = REFINEMENT_PROMPT
            operation = "refinement_questions"
        else:
            system_prompt = QUESTION_GENERATION_PROMPT
            operation = "initial_questions"

        # Build contents
        contents: list[Any] = []

        # Add prompt
        contents.append(f"User's prompt: {prompt}")

        # Add history if present
        if history:
            contents.append("\n\n## Previous Rounds:")
            for i, round_data in enumerate(history, 1):
                contents.append(f"\n### Round {i}")
                contents.append(f"Questions asked: {json.dumps(round_data.get('questions', []))}")
                contents.append(f"User answers: {json.dumps(round_data.get('answers', {}))}")
                contents.append(f"Resulting prompt: {round_data.get('optimized_prompt', '')}")

        # Add context images if present
        if context_images:
            contents.append("\n\nContext images provided by user:")
            for i, (img_bytes, mime_type) in enumerate(context_images, 1):
                contents.append(f"\n[Image {i}]")
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

        logger.info(
            f"[{operation}] Generating questions for prompt: {prompt[:100]}..."
            f" (history_rounds={len(history) if history else 0}, images={len(context_images) if context_images else 0})"
        )

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=QuestionsResponse,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
            result = QuestionsResponse.model_validate_json(response.text)
            elapsed = time.time() - start_time
            logger.info(f"[{operation}] Generated {len(result.questions)} questions in {elapsed:.1f}s")
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[{operation}] Failed after {elapsed:.1f}s: {e}")
            raise

    async def optimize_prompt(
        self,
        prompt: str,
        questions: list[dict[str, Any]],
        answers: dict[str, str | list[str]],
        history: list[dict[str, Any]] | None = None,
        context_images: list[tuple[bytes, str]] | None = None,
    ) -> OptimizedPromptResponse:
        """Optimize a prompt based on user's answers to questions.

        Args:
            prompt: The original prompt
            questions: The questions that were asked
            answers: User's answers keyed by question text
            history: Previous rounds for context
            context_images: Optional context images

        Returns:
            OptimizedPromptResponse with enhanced prompt
        """
        start_time = time.time()

        # Build contents
        contents: list[Any] = []

        contents.append(f"Original prompt: {prompt}")

        # Add history if present
        if history:
            contents.append("\n\n## Previous Optimization Rounds:")
            for i, round_data in enumerate(history, 1):
                contents.append(f"\n### Round {i}")
                contents.append(f"Resulting prompt: {round_data.get('optimized_prompt', '')}")

        # Add current round Q&A
        contents.append("\n\n## Current Round - Questions and Answers:")
        for q in questions:
            q_text = q.get("question", "")
            answer = answers.get(q_text, "Not answered")
            if isinstance(answer, list):
                answer = ", ".join(answer)
            contents.append(f"\nQ: {q_text}")
            contents.append(f"A: {answer}")

        # Add context image descriptions if present
        if context_images:
            contents.append("\n\nContext images are present - consider their aesthetic qualities.")
            for i, (img_bytes, mime_type) in enumerate(context_images, 1):
                contents.append(f"\n[Image {i}]")
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

        contents.append("\n\nGenerate an optimized prompt incorporating these answers.")

        logger.info(
            f"[optimize] Optimizing prompt with {len(questions)} Q&A pairs"
            f" (history_rounds={len(history) if history else 0})"
        )

        config = types.GenerateContentConfig(
            system_instruction=OPTIMIZATION_PROMPT,
            response_mime_type="application/json",
            response_schema=OptimizedPromptResponse,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
            result = OptimizedPromptResponse.model_validate_json(response.text)
            elapsed = time.time() - start_time
            logger.info(
                f"[optimize] Generated optimized prompt in {elapsed:.1f}s: "
                f"{result.optimized_prompt[:100]}..."
            )
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[optimize] Failed after {elapsed:.1f}s: {e}")
            raise
