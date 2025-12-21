"""Gemini API service for image generation - simplified from Reverie."""

import base64
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Literal, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Configure module logger
logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# ============================================================
# Pydantic Models for Structured Output
# ============================================================

class DesignTags(BaseModel):
    """Design attributes for a scene variation."""
    colors: list[str] = Field(default_factory=list, description="Color palette tags like 'warm', 'vibrant', 'high-contrast'")
    composition: list[str] = Field(default_factory=list, description="Composition tags like 'centered', 'rule-of-thirds', 'wide-angle'")
    layout: list[str] = Field(default_factory=list, description="Layout tags like 'spacious', 'dense', 'balanced'")
    aesthetic: list[str] = Field(default_factory=list, description="Style tags like 'minimalist', 'photorealistic', 'illustrated'")


class DesignDimensionOutput(BaseModel):
    """A single design dimension extracted from an image (for structured output)."""
    axis: str = Field(description="Design axis category like 'lighting', 'mood', 'colors'")
    name: str = Field(description="Evocative 2-4 word name like 'Eerie Green Cast'")
    description: str = Field(description="2-3 sentence analysis of how this dimension manifests")
    tags: list[str] = Field(description="2-3 design vocabulary tags")
    generation_prompt: str = Field(description="Prompt for generating pure concept image")


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
    elif len(data) > 12 and data[4:8] == b'ftyp':
        # HEIC/HEIF container (ISO Base Media File Format)
        brand = data[8:12]
        if brand in (b'heic', b'heix', b'hevc', b'hevx', b'mif1', b'msf1'):
            return "image/heic"
        elif brand in (b'avif', b'avis'):
            return "image/avif"
    return "image/png"


def _convert_heic_to_jpeg(data: bytes) -> tuple[bytes, str]:
    """Convert HEIC/HEIF image to JPEG for Gemini API compatibility.

    Gemini API docs claim HEIC support but it's unreliable in practice.
    See: https://discuss.ai.google.dev/t/heic-image-supported-or-not-docs-say-yes-but-they-dont-work/55146

    Returns:
        Tuple of (image_bytes, mime_type)
    """
    import io
    try:
        # pillow-heif registers itself with PIL on import
        import pillow_heif
        pillow_heif.register_heif_opener()
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        # Convert to RGB if necessary (HEIC may have alpha)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        output = io.BytesIO()
        img.save(output, format='JPEG', quality=92)
        return output.getvalue(), "image/jpeg"
    except Exception as e:
        logger.warning(f"Failed to convert HEIC to JPEG: {e}, using original")
        return data, "image/heic"


def _normalize_image_for_gemini(data: bytes, mime_type: str) -> tuple[bytes, str]:
    """Normalize image format for Gemini API compatibility.

    Converts HEIC/HEIF/AVIF to JPEG since Gemini's support is unreliable.

    Returns:
        Tuple of (image_bytes, mime_type)
    """
    if mime_type in ("image/heic", "image/heif", "image/avif"):
        return _convert_heic_to_jpeg(data)
    return data, mime_type


@dataclass
class ImageResult:
    """Image generation result."""
    text: str | None
    images: list[dict[str, Any]] = field(default_factory=list)
    model: str = ""
    usage: dict[str, Any] | None = None


