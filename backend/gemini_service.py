"""Gemini API service for image generation - simplified from Reverie."""

import base64
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Configure module logger
logger = logging.getLogger(__name__)


# ============================================================
# Pydantic Models for Structured Output
# ============================================================

class DesignTags(BaseModel):
    """Design attributes for a scene variation."""
    colors: list[str] = Field(default_factory=list, description="Color palette tags like 'warm', 'vibrant', 'high-contrast'")
    composition: list[str] = Field(default_factory=list, description="Composition tags like 'centered', 'rule-of-thirds', 'wide-angle'")
    layout: list[str] = Field(default_factory=list, description="Layout tags like 'spacious', 'dense', 'balanced'")
    aesthetic: list[str] = Field(default_factory=list, description="Style tags like 'minimalist', 'photorealistic', 'illustrated'")


class SceneVariation(BaseModel):
    """A single scene variation for image generation."""
    id: str = Field(description="Scene identifier like '1', '2', etc.")
    title: str = Field(description="Short, evocative title for this variation (2-5 words)")
    description: str = Field(description="Detailed scene description for AI image generation")
    design: DesignTags = Field(default_factory=DesignTags, description="Design attributes for this scene")
    # Deprecated - kept for backwards compatibility
    type: str = Field(default="", description="Deprecated")
    mood: str = Field(default="", description="Deprecated")
    # Design dimensions - rich, substantial descriptions for design tokens
    design_dimensions: list[DesignDimensionOutput] = Field(
        default_factory=list,
        description="3-4 substantial design dimensions capturing the visual essence"
    )
    # Per-variation context image assignment
    recommended_context_ids: list[str] = Field(
        default_factory=list,
        description="Image IDs from the pool that best support THIS specific variation"
    )
    context_reasoning: str | None = Field(
        default=None,
        description="Why these specific images were chosen for this variation"
    )


class AnnotationSuggestion(BaseModel):
    """Suggested annotation polish for a context image."""
    image_id: str = Field(description="The ID of the image needing annotation polish")
    original_annotation: str | None = Field(default=None, description="The current annotation")
    suggested_annotation: str = Field(description="A polished annotation for generation context")
    reason: str = Field(description="Why this annotation is more suitable")


class SceneVariationsResponse(BaseModel):
    """Response containing multiple scene variations with context assignments."""
    title: str = Field(description="A short, creative title for this generation (2-5 words)")
    scenes: list[SceneVariation] = Field(description="List of scene variations")
    annotation_suggestions: list[AnnotationSuggestion] | None = Field(
        default=None,
        description="Suggested annotation polish for context images with inadequate descriptions"
    )


# Model for Design Token Extraction
class DesignTokenExtraction(BaseModel):
    """Extracted design token from an image."""
    name: str = Field(description="Short, evocative name (2-4 words)")
    text: str = Field(description="Prompt fragment capturing the essence (1-2 sentences)")
    style_tags: list[str] = Field(description="3-6 style tags for categorization")
    category: str = Field(default="extracted", description="Category: lighting, mood, composition, color, texture, or mixed")


# Models for Polish Prompts feature
class PolishedVariation(BaseModel):
    """A single polished variation result."""
    id: str = Field(description="The variation ID to match back")
    text: str = Field(description="The polished prompt text")
    changes_made: str | None = Field(default=None, description="Brief summary of what was changed")


class PolishPromptsResponse(BaseModel):
    """Response containing polished variations."""
    polished_variations: list[PolishedVariation] = Field(description="List of polished variations")


# Models for Design Dimension Analysis
class DesignDimensionOutput(BaseModel):
    """A single design dimension extracted from an image (for structured output)."""
    axis: str = Field(description="Design axis category like 'lighting', 'mood', 'colors'")
    name: str = Field(description="Evocative 2-4 word name like 'Eerie Green Cast'")
    description: str = Field(description="2-3 sentence analysis of how this dimension manifests")
    tags: list[str] = Field(description="2-3 design vocabulary tags")
    generation_prompt: str = Field(description="Prompt for generating pure concept image")


class DimensionAnalysisResponse(BaseModel):
    """Response containing design dimension analysis."""
    dimensions: list[DesignDimensionOutput] = Field(description="List of design dimensions")


# Model for Multi-Image Dimension Suggestion
class MultiImageDimensionOutput(BaseModel):
    """A design dimension common across multiple images."""
    axis: str = Field(description="Design axis category like 'lighting', 'mood', 'colors'")
    name: str = Field(description="Evocative 2-4 word name like 'Warm Golden Hour'")
    description: str = Field(description="2-3 sentence analysis of how this dimension manifests across the images")
    tags: list[str] = Field(description="3-5 design vocabulary tags")
    generation_prompt: str = Field(description="Prompt for generating pure concept image")
    commonality: str = Field(description="Brief explanation of what makes this dimension common across the images")


class MultiImageDimensionResponse(BaseModel):
    """Response containing dimensions common across multiple images."""
    dimensions: list[MultiImageDimensionOutput] = Field(description="List of common design dimensions")


