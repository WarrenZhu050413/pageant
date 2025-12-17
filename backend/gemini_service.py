"""Gemini API service for image generation - simplified from Reverie."""

import base64
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

from google import genai
from google.genai import types

# Configure module logger
logger = logging.getLogger(__name__)


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

    DEFAULT_TEXT_MODEL = "gemini-3-pro-preview"
    DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not provided")
        self.client = genai.Client(api_key=self.api_key)

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
            thinking_level: Reasoning depth - "low" or "high" (Nano Banana specific)
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
        if thinking_level:
            config_kwargs["thinking_level"] = thinking_level
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

    async def generate_prompt_variations(
        self,
        base_prompt: str,
        count: int,
        system_prompt: str,
    ) -> str:
        """Generate varied prompt descriptions using text model.

        Args:
            base_prompt: User's original prompt
            count: Number of variations to generate
            system_prompt: System prompt template with {base_prompt} and {count} placeholders

        Returns:
            Raw XML response from the model (to be parsed by caller)
        """
        logger.info(f"Generating {count} prompt variations for: {base_prompt[:100]}...")
        logger.debug(f"System prompt template length: {len(system_prompt)} chars")

        formatted_prompt = system_prompt.format(
            base_prompt=base_prompt,
            count=count,
        )

        logger.debug(f"Formatted prompt length: {len(formatted_prompt)} chars")
        result = await self.generate_text(formatted_prompt)

        logger.info(f"Prompt variations response: {len(result.text)} chars")
        logger.debug(f"Raw variations response: {result.text[:300]}...")

        return result.text

    async def annotate_design_dimensions(
        self,
        image_bytes: bytes,
        image_mime_type: str = "image/jpeg",
    ) -> DesignAnnotation:
        """Analyze an image along design dimensions for preference learning.

        Args:
            image_bytes: Raw image bytes
            image_mime_type: MIME type of the image

        Returns:
            DesignAnnotation with detected values for each axis
        """
        import json
        import re

        prompt = """Analyze this image along these design dimensions. For each dimension, list ALL applicable tags (you can select multiple per dimension).

DIMENSIONS AND SUGGESTED TAGS:
NOTE: These are suggested tags. You may use novel, specific tags when they better describe the image.
For example: "film-noir", "golden-hour", "dutch-angle", "neon-glow", "hand-lettered" are all valid.
Be precise and descriptive - the system learns from your annotations.

colors (pick from any subcategory):
  Palette type: monochromatic, complementary, analogous, triadic, split-complementary, tetradic
  Temperature: warm, cool, neutral
  Saturation: vibrant, muted, pastel, saturated, desaturated, earthy
  Contrast: high-contrast, low-contrast, subtle-gradients
  Mood-based: moody-dark, light-airy, rich-jewel-tones, soft-naturals

composition (pick from any subcategory):
  Framing: close-up, medium-shot, wide-angle, extreme-close-up, bird's-eye, worm's-eye
  Balance: rule-of-thirds, symmetrical, asymmetrical, centered, golden-ratio
  Lines: diagonal, horizontal, vertical, curved, leading-lines
  Depth: layered, shallow-depth, deep-focus, foreground-focus, atmospheric-perspective
  Space: negative-space, framed, contained, expansive, cropped-tight

mood: warm, cool, dramatic, serene, energetic, mysterious, playful, elegant, contemplative, whimsical, bold, intimate, grand, nostalgic, futuristic

layout (pick from any subcategory):
  Structure: centered, asymmetric, grid, modular, freeform
  Density: dense, spacious, balanced, clustered, scattered
  Flow: dynamic, static, radial, linear, organic
  Hierarchy: focal-point, distributed, progressive, nested

aesthetic (pick from any subcategory):
  Realism: photorealistic, hyperrealistic, stylized-realism
  Illustration: illustrated, flat-design, line-art, hand-drawn, vector
  Digital: 3D-rendered, CGI, digital-painting, pixel-art, low-poly
  Movement: art-nouveau, art-deco, bauhaus, swiss-style, brutalist
  Era: retro, vintage, mid-century, 80s-aesthetic, Y2K, modern, futuristic
  Approach: minimalist, maximalist, abstract, surreal, collage, mixed-media

typeface_feel (pick from any subcategory):
  Category: sans-serif, serif, slab-serif, monospace, display, script
  Weight: light, regular, medium, bold, black
  Character: geometric, humanist, elegant, playful, technical, editorial

Return ONLY a JSON object mapping each axis to its tags (no markdown, no explanation):
{
  "colors": ["warm", "vibrant"],
  "composition": ["rule-of-thirds", "layered"],
  "mood": ["dramatic", "bold"],
  "layout": ["asymmetric", "dynamic"],
  "aesthetic": ["minimalist", "modern"],
  "typeface_feel": ["sans-serif", "geometric"]
}"""

        model_name = self.DEFAULT_TEXT_MODEL
        start_time = time.time()

        print(f"[{model_name}] Annotating design dimensions...")

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
            # Log detailed error information
            error_msg = str(e)
            error_type = type(e).__name__
            print(f"[ERROR] Annotation failed after {elapsed:.1f}s")
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

        print(f"[OK] Annotated in {elapsed:.1f}s")

        # Parse JSON response
        try:
            # Clean up response (remove markdown code blocks if present)
            clean_text = text.strip()
            if clean_text.startswith("```"):
                clean_text = re.sub(r"^```(?:json)?\n?", "", clean_text)
                clean_text = re.sub(r"\n?```$", "", clean_text)

            data = json.loads(clean_text)

            # Parse all axes dynamically - any key with list value is an axis
            axes = {}
            for key, value in data.items():
                if isinstance(value, list):
                    axes[key] = value

            return DesignAnnotation(axes=axes, raw_response=text)
        except json.JSONDecodeError as e:
            print(f"[WARN] Failed to parse annotation JSON: {e}")
            return DesignAnnotation(axes={}, raw_response=text)