class GeminiService:
    """Service for Gemini image and text generation."""

    def __init__(self, api_key: str | None = None):
        # Import config with fallback for different import contexts
        # - 'backend.config' when running as package (uvicorn backend.server:app)
        # - 'config' when running directly or in tests
        try:
            from backend.config import DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_FAST_TEXT_MODEL, GEMINI_TIMEOUT_MS, get_gemini_api_key
        except ImportError:
            from config import DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_FAST_TEXT_MODEL, GEMINI_TIMEOUT_MS, get_gemini_api_key

        self.DEFAULT_TEXT_MODEL = DEFAULT_TEXT_MODEL
        self.DEFAULT_IMAGE_MODEL = DEFAULT_IMAGE_MODEL
        self.DEFAULT_FAST_TEXT_MODEL = DEFAULT_FAST_TEXT_MODEL

        self.api_key = api_key or get_gemini_api_key()

        # Configure HTTP options with extended timeout and retry for image generation
        # Image generation can take longer and may hit rate limits
        http_options = types.HttpOptions(
            timeout=GEMINI_TIMEOUT_MS,
            retry_options=types.HttpRetryOptions(
                attempts=3,  # Retry failed requests up to 3 times
            ),
        )
        self.client = genai.Client(api_key=self.api_key, http_options=http_options)

    async def _generate_structured(
        self,
        *,
        prompt: str | None = None,
        contents: list[Any] | None = None,
        response_schema: type[T],
        model: str | None = None,
        images: list[tuple[bytes, str, str | None]] | None = None,
        system_instruction: str | None = None,
        operation_name: str = "generation",
        temperature: float | None = None,
    ) -> T:
        """Unified structured JSON generation with image interleaving.

        Args:
            prompt: Simple text prompt (mutually exclusive with contents)
            contents: Pre-built contents list with interleaved images (mutually exclusive with prompt)
            response_schema: Pydantic model class for structured output
            model: Model to use (defaults to DEFAULT_TEXT_MODEL)
            images: Optional list of (bytes, mime_type, label) tuples to interleave (only with prompt)
            system_instruction: Optional system instruction
            operation_name: Name for logging
            temperature: Optional temperature setting

        Returns:
            Parsed Pydantic model instance
        """
        if contents is not None and prompt is not None:
            raise ValueError("Provide either 'prompt' or 'contents', not both")
        if contents is None and prompt is None:
            raise ValueError("Must provide either 'prompt' or 'contents'")

        model_name = model or self.DEFAULT_TEXT_MODEL
        start_time = time.time()

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

        # Build contents: use pre-built contents, or build from prompt + images
        if contents is not None:
            final_contents = contents
            num_images = sum(1 for c in contents if hasattr(c, 'inline_data') or (hasattr(c, 'data') and hasattr(c, 'mime_type')))
        elif images:
            final_contents: list[Any] = [prompt]
            for img_bytes, mime_type, label in images:
                if label:
                    final_contents.append(f"\n{label}:")
                # Normalize HEIC/HEIF to JPEG for Gemini compatibility
                norm_bytes, norm_mime = _normalize_image_for_gemini(img_bytes, mime_type)
                final_contents.append(types.Part.from_bytes(data=norm_bytes, mime_type=norm_mime))
            num_images = len(images)
        else:
            final_contents = prompt
            num_images = 0

        logger.info(f"[{operation_name}] Starting with model={model_name}, images={num_images}")

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=final_contents,
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
                # Normalize HEIC/HEIF to JPEG for Gemini compatibility
                norm_bytes, norm_mime = _normalize_image_for_gemini(img_bytes, mime_type)
                contents.append(types.Part.from_bytes(data=norm_bytes, mime_type=norm_mime))
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

    def _build_variation_contents(
        self,
        prompt: str,
        context_images: list[tuple[bytes, str, str | None]] | None = None,
        context_image_pool: list[tuple[str, bytes, str, str | None, dict | None]] | None = None,
    ) -> list[Any] | str:
        """Build contents list with interleaved images for variation generation.

        Args:
            prompt: The formatted prompt string
            context_images: Legacy format - list of (bytes, mime_type, caption)
            context_image_pool: New format - list of (id, bytes, mime_type, caption, dims, [liked_axes])

        Returns:
            Contents list with interleaved images, or just the prompt string if no images
        """
        has_pool = context_image_pool is not None and len(context_image_pool) > 0
        has_legacy = context_images is not None and len(context_images) > 0

        if has_pool:
            contents: list[Any] = [prompt]
            for pool_item in context_image_pool:
                # Handle both old (5-tuple) and new (6-tuple) formats
                if len(pool_item) == 6:
                    img_id, img_bytes, mime_type, caption, confirmed_dims, liked_dim_axes = pool_item
                else:
                    img_id, img_bytes, mime_type, caption, confirmed_dims = pool_item
                    liked_dim_axes = None

                contents.append(f"\n\nImage ID: {img_id}")
                contents.append(f"Annotation: {caption or '(none)'}")
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
                if liked_dim_axes:
                    contents.append(f"User's Preferred Dimensions: {', '.join(liked_dim_axes)}")
                # Normalize HEIC/HEIF to JPEG for Gemini compatibility
                norm_bytes, norm_mime = _normalize_image_for_gemini(img_bytes, mime_type)
                contents.append(types.Part.from_bytes(data=norm_bytes, mime_type=norm_mime))
            return contents
        elif has_legacy:
            contents = [prompt]
            for i, (img_bytes, mime_type, caption) in enumerate(context_images):
                # Normalize HEIC/HEIF to JPEG for Gemini compatibility
                norm_bytes, norm_mime = _normalize_image_for_gemini(img_bytes, mime_type)
                contents.append(types.Part.from_bytes(data=norm_bytes, mime_type=norm_mime))
                if caption:
                    contents.append(f"Reference {i+1} caption: {caption}")
                else:
                    contents.append(f"Reference {i+1}: (no caption provided)")
            return contents
        else:
            return prompt

    async def generate_prompt_variations_stream(
        self,
        prompt: str,
        count: int,
        context_images: list[tuple[bytes, str, str | None]] | None = None,
        context_image_pool: list[tuple[str, bytes, str, str | None, dict | None]] | None = None,
    ):
        """Stream prompt variation generation with progress updates.

        Args:
            prompt: Complete prompt from frontend (includes template + user input)
            count: Number of variations requested (for logging)
            context_images: DEPRECATED - use context_image_pool instead
            context_image_pool: Optional context images with IDs

        Yields dicts with either:
        - {"type": "chunk", "text": "partial text..."}
        - {"type": "complete", "title": str, "scenes": [...], "annotation_suggestions": [...]}
        - {"type": "error", "error": str}
        """
        start_time = time.time()

        # Determine image counts for logging
        has_pool = context_image_pool is not None and len(context_image_pool) > 0
        has_legacy = context_images is not None and len(context_images) > 0
        num_images = len(context_image_pool) if has_pool else (len(context_images) if has_legacy else 0)

        # Build contents with images (prompt is already complete from frontend)
        contents = self._build_variation_contents(prompt, context_images, context_image_pool)

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SceneVariationsResponse,
        )

        logger.info(f"[STREAMING] Generating {count} variations ({num_images} context images)")

        try:
            accumulated_text = ""
            stream = await self.client.aio.models.generate_content_stream(
                model=self.DEFAULT_TEXT_MODEL,
                contents=contents,
                config=config,
            )
            async for chunk in stream:
                if chunk.candidates:
                    for candidate in chunk.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "text") and part.text:
                                    accumulated_text += part.text
                                    yield {"type": "chunk", "text": part.text}

            elapsed = time.time() - start_time
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
        prompt: str,
        count: int,
        context_images: list[tuple[bytes, str, str | None]] | None = None,
        context_image_pool: list[tuple[str, bytes, str, str | None, dict | None]] | None = None,
    ) -> tuple[str, list[SceneVariation], list[AnnotationSuggestion] | None]:
        """Generate varied prompt descriptions using structured JSON output.

        Args:
            prompt: Complete prompt from frontend (includes template + user input)
            count: Number of variations to generate (for logging)
            context_images: DEPRECATED - use context_image_pool instead
            context_image_pool: Optional context images with IDs

        Returns:
            Tuple of (title, list of SceneVariation objects, optional annotation suggestions)
        """
        # Determine image counts for logging
        has_pool = context_image_pool is not None and len(context_image_pool) > 0
        has_legacy = context_images is not None and len(context_images) > 0
        num_images = len(context_image_pool) if has_pool else (len(context_images) if has_legacy else 0)

        # Build contents with images (prompt is already complete from frontend)
        contents = self._build_variation_contents(prompt, context_images, context_image_pool)

        # Use _generate_structured for consistent handling
        result = await self._generate_structured(
            contents=contents if isinstance(contents, list) else None,
            prompt=contents if isinstance(contents, str) else None,
            response_schema=SceneVariationsResponse,
            operation_name=f"variations({count}, {num_images} images)",
        )

        return result.title, result.scenes, result.annotation_suggestions

    async def generate_concept_image(
        self,
        prompt: str,
        aspect_ratio: str = "1:1",
        source_image_bytes: bytes | None = None,
        source_image_mime_type: str = "image/jpeg",
    ) -> ImageResult:
        """Generate a pure concept image for a design dimension.

        Args:
            prompt: Complete prompt from frontend (includes template + dimension data)
            aspect_ratio: Output aspect ratio
            source_image_bytes: Optional source image to reference when generating concept
            source_image_mime_type: MIME type of source image

        Returns:
            ImageResult with generated concept image
        """
        start_time = time.time()
        print(f"[→] Generating concept image...")

        # If source image provided, use it as context for the generation
        context_images = None
        if source_image_bytes:
            context_images = [(source_image_bytes, source_image_mime_type, "Source image to extract design dimension from")]

        return await self.generate_image(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            context_images=context_images,
        )