def _detect_image_mime_type(data: bytes) -> str:
    """Detect actual image MIME type from magic bytes."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif data[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif data[:4] == b'RIFF' and len(data) > 12 and data[8:12] == b'WEBP':
        return "image/webp"
    elif data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    return "image/png"


@dataclass
class ImageResult:
    """Image generation result."""
    text: str | None
    images: list[dict[str, Any]] = field(default_factory=list)
    model: str = ""
    usage: dict[str, Any] | None = None


@dataclass
class TextResult:
    """Text generation result (optionally with web search grounding)."""
    text: str
    grounding_sources: list[dict[str, Any]] = field(default_factory=list)
    search_queries: list[str] = field(default_factory=list)
    model: str = ""
    usage: dict[str, Any] | None = None


@dataclass
class DesignAnnotation:
    """Design dimension annotations for an image.

    Fully dynamic - axes is a dict mapping axis name to list of tags.
    Example: {"colors": ["warm", "vibrant"], "mood": ["elegant"]}
    """
    axes: dict[str, list[str]]  # Dynamic axis → tags mapping
    raw_response: str = ""  # Original model response for debugging


class GeminiService:
    """Service for Gemini image and text generation."""

    def __init__(self, api_key: str | None = None):
        # Import config with fallback for different import contexts
        # - 'backend.config' when running as package (uvicorn backend.server:app)
        # - 'config' when running directly or in tests
        try:
            from backend.config import DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_FAST_TEXT_MODEL, get_gemini_api_key
        except ImportError:
            from config import DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_FAST_TEXT_MODEL, get_gemini_api_key

        self.DEFAULT_TEXT_MODEL = DEFAULT_TEXT_MODEL
        self.DEFAULT_IMAGE_MODEL = DEFAULT_IMAGE_MODEL
        self.DEFAULT_FAST_TEXT_MODEL = DEFAULT_FAST_TEXT_MODEL

        self.api_key = api_key or get_gemini_api_key()

        # Configure HTTP options with extended timeout and retry for image generation
        # Image generation can take longer and may hit rate limits
        http_options = types.HttpOptions(
            timeout=120000,  # 120 seconds (image gen can be slow)
            retry_options=types.HttpRetryOptions(
                attempts=3,  # Retry failed requests up to 3 times
            ),
        )
        self.client = genai.Client(api_key=self.api_key, http_options=http_options)

        # Import load_prompt for externalized prompts
        try:
            from backend.config import load_prompt
        except ImportError:
            from config import load_prompt
        self._load_prompt = load_prompt

    async def _generate_structured[T: BaseModel](
        self,
        *,
        prompt: str,
        response_schema: type[T],
        model: str | None = None,
        images: list[tuple[bytes, str, str | None]] | None = None,
        system_instruction: str | None = None,
        operation_name: str = "generation",
        temperature: float | None = None,
    ) -> T:
        """Unified structured JSON generation with image interleaving.

        Args:
            prompt: The text prompt to send
            response_schema: Pydantic model class for structured output
            model: Model to use (defaults to DEFAULT_TEXT_MODEL)
            images: Optional list of (bytes, mime_type, label) tuples to interleave
            system_instruction: Optional system instruction
            operation_name: Name for logging (e.g., "polish_annotations")
            temperature: Optional temperature setting

        Returns:
            Parsed Pydantic model instance
        """
        model_name = model or self.DEFAULT_TEXT_MODEL
        start_time = time.time()
        num_images = len(images) if images else 0

        logger.info(f"[{operation_name}] Starting with model={model_name}, images={num_images}")

        # Build config
        config_kwargs: dict[str, Any] = {
            "response_mime_type": "application/json",
            "response_schema": response_schema,
        }
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if temperature is not None:
            config_kwargs["temperature"] = temperature

        config = types.GenerateContentConfig(**config_kwargs)

        # Build contents with optional image interleaving
        if images:
            contents: list[Any] = [prompt]
            for img_bytes, mime_type, label in images:
                if label:
                    contents.append(f"\n{label}:")
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
        else:
            contents = prompt

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[{operation_name}] Failed after {elapsed:.1f}s: {e}")
            raise

        elapsed = time.time() - start_time

        # Parse structured response
        result = response_schema.model_validate_json(response.text)

        logger.info(f"[{operation_name}] Completed in {elapsed:.1f}s")
        return result

    async def generate_image(
        self,
        prompt: str,
        context_images: list[tuple[bytes, str, str | None]] | None = None,
        image_size: str | None = None,
        aspect_ratio: str | None = None,
        seed: int | None = None,
        safety_level: str | None = None,
        thinking_level: str | None = None,
        temperature: float | None = None,
        google_search_grounding: bool | None = None,
    ) -> ImageResult:
        """Generate images using Gemini with interleaved context.

        Args:
            prompt: Text prompt for generation
            context_images: Optional list of (image_bytes, mime_type, caption) tuples.
                           Each image is interleaved with its caption for better context.
            image_size: Output size - "1K", "2K", or "4K"
            aspect_ratio: Output aspect ratio - "1:1", "16:9", etc.
            seed: Random seed for reproducibility
            safety_level: Safety filter level - "BLOCK_NONE", "BLOCK_ONLY_HIGH", etc.
            thinking_level: Reasoning depth - "low" or "high" (Gemini 3 models)
            temperature: Randomness control 0.0-2.0 (default 1.0)
            google_search_grounding: Enable real-time web grounding for image gen
        """
        model_name = self.DEFAULT_IMAGE_MODEL
        start_time = time.time()

        num_images = len(context_images) if context_images else 0
        params_info = []
        if image_size:
            params_info.append(f"size={image_size}")
        if aspect_ratio:
            params_info.append(f"ratio={aspect_ratio}")
        if seed is not None:
            params_info.append(f"seed={seed}")
        if thinking_level:
            params_info.append(f"thinking={thinking_level}")
        if temperature is not None:
            params_info.append(f"temp={temperature}")
        if google_search_grounding:
            params_info.append("search=on")
        params_str = f" ({', '.join(params_info)})" if params_info else ""
        print(f"[{model_name}] Generating image with {num_images} context image(s){params_str}...")

        # Log image generation request
        logger.info(f"Image generation request: model={model_name}, context_images={num_images}, params={params_info}")
        logger.debug(f"Image prompt: {prompt[:200]}{'...' if len(prompt) > 200 else ''}")

        # Build image config if any image-specific params are set
        image_config = None
        if image_size or aspect_ratio:
            image_config = types.ImageConfig(
                image_size=image_size,
                aspect_ratio=aspect_ratio,
            )

        # Build safety settings if specified
        safety_settings = None
        if safety_level:
            # Apply to all relevant harm categories
            harm_categories = [
                "HARM_CATEGORY_HARASSMENT",
                "HARM_CATEGORY_HATE_SPEECH",
                "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "HARM_CATEGORY_DANGEROUS_CONTENT",
            ]
            safety_settings = [
                types.SafetySetting(category=cat, threshold=safety_level)
                for cat in harm_categories
            ]

        # Build tools for google search grounding
        tools = None
        if google_search_grounding:
            tools = [types.Tool(google_search=types.GoogleSearch())]

        # Build config with all parameters
        config_kwargs: dict[str, Any] = {
            "response_modalities": ["IMAGE"],
            "image_config": image_config,
            "safety_settings": safety_settings,
            "seed": seed,
        }
        # thinking_level must be wrapped in ThinkingConfig (not passed directly)
        if thinking_level:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_level=thinking_level
            )
        if temperature is not None:
            config_kwargs["temperature"] = temperature
        if tools:
            config_kwargs["tools"] = tools

        config = types.GenerateContentConfig(**config_kwargs)

        # Build interleaved contents: [img1, caption1, img2, caption2, ..., prompt]
        if context_images:
            contents = []
            for i, (img_bytes, mime_type, caption) in enumerate(context_images):
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                if caption:
                    contents.append(f"Reference {i+1}: {caption}")
            contents.append(prompt)
        else:
            contents = prompt

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
        except Exception as e:
            elapsed = time.time() - start_time
            # Log detailed error information
            error_msg = str(e)
            error_type = type(e).__name__
            print(f"[ERROR] Generation failed after {elapsed:.1f}s")
            print(f"  Error Type: {error_type}")
            print(f"  Error Message: {error_msg}")
            if hasattr(e, 'status_code'):
                print(f"  Status Code: {e.status_code}")
            if hasattr(e, 'reason'):
                print(f"  Reason: {e.reason}")
            raise

        elapsed = time.time() - start_time

        text = None
        images = []

        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text = part.text
                        if hasattr(part, "inline_data") and part.inline_data:
                            inline = part.inline_data
                            if hasattr(inline, "data") and inline.data:
                                actual_mime = _detect_image_mime_type(inline.data)
                                images.append({
                                    "data": base64.b64encode(inline.data).decode("utf-8"),
                                    "mime_type": actual_mime,
                                })

        usage = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, "prompt_token_count", None),
                "completion_tokens": getattr(response.usage_metadata, "candidates_token_count", None),
                "total_tokens": getattr(response.usage_metadata, "total_token_count", None),
            }

        print(f"[OK] Generated {len(images)} image(s) in {elapsed:.1f}s")

        # Log image generation response
        logger.info(f"Image generation response: images={len(images)}, elapsed={elapsed:.1f}s, usage={usage}")
        if text:
            logger.debug(f"Image response text: {text[:200]}{'...' if len(text) > 200 else ''}")

        return ImageResult(
            text=text,
            images=images,
            model=model_name,
            usage=usage,
        )

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        google_search: bool = False,
    ) -> TextResult:
        """Generate text, optionally grounded with Google Search.

        Args:
            prompt: The input prompt
            system_prompt: Optional system instructions
            google_search: If True, enable Google Search grounding

        Returns:
            TextResult with text and optional grounding sources
        """
        model_name = self.DEFAULT_TEXT_MODEL
        start_time = time.time()

        search_label = " (with search)" if google_search else ""
        print(f"[{model_name}] Generating text{search_label}...")

        # Log the request details
        logger.info(f"Text generation request: model={model_name}, prompt_len={len(prompt)}, google_search={google_search}")
        logger.debug(f"Text prompt preview: {prompt[:500]}{'...' if len(prompt) > 500 else ''}")

        # Build config
        config_kwargs: dict[str, Any] = {}
        if google_search:
            config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        if system_prompt:
            config_kwargs["system_instruction"] = system_prompt

        config = types.GenerateContentConfig(**config_kwargs) if config_kwargs else None

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
        except Exception as e:
            elapsed = time.time() - start_time
            # Log detailed error information
            error_msg = str(e)
            error_type = type(e).__name__
            print(f"[ERROR] Text generation failed after {elapsed:.1f}s")
            print(f"  Error Type: {error_type}")
            print(f"  Error Message: {error_msg}")
            if hasattr(e, 'status_code'):
                print(f"  Status Code: {e.status_code}")
            if hasattr(e, 'reason'):
                print(f"  Reason: {e.reason}")
            raise

        elapsed = time.time() - start_time

        # Extract text response
        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        # Extract grounding metadata (only present when google_search=True)
        grounding_sources = []
        search_queries = []

        if google_search and response.candidates:
            for candidate in response.candidates:
                grounding_meta = getattr(candidate, "grounding_metadata", None)
                if grounding_meta:
                    if hasattr(grounding_meta, "web_search_queries"):
                        search_queries = list(grounding_meta.web_search_queries or [])

                    if hasattr(grounding_meta, "grounding_chunks"):
                        for chunk in grounding_meta.grounding_chunks or []:
                            if hasattr(chunk, "web") and chunk.web:
                                grounding_sources.append({
                                    "uri": getattr(chunk.web, "uri", None),
                                    "title": getattr(chunk.web, "title", None),
                                })

        # Extract usage
        usage = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, "prompt_token_count", None),
                "completion_tokens": getattr(response.usage_metadata, "candidates_token_count", None),
                "total_tokens": getattr(response.usage_metadata, "total_token_count", None),
            }

        src_info = f", {len(grounding_sources)} sources" if google_search else ""
        print(f"[OK] Generated in {elapsed:.1f}s ({len(text)} chars{src_info})")

        # Log response details
        logger.info(f"Text generation response: len={len(text)}, elapsed={elapsed:.1f}s, usage={usage}")
        logger.debug(f"Text response preview: {text[:500]}{'...' if len(text) > 500 else ''}")

        return TextResult(
            text=text,
            grounding_sources=grounding_sources,
            search_queries=search_queries,
            model=model_name,
            usage=usage,
        )

    async def generate_prompt_variations_stream(
        self,
        base_prompt: str,
        count: int,
        context_images: list[tuple[bytes, str, str | None]] | None = None,
        context_image_pool: list[tuple[str, bytes, str, str | None, dict | None]] | None = None,
        title: str | None = None,
        prompt_template: str | None = None,
    ):
        """Stream prompt variation generation with progress updates.

        Yields dicts with either:
        - {"type": "chunk", "text": "partial text..."}
        - {"type": "complete", "title": str, "scenes": [...], "annotation_suggestions": [...]}
        - {"type": "error", "error": str}
        """
        model_name = self.DEFAULT_TEXT_MODEL
        start_time = time.time()

        # Support both old and new API
        has_pool = context_image_pool is not None and len(context_image_pool) > 0
        has_legacy = context_images is not None and len(context_images) > 0
        num_images = len(context_image_pool) if has_pool else (len(context_images) if has_legacy else 0)

        title_info = f", title='{title}'" if title else ", no title"
        logger.info(f"[STREAMING] Generating {count} structured prompt variations for: {base_prompt[:100]}... (with {num_images} context images{title_info})")

        # Load prompt template from file if not provided
        if prompt_template is None:
            prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
            prompt_file = os.path.join(prompts_dir, "variation_structured.txt")
            with open(prompt_file, "r") as f:
                prompt_template = f.read()

        # Build title context
        title_context = ""
        if title:
            title_context = f'USER-PROVIDED TITLE: "{title}"\nUse this title as context for your variations. You may refine it or use it as-is for the output title.'

        # Build context assignment section if image pool is provided
        context_assignment_section = ""
        if has_pool:
            context_assignment_section = f"""
