"""Gemini API service for image generation - simplified from Reverie."""

import base64
import os
import time
from dataclasses import dataclass, field
from typing import Any

from google import genai
from google.genai import types


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
        self, prompt: str, input_image: bytes | None = None, input_mime_type: str = "image/png"
    ) -> ImageResult:
        """Generate images using Gemini Nano Banana Pro.

        Args:
            prompt: Text prompt for generation
            input_image: Optional image bytes for image-to-image generation
            input_mime_type: MIME type of input image
        """
        model_name = self.DEFAULT_IMAGE_MODEL
        start_time = time.time()

        print(f"[{model_name}] Generating image{'  (with input image)' if input_image else ''}...")

        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
        )

        # Build contents - text + optional image
        if input_image:
            contents = [
                types.Part.from_bytes(data=input_image, mime_type=input_mime_type),
                prompt,
            ]
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
            print(f"[ERROR] Generation failed after {elapsed:.1f}s: {e}")
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

        return ImageResult(
            text=text,
            images=images,
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
        model_name = self.DEFAULT_TEXT_MODEL
        start_time = time.time()

        # Format the system prompt with user's base prompt and count
        formatted_prompt = system_prompt.format(
            base_prompt=base_prompt,
            count=count,
        )

        print(f"[{model_name}] Generating {count} prompt variations...")

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=formatted_prompt,
            )
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[ERROR] Variation generation failed after {elapsed:.1f}s: {e}")
            raise

        elapsed = time.time() - start_time

        # Extract text response
        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text = part.text
                            break

        print(f"[OK] Generated variations in {elapsed:.1f}s ({len(text)} chars)")

        return text