CONTEXT IMAGE POOL:
You have access to {len(context_image_pool)} reference images (shown below with their IDs and captions).

For EACH variation you generate:
1. Select which images from the pool would be most helpful as generation context
2. Consider: Does the image's mood, style, composition, or color palette align with THIS variation?
3. Assign 0-3 images per variation via the recommended_context_ids field
4. Explain your reasoning in context_reasoning

Different variations may use different images - match context to each variation's specific needs.

If any image's caption is inadequate for generation context, suggest improvements in caption_suggestions.
"""
        elif has_legacy:
            context_assignment_section = "\n\nCONTEXT IMAGES:\nThe following reference images have been provided by the user. Use them to understand the visual direction, style, mood, and subject matter the user is interested in.\n"

        # Format the prompt with all placeholders
        format_values = {
            "base_prompt": base_prompt,
            "count": count,
            "title_context": title_context,
            "context_assignment_section": context_assignment_section,
        }
        class SafeDict(dict):
            def __missing__(self, key):
                return ""
        prompt = prompt_template.format_map(SafeDict(format_values))

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SceneVariationsResponse,
        )

        # Build interleaved contents with images
        if has_pool:
            contents = []
            contents.append(prompt)
            for pool_item in context_image_pool:
                # Handle both old (5-tuple) and new (6-tuple) formats
                if len(pool_item) == 6:
                    img_id, img_bytes, mime_type, caption, confirmed_dims, liked_dim_axes = pool_item
                else:
                    img_id, img_bytes, mime_type, caption, confirmed_dims = pool_item
                    liked_dim_axes = None

                contents.append(f"\n\nImage ID: {img_id}")
                contents.append(f"Annotation: {caption or '(none)'}")
                # Include confirmed design dimensions if available
                if confirmed_dims:
                    dims_text = []
                    for axis, dim in confirmed_dims.items():
                        dim_name = dim.get("name", "")
                        dim_desc = dim.get("description", "")
                        dim_tags = dim.get("tags", [])
                        tags_str = ", ".join(dim_tags) if dim_tags else ""
                        dims_text.append(f"  - {axis}: \"{dim_name}\" - {dim_desc} [tags: {tags_str}]")
                    if dims_text:
                        contents.append(f"Design Qualities:\n" + "\n".join(dims_text))
                # Include user's liked dimensions - important for understanding their preferences
                if liked_dim_axes:
                    contents.append(f"User's Preferred Dimensions: {', '.join(liked_dim_axes)}")
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
        elif has_legacy:
            contents = []
            contents.append(prompt)
            for i, (img_bytes, mime_type, caption) in enumerate(context_images):
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                if caption:
                    contents.append(f"Reference {i+1} caption: {caption}")
                else:
                    contents.append(f"Reference {i+1}: (no caption provided)")
        else:
            contents = prompt

        try:
            # Use streaming API - await the method first, then async iterate
            accumulated_text = ""
            stream = await self.client.aio.models.generate_content_stream(
                model=model_name,
                contents=contents,
                config=config,
            )
            async for chunk in stream:
                # Extract text from chunk
                if chunk.candidates:
                    for candidate in chunk.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "text") and part.text:
                                    accumulated_text += part.text
                                    yield {"type": "chunk", "text": part.text}

            elapsed = time.time() - start_time

            # Parse the complete structured response
            result = SceneVariationsResponse.model_validate_json(accumulated_text)

            logger.info(f"[STREAMING] Completed: title='{result.title}', {len(result.scenes)} scenes in {elapsed:.1f}s")

            yield {
                "type": "complete",
                "title": result.title,
                "scenes": [scene.model_dump() for scene in result.scenes],
                "annotation_suggestions": [s.model_dump() for s in result.annotation_suggestions] if result.annotation_suggestions else None,
            }

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[STREAMING] Failed after {elapsed:.1f}s: {e}")
            yield {"type": "error", "error": str(e)}

    async def generate_prompt_variations(
        self,
        base_prompt: str,
        count: int,
        context_images: list[tuple[bytes, str, str | None]] | None = None,
        context_image_pool: list[tuple[str, bytes, str, str | None, dict | None]] | None = None,
        title: str | None = None,
        prompt_template: str | None = None,
    ) -> tuple[str, list[SceneVariation], list[AnnotationSuggestion] | None]:
        """Generate varied prompt descriptions using structured JSON output.

        Uses Gemini's structured output feature to guarantee valid JSON responses.

        Args:
            base_prompt: User's original prompt
            count: Number of variations to generate
            context_images: DEPRECATED - use context_image_pool instead.
                           Optional list of (image_bytes, mime_type, caption) tuples.
            context_image_pool: Optional list of (image_id, image_bytes, mime_type, caption, confirmed_dims) tuples.
                               When provided, model assigns specific images to each variation
                               via recommended_context_ids field. confirmed_dims contains design
                               dimensions with confirmed=True.
            title: Optional user-provided title. If provided, used as context for variations.
                   Model always returns a title (generated or refined from user's).
            prompt_template: Optional custom prompt template with {base_prompt}, {count},
                           {title_context}, and {context_assignment_section} placeholders.
                           If not provided, loads from prompts/variation_structured.txt

        Returns:
            Tuple of (title, list of SceneVariation objects, optional annotation suggestions)
        """
        model_name = self.DEFAULT_TEXT_MODEL
        start_time = time.time()

        # Support both old and new API
        has_pool = context_image_pool is not None and len(context_image_pool) > 0
        has_legacy = context_images is not None and len(context_images) > 0
        num_images = len(context_image_pool) if has_pool else (len(context_images) if has_legacy else 0)

        title_info = f", title='{title}'" if title else ", no title"
        logger.info(f"Generating {count} structured prompt variations for: {base_prompt[:100]}... (with {num_images} context images{title_info})")

        # Load prompt template from file if not provided
        if prompt_template is None:
            prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
            prompt_file = os.path.join(prompts_dir, "variation_structured.txt")
            with open(prompt_file, "r") as f:
                prompt_template = f.read()

        # Build title context
        title_context = ""
        if title:
            title_context = f'USER-PROVIDED TITLE: "{title}"\nUse this title as context for your variations. You may refine it or use it as-is for the output title.'

        # Build context assignment section if image pool is provided
        context_assignment_section = ""
        if has_pool:
            context_assignment_section = f"""
CONTEXT IMAGE POOL:
You have access to {len(context_image_pool)} reference images (shown below with their IDs and captions).

For EACH variation you generate:
1. Select which images from the pool would be most helpful as generation context
2. Consider: Does the image's mood, style, composition, or color palette align with THIS variation?
3. Assign 0-3 images per variation via the recommended_context_ids field
4. Explain your reasoning in context_reasoning

Different variations may use different images - match context to each variation's specific needs.

If any image's caption is inadequate for generation context, suggest improvements in caption_suggestions.
"""
        elif has_legacy:
            # Legacy mode: just show context images without per-variation assignment
            context_assignment_section = "\n\nCONTEXT IMAGES:\nThe following reference images have been provided by the user. Use them to understand the visual direction, style, mood, and subject matter the user is interested in.\n"

        # Format the prompt with all placeholders (use format_map to handle missing keys gracefully)
        format_values = {
            "base_prompt": base_prompt,
            "count": count,
            "title_context": title_context,
            "context_assignment_section": context_assignment_section,
        }
        # Use a defaultdict-like approach: missing keys return empty string
        class SafeDict(dict):
            def __missing__(self, key):
                return ""
        prompt = prompt_template.format_map(SafeDict(format_values))

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SceneVariationsResponse,
        )

        # Build interleaved contents with images
        if has_pool:
            contents = []
            contents.append(prompt)
            # Add each image with its ID, caption, and design dimensions
            for pool_item in context_image_pool:
                # Handle both old (5-tuple) and new (6-tuple) formats
                if len(pool_item) == 6:
                    img_id, img_bytes, mime_type, caption, confirmed_dims, liked_dim_axes = pool_item
                else:
                    img_id, img_bytes, mime_type, caption, confirmed_dims = pool_item
                    liked_dim_axes = None

                contents.append(f"\n\nImage ID: {img_id}")
                contents.append(f"Annotation: {caption or '(none)'}")
                # Include confirmed design dimensions if available
                if confirmed_dims:
                    dims_text = []
                    for axis, dim in confirmed_dims.items():
                        dim_name = dim.get("name", "")
                        dim_desc = dim.get("description", "")
                        dim_tags = dim.get("tags", [])
                        tags_str = ", ".join(dim_tags) if dim_tags else ""
                        dims_text.append(f"  - {axis}: \"{dim_name}\" - {dim_desc} [tags: {tags_str}]")
                    if dims_text:
                        contents.append(f"Design Qualities:\n" + "\n".join(dims_text))
                # Include user's liked dimensions - important for understanding their preferences
                if liked_dim_axes:
                    contents.append(f"User's Preferred Dimensions: {', '.join(liked_dim_axes)}")
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
        elif has_legacy:
            # Legacy mode
            contents = []
            contents.append(prompt)
            for i, (img_bytes, mime_type, caption) in enumerate(context_images):
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                if caption:
                    contents.append(f"Reference {i+1} caption: {caption}")
                else:
                    contents.append(f"Reference {i+1}: (no caption provided)")
        else:
            contents = prompt

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )

            elapsed = time.time() - start_time

            # Parse the structured response
            result = SceneVariationsResponse.model_validate_json(response.text)

            logger.info(f"Structured variations response: title='{result.title}', {len(result.scenes)} scenes in {elapsed:.1f}s")
            for i, scene in enumerate(result.scenes):
                context_ids = scene.recommended_context_ids if scene.recommended_context_ids else []
                logger.debug(f"Scene {i+1}: type={scene.type}, mood={scene.mood}, context_ids={context_ids}, desc={scene.description[:50]}...")

            return result.title, result.scenes, result.annotation_suggestions

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Structured variation generation failed after {elapsed:.1f}s: {e}")
            raise

    async def polish_prompts(
        self,
        base_prompt: str,
        variations: list[dict],
        context_images: list[tuple[bytes, str, str | None]] | None = None,
    ) -> list[PolishedVariation]:
        """Polish and refine prompt variations based on user notes and emphasized tags.

        Args:
            base_prompt: The original user prompt
            variations: List of variations with id, text, user_notes, mood, design, emphasized_tags
            context_images: Optional list of (bytes, mime_type, caption) for visual context

        Returns:
            List of PolishedVariation with refined prompt text
        """
        start_time = time.time()
        model_name = self.DEFAULT_FAST_TEXT_MODEL

        logger.info(f"Polishing {len(variations)} variations using {model_name}")

        # Load prompt template
        prompt_template = self._load_prompt("polish_prompts")

        # Build variations section
        variations_section = "VARIATIONS TO POLISH:\n"
        for v in variations:
            variations_section += f"\n---\nVariation ID: {v['id']}\n"
            variations_section += f"Current text: {v['text']}\n"
            if v.get('user_notes'):
                variations_section += f"User notes: {v['user_notes']}\n"
            if v.get('mood'):
                variations_section += f"Mood: {v['mood']}\n"
            if v.get('emphasized_tags'):
                variations_section += f"EMPHASIZED TAGS (lean into these): {', '.join(v['emphasized_tags'])}\n"
            if v.get('design'):
                design_str = ", ".join(
                    f"{axis}: {', '.join(tags)}"
                    for axis, tags in v['design'].items()
                    if tags
                )
                if design_str:
                    variations_section += f"Design tags: {design_str}\n"

        # Format prompt
        prompt = prompt_template.format(
            base_prompt=base_prompt,
            variations_section=variations_section,
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PolishPromptsResponse,
        )

        # Build contents with optional context images
        if context_images:
            contents = []
            contents.append(prompt)
            for img_bytes, mime_type, caption in context_images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                if caption:
                    contents.append(f"Context image caption: {caption}")
        else:
            contents = prompt

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )

            elapsed = time.time() - start_time
            result = PolishPromptsResponse.model_validate_json(response.text)

            logger.info(f"Polished {len(result.polished_variations)} variations in {elapsed:.1f}s")
            return result.polished_variations

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Polish prompts failed after {elapsed:.1f}s: {e}")
            raise

    async def annotate_design_dimensions(
        self,
        image_bytes: bytes,
        image_mime_type: str = "image/jpeg",
    ) -> DesignAnnotation:
        """Analyze an image along design dimensions for preference learning.

        Note: Uses manual JSON parsing (not structured output) because the
        response schema is dynamic - axes are not fixed ahead of time.

        Args:
            image_bytes: Raw image bytes
            image_mime_type: MIME type of the image

        Returns:
            DesignAnnotation with detected values for each axis
        """
        import json
        import re

        prompt = self._load_prompt("design_dimensions")
        model_name = self.DEFAULT_TEXT_MODEL
        start_time = time.time()

        logger.info(f"[annotate_design_dimensions] Starting with model={model_name}")

        config = types.GenerateContentConfig(
            system_instruction="You are a design analyst. Return only valid JSON, no markdown formatting.",
        )

        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=image_mime_type),
            prompt,
        ]

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[annotate_design_dimensions] Failed after {elapsed:.1f}s: {e}")
            raise

        elapsed = time.time() - start_time

        # Extract text response
        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        logger.info(f"[annotate_design_dimensions] Completed in {elapsed:.1f}s")

        # Parse JSON response (dynamic schema - can't use structured output)
        try:
            clean_text = text.strip()
            if clean_text.startswith("```"):
                clean_text = re.sub(r"^```(?:json)?\n?", "", clean_text)
                clean_text = re.sub(r"\n?```$", "", clean_text)

            data = json.loads(clean_text)
            axes = {k: v for k, v in data.items() if isinstance(v, list)}
            return DesignAnnotation(axes=axes, raw_response=text)
        except json.JSONDecodeError as e:
            logger.warning(f"[annotate_design_dimensions] JSON parse failed: {e}")
            return DesignAnnotation(axes={}, raw_response=text)

    async def analyze_dimensions(
        self,
        image_bytes: bytes,
        count: int = 5,
    ) -> list[dict]:
        """Analyze an image and suggest design dimensions.

        Args:
            image_bytes: Image data as bytes
            count: Number of dimensions to suggest (default 5)

        Returns:
            List of design dimension dicts with keys:
            - axis: Design axis category
            - name: Evocative name
            - description: Detailed analysis
            - tags: Design vocabulary tags
            - generation_prompt: Prompt for concept generation
        """
        # Load prompt template
        try:
            from backend.config import load_prompt
        except ImportError:
            from config import load_prompt

        prompt_template = load_prompt("dimension_analysis")
        prompt = prompt_template.format(count=count)

        # Detect MIME type
        mime_type = _detect_image_mime_type(image_bytes)

        start_time = time.time()
        print(f"[→] Analyzing {count} design dimensions...")

        try:
            response = self.client.models.generate_content(
                model=self.DEFAULT_FAST_TEXT_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    types.Part.from_text(text=prompt),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DimensionAnalysisResponse,
                    temperature=0.7,
                ),
            )
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[ERROR] Dimension analysis failed after {elapsed:.1f}s: {e}")
            raise

        elapsed = time.time() - start_time
        print(f"[OK] Analyzed dimensions in {elapsed:.1f}s")

        # Extract text response
        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        # Parse JSON response
        try:
            data = json.loads(text)
            dimensions = data.get("dimensions", [])
            return dimensions
        except json.JSONDecodeError as e:
            print(f"[WARN] Failed to parse dimension analysis JSON: {e}")
            return []

    async def suggest_dimensions_multi(
        self,
        images: list[tuple[bytes, str]],  # List of (image_bytes, mime_type)
        count: int = 5,
    ) -> list[dict]:
        """Analyze multiple images and suggest common design dimensions.

        Uses Flash model for speed. Finds dimensions that are COMMON across
        all provided images, making them good candidates for Design Tokens.

        Args:
            images: List of (image_bytes, mime_type) tuples
            count: Number of dimensions to suggest (default 5)

        Returns:
            List of design dimension dicts with keys:
            - axis: Design axis category
            - name: Evocative name
            - description: Detailed analysis
            - tags: Design vocabulary tags
            - generation_prompt: Prompt for concept generation
            - commonality: What makes this dimension common across images
        """
        if not images:
            return []

        start_time = time.time()
        num_images = len(images)
        logger.info(f"[suggest_dimensions_multi] Suggesting {count} common dimensions from {num_images} images")

        # Load and format prompt
        prompt = self._load_prompt("suggest_dimensions_multi").format(
            num_images=num_images,
            count=count,
        )

        # Build content parts
        content_parts = []
        for img_bytes, mime_type in images:
            content_parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
        content_parts.append(types.Part.from_text(text=prompt))

        try:
            response = self.client.models.generate_content(
                model=self.DEFAULT_FAST_TEXT_MODEL,  # Flash for speed
                contents=content_parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=MultiImageDimensionResponse,
                    temperature=0.7,
                ),
            )
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[suggest_dimensions_multi] Failed after {elapsed:.1f}s: {e}")
            raise

        elapsed = time.time() - start_time
        logger.info(f"[suggest_dimensions_multi] Completed in {elapsed:.1f}s")

        # Extract text response
        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        # Parse JSON response
        try:
            data = json.loads(text)
            dimensions = data.get("dimensions", [])
            return dimensions
        except json.JSONDecodeError as e:
            logger.warning(f"[suggest_dimensions_multi] JSON parse failed: {e}")
            return []

    async def generate_concept_image(
        self,
        dimension: dict,
        aspect_ratio: str = "1:1",
        source_image_bytes: bytes | None = None,
        source_image_mime_type: str = "image/jpeg",
    ) -> ImageResult:
        """Generate a pure concept image for a design dimension.

        Args:
            dimension: Design dimension dict with name, axis, description, generation_prompt
            aspect_ratio: Output aspect ratio
            source_image_bytes: Optional source image to reference when generating concept
            source_image_mime_type: MIME type of source image

        Returns:
            ImageResult with generated concept image
        """
        # Load prompt template
        try:
            from backend.config import load_prompt
        except ImportError:
            from config import load_prompt

        prompt_template = load_prompt("concept_generation")
        prompt = prompt_template.format(
            dimension_name=dimension.get("name", ""),
            axis=dimension.get("axis", ""),
            description=dimension.get("description", ""),
            generation_prompt=dimension.get("generation_prompt", ""),
        )

        start_time = time.time()
        print(f"[→] Generating concept image for '{dimension.get('name', 'unknown')}'...")

        # If source image provided, use it as context for the generation
        context_images = None
        if source_image_bytes:
            context_images = [(source_image_bytes, source_image_mime_type, "Source image to extract design dimension from")]

        return await self.generate_image(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            context_images=context_images,
        )

    async def extract_design_token(
        self,
        image_bytes: bytes,
        image_mime_type: str,
        annotation: str | None = None,
        liked_tags: list[str] | None = None,
    ) -> DesignTokenExtraction:
        """Extract a reusable design token from an image based on user preferences.

        Uses the user's annotation and liked tags to understand what they appreciate
        about the image, then generates a condensed prompt fragment for the Design Library.

        Args:
            image_bytes: Raw image bytes
            image_mime_type: MIME type of the image
            annotation: User's annotation describing what they like about the image
            liked_tags: List of design tags the user has liked on this image

        Returns:
            DesignTokenExtraction with name, text (prompt fragment), style_tags, and category
        """
        # Build user context
        user_context = ""
        if annotation:
            user_context += f"USER'S ANNOTATION: {annotation}\n"
        if liked_tags:
            user_context += f"LIKED DESIGN TAGS: {', '.join(liked_tags)}\n"

        prompt = self._load_prompt("design_token_extraction").format(
            user_context=user_context
        )

        return await self._generate_structured(
            prompt=prompt,
            response_schema=DesignTokenExtraction,
            model=self.DEFAULT_FAST_TEXT_MODEL,
            images=[(image_bytes, image_mime_type, None)],
            operation_name="extract_design_token",
        )
