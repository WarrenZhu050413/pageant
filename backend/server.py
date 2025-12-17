#!/usr/bin/env python3
"""FastAPI server for on-demand Gemini image generation.

Data Model:
- Session: A named evaluation context (stored in frontend localStorage)
- Prompt: A text prompt that generates multiple images (stored in metadata.json)
- Image: An individual generated image

Sessions are managed client-side. The server manages prompts and images.
"""

import asyncio
import base64
import io
import json
import logging
import os
import re
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from typing import Any, Generic, Literal, TypeVar

# Valid values for image generation parameters
ImageSizeType = Literal["1K", "2K", "4K"]
AspectRatioType = Literal["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]
SafetyLevelType = Literal["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"]
ThinkingLevelType = Literal["low", "high"]

# Support both import contexts:
# - 'uvicorn backend.server:app' from project root (uses backend.* imports)
# - 'import server' from backend directory (uses bare imports in tests)
try:
    from backend.metadata_manager import MetadataManager
    from backend.gemini_service import GeminiService
except ImportError:
    from metadata_manager import MetadataManager
    from gemini_service import GeminiService

# Configure logging
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "server.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Gemini Pageant API")


# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = Path(__file__).parent.parent
IMAGES_DIR = BASE_DIR / "generated_images"
METADATA_PATH = IMAGES_DIR / "metadata.json"

# Global metadata manager instance
_metadata_manager = MetadataManager(METADATA_PATH, IMAGES_DIR)

# Initialize Gemini service
# API key can be configured via:
# 1. Environment variable: GEMINI_API_KEY (direct key)
# 2. Environment variable: GEMINI_API_KEY_PATH (path to file)
# 3. Default path: ~/.gemini/apikey_backup.txt
def load_api_key() -> str:
    # Direct API key from environment
    if api_key := os.environ.get("GEMINI_API_KEY"):
        return api_key.strip()

    # Path to API key file from environment
    if key_path_str := os.environ.get("GEMINI_API_KEY_PATH"):
        key_path = Path(key_path_str).expanduser()
        if key_path.exists():
            return key_path.read_text().strip()
        raise FileNotFoundError(f"API key file not found: {key_path}")

    # Default path
    default_path = Path.home() / ".gemini" / "apikey_backup.txt"
    if default_path.exists():
        return default_path.read_text().strip()

    # Fallback to old path for backward compatibility
    old_path = Path.home() / ".gemini" / "apikey.txt"
    if old_path.exists():
        return old_path.read_text().strip()

    raise FileNotFoundError(
        "Gemini API key not found. Set GEMINI_API_KEY env var or create ~/.gemini/apikey_backup.txt"
    )

api_key = load_api_key()
gemini = GeminiService(api_key=api_key)


# Image generation parameter options (matching frontend)
IMAGE_SIZE_OPTIONS = ["1K", "2K", "4K"]
ASPECT_RATIO_OPTIONS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]
SAFETY_LEVEL_OPTIONS = ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"]


# Request/Response models
class GenerateRequest(BaseModel):
    prompt: str
    title: str = ""
    category: str = "Custom"
    count: int = 4  # Number of images to generate in parallel
    input_image_id: str | None = None  # For single image-to-image (legacy)
    context_image_ids: list[str] = []  # Multiple context images
    collection_id: str | None = None  # Use a collection as context
    session_id: str | None = None  # Session to associate with
    # Image generation parameters (validated)
    image_size: ImageSizeType | None = None
    aspect_ratio: AspectRatioType | None = None
    seed: int | None = None  # For reproducibility
    safety_level: SafetyLevelType | None = None
    # Nano Banana specific
    thinking_level: ThinkingLevelType | None = None
    temperature: float | None = None
    google_search_grounding: bool | None = None

    @field_validator("seed")
    @classmethod
    def validate_seed(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("seed must be a non-negative integer")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float | None) -> float | None:
        if v is not None and (v < 0.0 or v > 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v


# === NEW: Two-Phase Generation Models ===
class GeneratePromptsRequest(BaseModel):
    """Request for generating prompt variations only (phase 1)."""
    prompt: str
    title: str | None = None  # Optional - will be auto-generated if not provided
    count: int = 4
    context_image_ids: list[str] = []
    # Image generation parameters (validated, for phase 2)
    image_size: ImageSizeType | None = None
    aspect_ratio: AspectRatioType | None = None
    seed: int | None = None
    safety_level: SafetyLevelType | None = None
    # Nano Banana specific
    thinking_level: ThinkingLevelType | None = None
    temperature: float | None = None
    google_search_grounding: bool | None = None

    @field_validator("seed")
    @classmethod
    def validate_seed(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("seed must be a non-negative integer")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float | None) -> float | None:
        if v is not None and (v < 0.0 or v > 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v


class PromptVariation(BaseModel):
    """A single prompt variation."""
    id: str
    text: str
    mood: str = ""
    type: str = ""
    design: dict[str, list[str]] = {}  # Design tags by axis (colors, composition, etc.)


class GeneratePromptsResponse(BaseModel):
    """Response with prompt variations."""
    success: bool
    variations: list[PromptVariation] = []
    base_prompt: str = ""
    generated_title: str | None = None  # Title from model (generated or refined from user's)
    error: str | None = None


class GenerateFromPromptsRequest(BaseModel):
    """Request for generating images from edited prompts (phase 2)."""
    title: str
    prompts: list[dict]  # [{ text: str, mood?: str }]
    context_image_ids: list[str] = []
    session_id: str | None = None
    category: str = "Custom"
    base_prompt: str | None = None  # Original prompt that generated variations
    # Image generation parameters (validated)
    image_size: ImageSizeType | None = None
    aspect_ratio: AspectRatioType | None = None
    seed: int | None = None
    safety_level: SafetyLevelType | None = None
    # Nano Banana specific
    thinking_level: ThinkingLevelType | None = None
    temperature: float | None = None
    google_search_grounding: bool | None = None

    @field_validator("seed")
    @classmethod
    def validate_seed(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("seed must be a non-negative integer")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float | None) -> float | None:
        if v is not None and (v < 0.0 or v > 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v


# === Sessions ===
class SessionRequest(BaseModel):
    name: str
    notes: str = ""


class SessionUpdateRequest(BaseModel):
    name: str | None = None
    notes: str | None = None


class PromptResponse(BaseModel):
    success: bool
    prompt_id: str | None = None
    images: list[dict] = []
    errors: list[str] = []


class ToggleFavoriteRequest(BaseModel):
    image_id: str


# === NEW: Templates (Prompt Library) ===
class TemplateRequest(BaseModel):
    name: str
    prompt: str
    category: str = "Custom"
    tags: list[str] = []


# === NEW: Batch Operations ===
class BatchDeleteRequest(BaseModel):
    image_ids: list[str]


class BatchFavoriteRequest(BaseModel):
    image_ids: list[str]
    favorite: bool


# === Image Notes ===
class ImageNotesRequest(BaseModel):
    notes: str = ""
    caption: str = ""


# === Collections (Multi-Image Context) ===
class CollectionRequest(BaseModel):
    name: str
    description: str = ""
    image_ids: list[str] = []


class CollectionUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    image_ids: list[str] | None = None


class CollectionImagesRequest(BaseModel):
    image_ids: list[str]


# === Stories ===
class CreateStoryRequest(BaseModel):
    title: str
    description: str = ""


class UpdateStoryRequest(BaseModel):
    title: str | None = None
    description: str | None = None


class ChapterRequest(BaseModel):
    title: str = ""
    text: str = ""
    image_ids: list[str] = []
    layout: str = "text_below"


class ReorderChaptersRequest(BaseModel):
    chapter_ids: list[str]


# === Settings ===
class SettingsRequest(BaseModel):
    variation_prompt: str
    iteration_prompt: str | None = None  # Prompt for "More Like This"
    # Image generation defaults (validated)
    image_size: ImageSizeType | None = None
    aspect_ratio: AspectRatioType | None = None
    seed: int | None = None  # Default seed (None = random)
    safety_level: SafetyLevelType | None = None
    # Nano Banana specific
    thinking_level: ThinkingLevelType | None = None
    temperature: float | None = None
    google_search_grounding: bool | None = None

    @field_validator("seed")
    @classmethod
    def validate_seed(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("seed must be a non-negative integer")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float | None) -> float | None:
        if v is not None and (v < 0.0 or v > 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v


# === Standardized Response Models ===
T = TypeVar("T")


class ListResponse(BaseModel):
    """Standardized response for list endpoints."""
    items: list[Any]
    count: int | None = None

    def __init__(self, **data):
        super().__init__(**data)
        if self.count is None:
            self.count = len(self.items)


class MutationResponse(BaseModel):
    """Standardized response for mutation endpoints."""
    success: bool
    id: str | None = None
    item: dict | None = None
    message: str | None = None


def load_metadata() -> dict:
    """Load existing metadata or create new.

    Wrapper around MetadataManager.load() for backwards compatibility.
    """
    return _metadata_manager.load()


def save_metadata(data: dict):
    """Save metadata to disk.

    Wrapper around MetadataManager.save() for backwards compatibility.
    """
    _metadata_manager.save(data)


def get_metadata_manager() -> MetadataManager:
    """Get the global MetadataManager instance.

    Use this for new code that wants to use MetadataManager directly,
    including context manager and find_* methods.
    """
    return _metadata_manager


# === Prompt Variation System ===
PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_default_variation_prompt() -> str:
    """Load the default variation prompt template from file."""
    prompt_path = PROMPTS_DIR / "variation_structured.txt"
    return prompt_path.read_text()


def _flatten_design(design: dict) -> list[str]:
    """Flatten design tags dict into a flat list of tags."""
    tags = []
    for axis_tags in design.values():
        if isinstance(axis_tags, list):
            tags.extend(axis_tags)
    return tags


async def _generate_single_image(
    prompt: str,
    index: int,
    context_images: list[tuple[bytes, str, str | None]] | None = None,
    image_size: str | None = None,
    aspect_ratio: str | None = None,
    seed: int | None = None,
    safety_level: str | None = None,
    thinking_level: str | None = None,
    temperature: float | None = None,
    google_search_grounding: bool | None = None,
) -> dict:
    """Generate a single image and save it."""
    try:
        result = await gemini.generate_image(
            prompt,
            context_images=context_images,
            image_size=image_size,
            aspect_ratio=aspect_ratio,
            seed=seed,
            safety_level=safety_level,
            thinking_level=thinking_level,
            temperature=temperature,
            google_search_grounding=google_search_grounding,
        )

        if not result.images:
            return {"success": False, "error": "No image generated by model"}

        # Generate unique ID
        image_id = f"img-{uuid.uuid4().hex[:8]}"

        # Save image
        img_data = result.images[0]
        img_bytes = base64.b64decode(img_data["data"])
        ext = "png" if "png" in img_data["mime_type"] else "jpg"
        img_filename = f"{image_id}.{ext}"
        img_path = IMAGES_DIR / img_filename
        img_path.write_bytes(img_bytes)

        return {
            "success": True,
            "id": image_id,
            "index": index,
            "image_path": img_filename,
            "mime_type": img_data["mime_type"],
            "generated_at": datetime.now().isoformat(),
            "prompt_used": prompt,  # Store the actual prompt used
        }
    except Exception as e:
        error_type = type(e).__name__
        logger.error(f"Image generation #{index} failed: {error_type}: {str(e)}")
        return {"success": False, "error": str(e), "index": index, "error_type": error_type}


def _find_image_by_id(metadata: dict, image_id: str) -> tuple[dict | None, Path | None]:
    """Find an image by ID and return its data and path."""
    for prompt_data in metadata.get("prompts", []):
        for img in prompt_data.get("images", []):
            if img["id"] == image_id:
                img_path = IMAGES_DIR / img["image_path"]
                if img_path.exists():
                    return img, img_path
    # Also check collections (collections reference images, not store them)
    return None, None


def _load_context_images(metadata: dict, image_ids: list[str]) -> list[tuple[bytes, str, str | None]]:
    """Load multiple context images. Returns list of (bytes, mime_type, notes) tuples."""
    context_images = []
    for img_id in image_ids:
        img_data, img_path = _find_image_by_id(metadata, img_id)
        if img_data and img_path:
            # Only send caption to API (notes are user workspace only)
            caption = img_data.get("caption", "") or ""
            context_desc = caption.strip() if caption else None

            context_images.append((
                img_path.read_bytes(),
                img_data.get("mime_type", "image/png"),
                context_desc,
            ))
    return context_images


# ============================================================
# TWO-PHASE GENERATION: Prompt Variations → Image Generation
# ============================================================

@app.post("/api/generate-prompts", response_model=GeneratePromptsResponse)
async def generate_prompt_variations(req: GeneratePromptsRequest):
    """Generate prompt variations only (Phase 1 of two-phase generation).

    Uses Gemini's structured JSON output for guaranteed valid responses.
    Returns text variations that the user can review, edit, and select
    before committing to image generation.

    If context_image_ids are provided, the images and their captions are
    passed to the model to inform the variations.
    """
    count = min(max(1, req.count), 10)  # Clamp between 1 and 10
    title_info = f", title='{req.title}'" if req.title else ""
    logger.info(f"Generate prompts request: count={count}, prompt='{req.prompt[:50]}...'{title_info}, context_images={len(req.context_image_ids)}")

    # Load context images with captions if specified
    metadata = load_metadata()
    context_images = None
    if req.context_image_ids:
        context_images = _load_context_images(metadata, req.context_image_ids)
        if context_images:
            logger.info(f"Using {len(context_images)} context image(s) with captions for prompt variation")

    try:
        # Use structured output for guaranteed JSON response
        logger.info(f"Generating {count} prompt variations (structured output)...")
        generated_title, scene_variations = await gemini.generate_prompt_variations(
            base_prompt=req.prompt,
            count=count,
            context_images=context_images,
            title=req.title,  # Pass user-provided title as context (or None)
        )
        logger.info(f"Received title='{generated_title}', {len(scene_variations)} structured scene variations")

        # Convert SceneVariation objects to response model
        variations = []
        for scene in scene_variations[:count]:
            variations.append(PromptVariation(
                id=f"var-{uuid.uuid4().hex[:8]}",
                text=scene.description,
                mood=scene.mood,
                type=scene.type,
                design=scene.design.model_dump() if scene.design else {},
            ))

        if not variations:
            return GeneratePromptsResponse(
                success=False,
                error="No variations generated",
                base_prompt=req.prompt,
            )

        return GeneratePromptsResponse(
            success=True,
            variations=variations,
            base_prompt=req.prompt,
            generated_title=generated_title,
        )

    except Exception as e:
        logger.error(f"Variation generation failed: {e}")
        return GeneratePromptsResponse(
            success=False,
            error=str(e),
            base_prompt=req.prompt,
        )


@app.post("/api/generate-images", response_model=PromptResponse)
async def generate_images_from_prompts(req: GenerateFromPromptsRequest):
    """Generate images from user-edited prompts (Phase 2 of two-phase generation).

    Takes an array of prompt texts (possibly edited by user) and generates
    images from each in parallel.
    """
    if not req.prompts:
        return PromptResponse(success=False, errors=["No prompts provided"])

    count = len(req.prompts)
    logger.info(f"Generate images from {count} prompts, title='{req.title}'")

    metadata = load_metadata()

    # Load context images if specified (with notes for interleaved input)
    context_images = None
    if req.context_image_ids:
        context_images = _load_context_images(metadata, req.context_image_ids)
        if context_images:
            logger.info(f"Using {len(context_images)} context image(s) with interleaved notes")

    # Generate images in parallel from provided prompts
    tasks = [
        _generate_single_image(
            prompt_data.get("text", ""),
            i,
            context_images=context_images,
            image_size=req.image_size,
            aspect_ratio=req.aspect_ratio,
            seed=req.seed,
            safety_level=req.safety_level,
            thinking_level=req.thinking_level,
            temperature=req.temperature,
            google_search_grounding=req.google_search_grounding,
        )
        for i, prompt_data in enumerate(req.prompts)
    ]
    results = await asyncio.gather(*tasks)

    # Process results and add metadata from prompts
    images = []
    errors = []
    for i, result in enumerate(results):
        if result.get("success"):
            del result["success"]
            # Add mood and design from original prompt data if available
            if i < len(req.prompts):
                result["mood"] = req.prompts[i].get("mood", "")
                result["variation_type"] = "user-edited"
                # Add design tags if passed from frontend
                if "design" in req.prompts[i]:
                    result["design_tags"] = _flatten_design(req.prompts[i]["design"])
                    result["annotations"] = req.prompts[i]["design"]
            images.append(result)
        else:
            errors.append(f"#{result.get('index', '?')}: {result.get('error', 'Unknown error')}")

    if not images:
        logger.error(f"Generation failed: {errors}")
        return PromptResponse(success=False, errors=errors)

    # Create prompt entry (combine all prompts into one entry)
    prompt_id = f"prompt-{uuid.uuid4().hex[:8]}"
    combined_prompt = "\n---\n".join(p.get("text", "")[:200] for p in req.prompts[:3])
    if len(req.prompts) > 3:
        combined_prompt += f"\n... and {len(req.prompts) - 3} more"

    prompt_entry = {
        "id": prompt_id,
        "prompt": combined_prompt,
        "title": req.title or "Untitled",
        "category": req.category,
        "context_image_ids": req.context_image_ids,
        "session_id": req.session_id,
        "created_at": datetime.now().isoformat(),
        "images": images,
        "generation_mode": "two-phase",  # Mark as two-phase generation
        "base_prompt": req.base_prompt,  # Original prompt that generated variations
    }

    metadata["prompts"].append(prompt_entry)
    save_metadata(metadata)

    logger.info(f"Generated {len(images)} images from prompts, prompt_id={prompt_id}")

    return PromptResponse(
        success=True,
        prompt_id=prompt_id,
        images=images,
        errors=errors,
    )


# ============================================================
# DIRECT GENERATION (Legacy/Bypass mode)
# ============================================================

@app.post("/api/generate", response_model=PromptResponse)
async def generate_images(req: GenerateRequest):
    """Generate images from a prompt using 2-step variation system (Direct mode).

    Step 1: Generate varied prompt descriptions via text model
    Step 2: Generate images from those prompts in parallel
    """
    count = min(max(1, req.count), 10)  # Clamp between 1 and 10
    logger.info(f"Generate request: count={count}, title='{req.title}', prompt='{req.prompt[:50]}...'")

    metadata = load_metadata()

    # Resolve context image IDs from various sources
    context_image_ids = list(req.context_image_ids)  # Make a copy

    # Add legacy single input image if specified
    if req.input_image_id and req.input_image_id not in context_image_ids:
        context_image_ids.insert(0, req.input_image_id)

    # Add images from collection if specified
    if req.collection_id:
        for coll in metadata.get("collections", []):
            if coll["id"] == req.collection_id:
                for img_id in coll.get("image_ids", []):
                    if img_id not in context_image_ids:
                        context_image_ids.append(img_id)
                break

    # Load context images (for image-to-image generation with interleaved notes)
    context_images = None
    if context_image_ids:
        context_images = _load_context_images(metadata, context_image_ids)
        if context_images:
            logger.info(f"Using {len(context_images)} context image(s) with interleaved notes")

    # === Step 1: Generate varied prompts via text model (structured output) ===
    try:
        logger.info(f"Generating {count} prompt variations (structured output)...")
        _, scene_variations = await gemini.generate_prompt_variations(
            base_prompt=req.prompt,
            count=count,
        )
        # Convert SceneVariation objects to dict format for image generation
        variations = [
            {
                "id": str(i + 1),
                "type": scene.type,
                "description": scene.description,
                "mood": scene.mood,
                "design": scene.design.model_dump() if scene.design else {},
            }
            for i, scene in enumerate(scene_variations)
        ]
        logger.info(f"Received {len(variations)} scene variations")

        if not variations:
            logger.error("No variations generated by structured output")
            return PromptResponse(success=False, errors=["Failed to generate prompt variations"])
    except Exception as e:
        logger.error(f"Variation generation failed: {e}")
        return PromptResponse(success=False, errors=[f"Failed to generate variations: {str(e)}"])

    # === Step 2: Generate images from varied prompts in parallel ===
    tasks = [
        _generate_single_image(
            var["description"],
            i,
            context_images=context_images,
            image_size=req.image_size,
            aspect_ratio=req.aspect_ratio,
            seed=req.seed,
            safety_level=req.safety_level,
            thinking_level=req.thinking_level,
            temperature=req.temperature,
            google_search_grounding=req.google_search_grounding,
        )
        for i, var in enumerate(variations[:count])
    ]
    results = await asyncio.gather(*tasks)

    # Process results and add variation metadata
    images = []
    errors = []
    for i, result in enumerate(results):
        if result.get("success"):
            del result["success"]
            # Add variation metadata (mood, type, design) if available
            if i < len(variations):
                result["mood"] = variations[i].get("mood", "")
                result["variation_type"] = variations[i].get("type", "")
                # Add design tags from variation
                if "design" in variations[i]:
                    result["design_tags"] = _flatten_design(variations[i]["design"])
                    result["annotations"] = variations[i]["design"]
            images.append(result)
        else:
            errors.append(f"#{result.get('index', '?')}: {result.get('error', 'Unknown error')}")

    if not images:
        logger.error(f"Generation failed: {errors}")
        return PromptResponse(success=False, errors=errors)

    # Create prompt entry
    prompt_id = f"prompt-{uuid.uuid4().hex[:8]}"
    prompt_entry = {
        "id": prompt_id,
        "prompt": req.prompt,
        "title": req.title or "Untitled",
        "category": req.category,
        "input_image_id": req.input_image_id,  # Legacy single image
        "context_image_ids": context_image_ids,  # All context images used
        "collection_id": req.collection_id,  # Collection used as context
        "session_id": req.session_id,  # Session this prompt belongs to
        "created_at": datetime.now().isoformat(),
        "images": images,
    }

    # Save to metadata (reload to avoid stale data)
    metadata["prompts"].append(prompt_entry)
    save_metadata(metadata)

    logger.info(f"Generated {len(images)} images, prompt_id={prompt_id}" + (f", errors={len(errors)}" if errors else ""))

    return PromptResponse(
        success=True,
        prompt_id=prompt_id,
        images=images,
        errors=errors,
    )


@app.get("/api/prompts")
async def list_prompts(session_id: str | None = None):
    """List all prompts with their images, optionally filtered by session."""
    metadata = load_metadata()
    prompts = metadata.get("prompts", [])

    # Filter by session if specified
    if session_id:
        prompts = [p for p in prompts if p.get("session_id") == session_id]

    return {
        "prompts": prompts,
        "favorites": metadata.get("favorites", []),
    }


@app.get("/api/prompts/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a specific prompt with its images."""
    metadata = load_metadata()
    for prompt in metadata.get("prompts", []):
        if prompt["id"] == prompt_id:
            return {"prompt": prompt, "favorites": metadata.get("favorites", [])}
    raise HTTPException(status_code=404, detail="Prompt not found")


@app.delete("/api/prompts/{prompt_id}")
async def delete_prompt(prompt_id: str):
    """Delete a prompt and all its images."""
    metadata = load_metadata()

    for i, prompt in enumerate(metadata.get("prompts", [])):
        if prompt["id"] == prompt_id:
            # Delete all image files and remove from favorites
            for img in prompt.get("images", []):
                _metadata_manager.delete_image_file(
                    metadata, img["id"], img.get("image_path")
                )

            # Remove prompt
            metadata["prompts"].pop(i)
            save_metadata(metadata)
            logger.info(f"Deleted prompt: {prompt_id}")
            return {"success": True, "deleted_id": prompt_id}

    raise HTTPException(status_code=404, detail="Prompt not found")


class BatchDeletePromptsRequest(BaseModel):
    prompt_ids: list[str]


@app.post("/api/batch/delete-prompts")
async def batch_delete_prompts(req: BatchDeletePromptsRequest):
    """Delete multiple prompts and all their images."""
    metadata = load_metadata()
    deleted_ids = []
    errors = []

    for prompt_id in req.prompt_ids:
        found = False
        for i, prompt in enumerate(metadata.get("prompts", [])):
            if prompt["id"] == prompt_id:
                found = True
                # Delete all image files and remove from favorites
                for img in prompt.get("images", []):
                    _metadata_manager.delete_image_file(
                        metadata, img["id"], img.get("image_path")
                    )

                # Remove prompt
                metadata["prompts"].pop(i)
                deleted_ids.append(prompt_id)
                logger.info(f"Batch deleted prompt: {prompt_id}")
                break

        if not found:
            errors.append(f"Prompt not found: {prompt_id}")

    save_metadata(metadata)
    return {"success": True, "deleted_ids": deleted_ids, "errors": errors}


@app.delete("/api/images/{image_id}")
async def delete_image(image_id: str):
    """Delete a single image from a prompt."""
    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for i, img in enumerate(prompt.get("images", [])):
            if img["id"] == image_id:
                # Delete file and remove from favorites
                _metadata_manager.delete_image_file(
                    metadata, image_id, img.get("image_path")
                )

                # Remove from prompt
                prompt["images"].pop(i)
                save_metadata(metadata)
                return {"success": True, "deleted_id": image_id}

    raise HTTPException(status_code=404, detail="Image not found")


@app.patch("/api/images/{image_id}/notes")
async def update_image_notes(image_id: str, req: ImageNotesRequest):
    """Update notes and/or caption for an image."""
    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                # Update notes and caption
                if req.notes is not None:
                    img["notes"] = req.notes
                if req.caption is not None:
                    img["caption"] = req.caption

                save_metadata(metadata)
                return {
                    "id": image_id,
                    "notes": img.get("notes", ""),
                    "caption": img.get("caption", ""),
                }

    raise HTTPException(status_code=404, detail="Image not found")


@app.post("/api/upload")
async def upload_images(
    files: list[UploadFile] = File(...),
    title: str = Form("Uploaded Images"),
    category: str = Form("Custom"),
):
    """Upload custom images to create a new prompt."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    metadata = load_metadata()
    prompt_id = f"upload-{uuid.uuid4().hex[:8]}"
    images = []

    for file in files:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            continue

        # Generate unique filename
        ext = Path(file.filename or "image.png").suffix or ".png"
        image_id = f"img-{uuid.uuid4().hex[:8]}"
        filename = f"{image_id}{ext}"

        # Save file
        content = await file.read()
        image_path = IMAGES_DIR / filename
        image_path.write_bytes(content)

        images.append({
            "id": image_id,
            "image_path": filename,
            "created_at": datetime.now().isoformat(),
        })

    if not images:
        raise HTTPException(status_code=400, detail="No valid images uploaded")

    # Create prompt entry
    prompt_entry = {
        "id": prompt_id,
        "title": title,
        "prompt": f"Uploaded {len(images)} image(s)",
        "category": category,
        "created_at": datetime.now().isoformat(),
        "images": images,
    }

    metadata["prompts"].append(prompt_entry)
    save_metadata(metadata)

    logger.info(f"Uploaded {len(images)} images as prompt: {prompt_id}")

    return {
        "success": True,
        "prompt_id": prompt_id,
        "images": images,
    }


@app.post("/api/favorites")
async def toggle_favorite(req: ToggleFavoriteRequest):
    """Toggle favorite status for an image."""
    metadata = load_metadata()

    if "favorites" not in metadata:
        metadata["favorites"] = []

    is_favorite = False
    if req.image_id in metadata["favorites"]:
        metadata["favorites"].remove(req.image_id)
        is_favorite = False
    else:
        metadata["favorites"].append(req.image_id)
        is_favorite = True

    save_metadata(metadata)
    return {"is_favorite": is_favorite}


@app.get("/api/favorites")
async def get_favorites():
    """Get all favorite images."""
    metadata = load_metadata()
    favorites = metadata.get("favorites", [])

    # Collect favorite image details
    favorite_images = []
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] in favorites:
                favorite_images.append({
                    **img,
                    "prompt_id": prompt["id"],
                    "prompt_text": prompt["prompt"],
                    "prompt_title": prompt["title"],
                })

    return {"favorites": favorite_images}


# Legacy endpoint for backwards compatibility
@app.get("/api/images")
async def list_images():
    """List all images (flattened view for backwards compatibility)."""
    metadata = load_metadata()
    all_images = []
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            all_images.append({
                **img,
                "prompt": prompt["prompt"],
                "title": prompt["title"],
                "category": prompt["category"],
                "use_for": "User-generated image",
                "prompt_id": prompt["id"],
            })
    return {"images": all_images}


# ============================================================
# FEATURE 1: Prompt Library (Templates)
# ============================================================

@app.get("/api/templates")
async def list_templates():
    """List all prompt templates."""
    metadata = load_metadata()
    return {"templates": metadata.get("templates", [])}


@app.post("/api/templates")
async def create_template(req: TemplateRequest):
    """Create a new prompt template."""
    metadata = load_metadata()
    if "templates" not in metadata:
        metadata["templates"] = []

    template_id = f"tpl-{uuid.uuid4().hex[:8]}"
    template = {
        "id": template_id,
        "name": req.name,
        "prompt": req.prompt,
        "category": req.category,
        "tags": req.tags,
        "created_at": datetime.now().isoformat(),
        "use_count": 0,
    }
    metadata["templates"].append(template)
    save_metadata(metadata)
    logger.info(f"Created template: {template_id} - {req.name}")
    return {"success": True, "template": template}


@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: str):
    """Delete a prompt template."""
    metadata = load_metadata()
    templates = metadata.get("templates", [])
    for i, tpl in enumerate(templates):
        if tpl["id"] == template_id:
            templates.pop(i)
            save_metadata(metadata)
            return {"success": True}
    raise HTTPException(status_code=404, detail="Template not found")


@app.post("/api/templates/{template_id}/use")
async def use_template(template_id: str):
    """Increment use count for a template."""
    metadata = load_metadata()
    for tpl in metadata.get("templates", []):
        if tpl["id"] == template_id:
            tpl["use_count"] = tpl.get("use_count", 0) + 1
            tpl["last_used"] = datetime.now().isoformat()
            save_metadata(metadata)
            return {"success": True, "template": tpl}
    raise HTTPException(status_code=404, detail="Template not found")


# ============================================================
# FEATURE 1b: Design Library (Fragments, Presets, Templates)
# ============================================================

class LibraryItemRequest(BaseModel):
    type: str  # 'fragment', 'preset', 'template'
    name: str
    description: str = ""
    text: str | None = None  # For fragments
    style_tags: list[str] | None = None  # For presets
    prompt: str | None = None  # For templates
    category: str = ""
    tags: list[str] = []


@app.get("/api/library")
async def list_library_items():
    """List all design library items."""
    metadata = load_metadata()
    return {"items": metadata.get("library", [])}


@app.post("/api/library")
async def create_library_item(req: LibraryItemRequest):
    """Create a new library item (fragment, preset, or template)."""
    if req.type not in ("fragment", "preset", "template"):
        raise HTTPException(status_code=400, detail="Invalid type. Must be fragment, preset, or template")

    metadata = load_metadata()
    if "library" not in metadata:
        metadata["library"] = []

    item_id = f"lib-{uuid.uuid4().hex[:8]}"
    item = {
        "id": item_id,
        "type": req.type,
        "name": req.name,
        "description": req.description,
        "created_at": datetime.now().isoformat(),
        "use_count": 0,
        "category": req.category,
        "tags": req.tags,
    }

    # Type-specific fields
    if req.type == "fragment":
        item["text"] = req.text or ""
    elif req.type == "preset":
        item["style_tags"] = req.style_tags or []
    elif req.type == "template":
        item["prompt"] = req.prompt or ""

    metadata["library"].append(item)
    save_metadata(metadata)
    logger.info(f"Created library item: {item_id} - {req.name} ({req.type})")
    return {"success": True, "item": item}


@app.delete("/api/library/{item_id}")
async def delete_library_item(item_id: str):
    """Delete a library item."""
    metadata = load_metadata()
    library = metadata.get("library", [])
    for i, item in enumerate(library):
        if item["id"] == item_id:
            library.pop(i)
            save_metadata(metadata)
            logger.info(f"Deleted library item: {item_id}")
            return {"success": True}
    raise HTTPException(status_code=404, detail="Library item not found")


@app.post("/api/library/{item_id}/use")
async def use_library_item(item_id: str):
    """Increment use count for a library item."""
    metadata = load_metadata()
    for item in metadata.get("library", []):
        if item["id"] == item_id:
            item["use_count"] = item.get("use_count", 0) + 1
            item["last_used"] = datetime.now().isoformat()
            save_metadata(metadata)
            return {"success": True, "item": item}
    raise HTTPException(status_code=404, detail="Library item not found")


# ============================================================
# FEATURE 2: Export & Share
# ============================================================

@app.get("/api/export/favorites")
async def export_favorites_zip():
    """Export all favorite images as a ZIP file."""
    metadata = load_metadata()
    favorites = metadata.get("favorites", [])

    if not favorites:
        raise HTTPException(status_code=400, detail="No favorites to export")

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add manifest
        manifest = {"exported_at": datetime.now().isoformat(), "images": []}

        for prompt in metadata.get("prompts", []):
            for img in prompt.get("images", []):
                if img["id"] in favorites:
                    img_path = IMAGES_DIR / img["image_path"]
                    if img_path.exists():
                        # Add image to zip
                        zf.write(img_path, img["image_path"])
                        manifest["images"].append({
                            "id": img["id"],
                            "filename": img["image_path"],
                            "prompt": prompt["prompt"],
                            "title": prompt["title"],
                        })

        # Add manifest
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    zip_buffer.seek(0)
    logger.info(f"Exported {len(manifest['images'])} favorites to ZIP")

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=pageant-favorites-{datetime.now().strftime('%Y%m%d')}.zip"}
    )


@app.get("/api/export/gallery")
async def export_gallery_html():
    """Generate a shareable HTML gallery of favorites."""
    metadata = load_metadata()
    favorites = metadata.get("favorites", [])

    # Collect favorite images with their prompts
    gallery_items = []
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] in favorites:
                gallery_items.append({
                    "id": img["id"],
                    "image_path": img["image_path"],
                    "title": prompt["title"],
                    "prompt": prompt["prompt"],
                    "category": prompt["category"],
                })

    # Generate HTML
    html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini Pageant Gallery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff; padding: 40px; }
        h1 { text-align: center; margin-bottom: 40px; font-weight: 300; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; max-width: 1400px; margin: 0 auto; }
        .card { background: #2a2a2a; border-radius: 12px; overflow: hidden; }
        .card img { width: 100%; aspect-ratio: 1; object-fit: cover; }
        .card-info { padding: 16px; }
        .card-title { font-size: 1.1rem; margin-bottom: 8px; }
        .card-prompt { font-size: 0.85rem; color: #888; line-height: 1.5; }
        .footer { text-align: center; margin-top: 40px; color: #666; font-size: 0.85rem; }
    </style>
</head>
<body>
    <h1>Gemini Pageant Gallery</h1>
    <div class="gallery">
'''
    for item in gallery_items:
        html += f'''        <div class="card">
            <img src="images/{item['image_path']}" alt="{item['title']}">
            <div class="card-info">
                <div class="card-title">{item['title']}</div>
                <div class="card-prompt">{item['prompt'][:150]}{'...' if len(item['prompt']) > 150 else ''}</div>
            </div>
        </div>
'''
    html += f'''    </div>
    <div class="footer">Generated with Gemini Pageant • {datetime.now().strftime('%Y-%m-%d')}</div>
</body>
</html>'''

    logger.info(f"Generated gallery HTML with {len(gallery_items)} images")
    return StreamingResponse(
        io.BytesIO(html.encode()),
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=pageant-gallery-{datetime.now().strftime('%Y%m%d')}.html"}
    )


# ============================================================
# TASTE EXPORT: Portable Visual Taste Profiles
# ============================================================

try:
    from backend.taste_exporter import compile_taste_export
except ImportError:
    from taste_exporter import compile_taste_export
from dataclasses import asdict


@app.get("/api/export/taste")
async def export_taste_profile(include_images: bool = False, top_n: int = 20):
    """Export portable visual taste profile as JSON.

    Computes axis weights on-the-fly from liked_axes data if not pre-compiled.
    """
    metadata = load_metadata()

    export = compile_taste_export(
        metadata,
        include_images=include_images,
        top_n_exemplars=top_n,
    )

    return asdict(export)


@app.get("/api/export/taste/zip")
async def export_taste_with_images(top_n: int = 20):
    """Export taste profile + exemplar images as ZIP."""
    metadata = load_metadata()

    export = compile_taste_export(metadata, top_n_exemplars=top_n)

    # Create ZIP with JSON + images
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add manifest
        zf.writestr("taste-profile.json", json.dumps(asdict(export), indent=2))

        # Add exemplar images
        for exemplar in export.exemplars["images"]:
            img_path = IMAGES_DIR / exemplar["filename"]
            if img_path.exists():
                zf.write(img_path, f"exemplars/{exemplar['filename']}")

    zip_buffer.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="taste-profile-{timestamp}.zip"'
        }
    )


# ============================================================
# FEATURE 3: Iteration Workflow (Generate More Like This)
# ============================================================

@app.post("/api/iterate/{image_id}")
async def generate_more_like_this(image_id: str, count: int = 4):
    """Generate variations of a specific image."""
    metadata = load_metadata()

    # Find the source image and its prompt
    source_img = None
    source_prompt = None
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                source_img = img
                source_prompt = prompt
                break
        if source_img:
            break

    if not source_img:
        raise HTTPException(status_code=404, detail="Image not found")

    # Load the source image with its notes for interleaved context
    img_path = IMAGES_DIR / source_img["image_path"]
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    # Only send caption to API (notes are user workspace only)
    caption = source_img.get("caption", "") or ""
    context_desc = caption.strip() if caption else None

    context_images = [(
        img_path.read_bytes(),
        source_img.get("mime_type", "image/png"),
        context_desc,
    )]

    # === Step 1: Generate varied prompts via text model (structured output) ===
    base_variation_prompt = f"Create a variation of this image while maintaining its core essence. {source_prompt['prompt']}"
    logger.info(f"Generating {count} variations of {image_id}")

    try:
        _, scene_variations = await gemini.generate_prompt_variations(
            base_prompt=base_variation_prompt,
            count=count,
        )
        # Convert SceneVariation objects to dict format for image generation
        variations = [
            {
                "id": str(i + 1),
                "type": scene.type,
                "description": scene.description,
                "mood": scene.mood,
                "design": scene.design.model_dump() if scene.design else {},
            }
            for i, scene in enumerate(scene_variations)
        ]
        logger.info(f"Received {len(variations)} variation prompts for iteration")

        if not variations:
            return {"success": False, "errors": ["Failed to generate variation prompts"]}
    except Exception as e:
        logger.error(f"Variation generation failed for iteration: {e}")
        return {"success": False, "errors": [f"Failed to generate variations: {str(e)}"]}

    # Load default image generation params from settings
    settings = metadata.get("settings", {})

    # === Step 2: Generate images from varied prompts in parallel ===
    tasks = [
        _generate_single_image(
            var["description"],
            i,
            context_images=context_images,
            image_size=settings.get("image_size"),
            aspect_ratio=settings.get("aspect_ratio"),
            seed=settings.get("seed"),
            safety_level=settings.get("safety_level"),
            thinking_level=settings.get("thinking_level"),
            temperature=settings.get("temperature"),
            google_search_grounding=settings.get("google_search_grounding"),
        )
        for i, var in enumerate(variations[:count])
    ]
    results = await asyncio.gather(*tasks)

    # Process results and add variation metadata
    images = []
    errors = []
    for i, result in enumerate(results):
        if result.get("success"):
            del result["success"]
            # Add variation metadata (mood, type, design) if available
            if i < len(variations):
                result["mood"] = variations[i].get("mood", "")
                result["variation_type"] = variations[i].get("type", "")
                # Add design tags from variation
                if "design" in variations[i]:
                    result["design_tags"] = _flatten_design(variations[i]["design"])
                    result["annotations"] = variations[i]["design"]
            images.append(result)
        else:
            errors.append(f"#{result.get('index', '?')}: {result.get('error', 'Unknown error')}")

    if not images:
        logger.error(f"Iteration failed: {errors}")
        return {"success": False, "errors": errors}

    # Create new prompt entry for iterations
    prompt_id = f"prompt-{uuid.uuid4().hex[:8]}"
    prompt_entry = {
        "id": prompt_id,
        "prompt": base_variation_prompt,  # Use base prompt, not system prompt
        "title": f"Variations of {source_prompt['title']}",
        "category": source_prompt["category"],
        "input_image_id": image_id,
        "parent_prompt_id": source_prompt["id"],
        "created_at": datetime.now().isoformat(),
        "images": images,
    }

    metadata["prompts"].append(prompt_entry)
    save_metadata(metadata)

    logger.info(f"Generated {len(images)} variations, prompt_id={prompt_id}")

    return {
        "success": True,
        "prompt_id": prompt_id,
        "images": images,
        "errors": errors,
    }


# ============================================================
# FEATURE 4: Batch Operations
# ============================================================

@app.post("/api/batch/delete")
async def batch_delete_images(req: BatchDeleteRequest):
    """Delete multiple images at once."""
    metadata = load_metadata()
    deleted = []
    not_found = []

    for image_id in req.image_ids:
        found = False
        for prompt in metadata.get("prompts", []):
            for i, img in enumerate(prompt.get("images", [])):
                if img["id"] == image_id:
                    # Delete file and remove from favorites
                    _metadata_manager.delete_image_file(
                        metadata, image_id, img.get("image_path")
                    )

                    # Remove from prompt
                    prompt["images"].pop(i)
                    deleted.append(image_id)
                    found = True
                    break
            if found:
                break
        if not found:
            not_found.append(image_id)

    save_metadata(metadata)
    logger.info(f"Batch deleted {len(deleted)} images")
    return {"success": True, "deleted": deleted, "not_found": not_found}


@app.post("/api/batch/favorite")
async def batch_favorite_images(req: BatchFavoriteRequest):
    """Set favorite status for multiple images."""
    metadata = load_metadata()
    if "favorites" not in metadata:
        metadata["favorites"] = []

    updated = []
    for image_id in req.image_ids:
        if req.favorite:
            if image_id not in metadata["favorites"]:
                metadata["favorites"].append(image_id)
                updated.append(image_id)
        else:
            if image_id in metadata["favorites"]:
                metadata["favorites"].remove(image_id)
                updated.append(image_id)

    save_metadata(metadata)
    logger.info(f"Batch {'favorited' if req.favorite else 'unfavorited'} {len(updated)} images")
    return {"success": True, "updated": updated, "favorites": metadata["favorites"]}


@app.post("/api/batch/regenerate")
async def batch_regenerate(prompt_id: str, count: int = 4):
    """Regenerate images for a prompt (useful after failures)."""
    metadata = load_metadata()

    # Find the prompt
    target_prompt = None
    for prompt in metadata.get("prompts", []):
        if prompt["id"] == prompt_id:
            target_prompt = prompt
            break

    if not target_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Load context images (check both new context_image_ids and legacy input_image_id)
    context_image_ids = target_prompt.get("context_image_ids", [])
    if not context_image_ids and target_prompt.get("input_image_id"):
        context_image_ids = [target_prompt["input_image_id"]]

    context_images = _load_context_images(metadata, context_image_ids) if context_image_ids else None

    logger.info(f"Regenerating {count} images for prompt {prompt_id}")

    # Load default image generation params from settings
    settings = metadata.get("settings", {})

    # Generate new images
    tasks = [
        _generate_single_image(
            target_prompt["prompt"],
            i,
            context_images=context_images,
            image_size=settings.get("image_size"),
            aspect_ratio=settings.get("aspect_ratio"),
            seed=settings.get("seed"),
            safety_level=settings.get("safety_level"),
            thinking_level=settings.get("thinking_level"),
            temperature=settings.get("temperature"),
            google_search_grounding=settings.get("google_search_grounding"),
        )
        for i in range(count)
    ]
    results = await asyncio.gather(*tasks)

    # Process results
    new_images = []
    errors = []
    for result in results:
        if result.get("success"):
            del result["success"]
            new_images.append(result)
        else:
            errors.append(f"#{result.get('index', '?')}: {result.get('error', 'Unknown error')}")

    if new_images:
        # Add new images to the prompt
        target_prompt["images"].extend(new_images)
        save_metadata(metadata)
        logger.info(f"Added {len(new_images)} regenerated images to prompt {prompt_id}")

    return {
        "success": len(new_images) > 0,
        "new_images": new_images,
        "errors": errors,
    }


# ============================================================
# FEATURE 5: Collections (Multi-Image Context)
# ============================================================

@app.get("/api/collections")
async def list_collections():
    """List all image collections."""
    metadata = load_metadata()
    collections = metadata.get("collections", [])

    # Enrich with image count and thumbnail
    enriched = []
    for coll in collections:
        # Get first image as thumbnail
        thumbnail = None
        for img_id in coll.get("image_ids", [])[:1]:
            img_data, img_path = _find_image_by_id(metadata, img_id)
            if img_data:
                thumbnail = img_data.get("image_path")
                break

        enriched.append({
            **coll,
            "image_count": len(coll.get("image_ids", [])),
            "thumbnail": thumbnail,
        })

    return {"collections": enriched}


@app.post("/api/collections")
async def create_collection(req: CollectionRequest):
    """Create a new image collection."""
    metadata = load_metadata()
    if "collections" not in metadata:
        metadata["collections"] = []

    collection_id = f"coll-{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    collection = {
        "id": collection_id,
        "name": req.name,
        "description": req.description,
        "image_ids": req.image_ids,
        "created_at": now,
        "updated_at": now,
    }

    metadata["collections"].append(collection)
    save_metadata(metadata)
    logger.info(f"Created collection: {collection_id} - {req.name} with {len(req.image_ids)} images")

    return {"success": True, "collection": collection}


@app.get("/api/collections/{collection_id}")
async def get_collection(collection_id: str):
    """Get a collection with full image details."""
    metadata = load_metadata()

    for coll in metadata.get("collections", []):
        if coll["id"] == collection_id:
            # Enrich with full image data
            images = []
            for img_id in coll.get("image_ids", []):
                img_data, img_path = _find_image_by_id(metadata, img_id)
                if img_data:
                    # Find parent prompt for context
                    for prompt in metadata.get("prompts", []):
                        for img in prompt.get("images", []):
                            if img["id"] == img_id:
                                images.append({
                                    **img_data,
                                    "prompt_id": prompt["id"],
                                    "prompt_title": prompt["title"],
                                })
                                break

            return {
                **coll,
                "images": images,
            }

    raise HTTPException(status_code=404, detail="Collection not found")


@app.patch("/api/collections/{collection_id}")
async def update_collection(collection_id: str, req: CollectionUpdateRequest):
    """Update a collection (name, description, or images)."""
    metadata = load_metadata()

    for coll in metadata.get("collections", []):
        if coll["id"] == collection_id:
            if req.name is not None:
                coll["name"] = req.name
            if req.description is not None:
                coll["description"] = req.description
            if req.image_ids is not None:
                coll["image_ids"] = req.image_ids
            coll["updated_at"] = datetime.now().isoformat()

            save_metadata(metadata)
            logger.info(f"Updated collection: {collection_id}")
            return {"success": True, "collection": coll}

    raise HTTPException(status_code=404, detail="Collection not found")


@app.post("/api/collections/{collection_id}/images")
async def add_images_to_collection(collection_id: str, req: CollectionImagesRequest):
    """Add images to a collection."""
    metadata = load_metadata()

    for coll in metadata.get("collections", []):
        if coll["id"] == collection_id:
            for img_id in req.image_ids:
                if img_id not in coll["image_ids"]:
                    coll["image_ids"].append(img_id)
            coll["updated_at"] = datetime.now().isoformat()

            save_metadata(metadata)
            logger.info(f"Added {len(req.image_ids)} images to collection {collection_id}")
            return {"success": True, "collection": coll}

    raise HTTPException(status_code=404, detail="Collection not found")


@app.delete("/api/collections/{collection_id}/images")
async def remove_images_from_collection(collection_id: str, req: CollectionImagesRequest):
    """Remove images from a collection."""
    metadata = load_metadata()

    for coll in metadata.get("collections", []):
        if coll["id"] == collection_id:
            coll["image_ids"] = [
                img_id for img_id in coll["image_ids"]
                if img_id not in req.image_ids
            ]
            coll["updated_at"] = datetime.now().isoformat()

            save_metadata(metadata)
            logger.info(f"Removed {len(req.image_ids)} images from collection {collection_id}")
            return {"success": True, "collection": coll}

    raise HTTPException(status_code=404, detail="Collection not found")


@app.delete("/api/collections/{collection_id}")
async def delete_collection(collection_id: str):
    """Delete a collection (does not delete the images themselves)."""
    metadata = load_metadata()
    collections = metadata.get("collections", [])

    for i, coll in enumerate(collections):
        if coll["id"] == collection_id:
            collections.pop(i)
            save_metadata(metadata)
            logger.info(f"Deleted collection: {collection_id}")
            return {"success": True, "deleted_id": collection_id}

    raise HTTPException(status_code=404, detail="Collection not found")


# === Story CRUD Endpoints ===

@app.post("/api/stories")
async def create_story(req: CreateStoryRequest):
    """Create a new story."""
    metadata = load_metadata()

    # Ensure stories array exists
    if "stories" not in metadata:
        metadata["stories"] = []

    story_id = f"story-{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    story = {
        "id": story_id,
        "title": req.title,
        "description": req.description,
        "chapters": [],
        "created_at": now,
        "updated_at": now,
    }

    metadata["stories"].append(story)
    save_metadata(metadata)

    return story


@app.get("/api/stories")
async def list_stories():
    """List all stories."""
    metadata = load_metadata()
    return {"stories": metadata.get("stories", [])}


@app.get("/api/stories/{story_id}")
async def get_story(story_id: str):
    """Get a specific story."""
    metadata = load_metadata()

    for story in metadata.get("stories", []):
        if story["id"] == story_id:
            return story

    raise HTTPException(status_code=404, detail="Story not found")


@app.put("/api/stories/{story_id}")
async def update_story(story_id: str, req: UpdateStoryRequest):
    """Update story metadata."""
    metadata = load_metadata()

    for story in metadata.get("stories", []):
        if story["id"] == story_id:
            if req.title is not None:
                story["title"] = req.title
            if req.description is not None:
                story["description"] = req.description
            story["updated_at"] = datetime.now().isoformat()

            save_metadata(metadata)
            return story

    raise HTTPException(status_code=404, detail="Story not found")


@app.delete("/api/stories/{story_id}")
async def delete_story(story_id: str):
    """Delete a story."""
    metadata = load_metadata()
    stories = metadata.get("stories", [])

    for i, story in enumerate(stories):
        if story["id"] == story_id:
            stories.pop(i)
            save_metadata(metadata)
            return {"success": True, "deleted_id": story_id}

    raise HTTPException(status_code=404, detail="Story not found")


@app.post("/api/stories/{story_id}/chapters")
async def add_chapter(story_id: str, req: ChapterRequest):
    """Add a chapter to a story."""
    metadata = load_metadata()

    for story in metadata.get("stories", []):
        if story["id"] == story_id:
            chapter_id = f"ch-{uuid.uuid4().hex[:8]}"
            sequence = len(story["chapters"]) + 1

            chapter = {
                "id": chapter_id,
                "title": req.title,
                "text": req.text,
                "image_ids": req.image_ids,
                "layout": req.layout,
                "sequence": sequence,
            }

            story["chapters"].append(chapter)
            story["updated_at"] = datetime.now().isoformat()
            save_metadata(metadata)

            return story

    raise HTTPException(status_code=404, detail="Story not found")


@app.put("/api/stories/{story_id}/chapters/{chapter_id}")
async def update_chapter(story_id: str, chapter_id: str, req: ChapterRequest):
    """Update a chapter."""
    metadata = load_metadata()

    for story in metadata.get("stories", []):
        if story["id"] == story_id:
            for chapter in story["chapters"]:
                if chapter["id"] == chapter_id:
                    if req.title:
                        chapter["title"] = req.title
                    if req.text:
                        chapter["text"] = req.text
                    if req.image_ids:
                        chapter["image_ids"] = req.image_ids
                    if req.layout:
                        chapter["layout"] = req.layout

                    story["updated_at"] = datetime.now().isoformat()
                    save_metadata(metadata)
                    return story

            raise HTTPException(status_code=404, detail="Chapter not found")

    raise HTTPException(status_code=404, detail="Story not found")


@app.delete("/api/stories/{story_id}/chapters/{chapter_id}")
async def delete_chapter(story_id: str, chapter_id: str):
    """Delete a chapter from a story."""
    metadata = load_metadata()

    for story in metadata.get("stories", []):
        if story["id"] == story_id:
            chapters = story["chapters"]
            for i, chapter in enumerate(chapters):
                if chapter["id"] == chapter_id:
                    chapters.pop(i)
                    # Resequence remaining chapters
                    for j, ch in enumerate(chapters):
                        ch["sequence"] = j + 1
                    story["updated_at"] = datetime.now().isoformat()
                    save_metadata(metadata)
                    return story

            raise HTTPException(status_code=404, detail="Chapter not found")

    raise HTTPException(status_code=404, detail="Story not found")


@app.post("/api/stories/{story_id}/chapters/reorder")
async def reorder_chapters(story_id: str, req: ReorderChaptersRequest):
    """Reorder chapters in a story."""
    metadata = load_metadata()

    for story in metadata.get("stories", []):
        if story["id"] == story_id:
            # Create a map of chapter_id -> chapter
            chapter_map = {ch["id"]: ch for ch in story["chapters"]}

            # Verify all IDs are valid
            for ch_id in req.chapter_ids:
                if ch_id not in chapter_map:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Chapter {ch_id} not found in story",
                    )

            # Reorder chapters
            new_chapters = []
            for i, ch_id in enumerate(req.chapter_ids):
                ch = chapter_map[ch_id]
                ch["sequence"] = i + 1
                new_chapters.append(ch)

            story["chapters"] = new_chapters
            story["updated_at"] = datetime.now().isoformat()
            save_metadata(metadata)

            return story

    raise HTTPException(status_code=404, detail="Story not found")


# ============================================================
# FEATURE 6: Design Axis System (Tags & Preferences)
# ============================================================

class DesignTagsRequest(BaseModel):
    tags: list[str]


class LikeAxisRequest(BaseModel):
    axis: str  # typeface, colors, layout, mood, composition, style
    tag: str  # specific tag value like "sans-serif", "elegant"
    liked: bool  # True to add, False to remove


@app.patch("/api/images/{image_id}/design-tags")
async def update_design_tags(image_id: str, req: DesignTagsRequest):
    """Update design tags for an image."""
    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                img["design_tags"] = req.tags
                save_metadata(metadata)
                logger.info(f"Updated design tags for {image_id}: {req.tags}")
                return {"id": image_id, "design_tags": req.tags}

    raise HTTPException(status_code=404, detail="Image not found")


@app.patch("/api/images/{image_id}/like-axis")
async def toggle_axis_like(image_id: str, req: LikeAxisRequest):
    """Toggle axis preference for a specific tag value on an image.

    liked_axes is now a dict of string arrays: { axis: ["tag1", "tag2"] }
    """
    valid_axes = ["typeface", "colors", "layout", "mood", "composition", "style"]
    if req.axis not in valid_axes:
        raise HTTPException(status_code=400, detail=f"Invalid axis. Must be one of: {valid_axes}")

    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                if "liked_axes" not in img:
                    img["liked_axes"] = {}

                # Initialize axis as array if needed
                if req.axis not in img["liked_axes"] or not isinstance(img["liked_axes"][req.axis], list):
                    img["liked_axes"][req.axis] = []

                axis_tags = img["liked_axes"][req.axis]

                if req.liked:
                    # Add tag if not present
                    if req.tag not in axis_tags:
                        axis_tags.append(req.tag)
                else:
                    # Remove tag if present
                    if req.tag in axis_tags:
                        axis_tags.remove(req.tag)

                save_metadata(metadata)
                logger.info(f"Updated axis preference for {image_id}: {req.axis}[{req.tag}]={req.liked}")
                return {"id": image_id, "liked_axes": img["liked_axes"]}

    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/api/preferences")
async def get_design_preferences():
    """Get aggregated design preferences across all rated images.

    liked_axes format: { axis: ["tag1", "tag2"] }
    Returns count of each tag that was liked.
    """
    metadata = load_metadata()

    # Initialize preference counters
    preferences = {
        "typeface": {},
        "colors": {},
        "layout": {},
        "mood": {},
        "composition": {},
        "style": {},
    }
    total_rated = 0

    # Aggregate preferences from all images
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            liked_axes = img.get("liked_axes", {})

            # Check if this image has any liked tags
            has_likes = False
            for axis, tags in liked_axes.items():
                if isinstance(tags, list) and len(tags) > 0:
                    has_likes = True
                    # Count each liked tag
                    for tag in tags:
                        if axis in preferences:
                            if tag not in preferences[axis]:
                                preferences[axis][tag] = 0
                            preferences[axis][tag] += 1

            if has_likes:
                total_rated += 1

    return {
        "preferences": preferences,
        "total_rated": total_rated,
    }


@app.post("/api/preferences/reset")
async def reset_design_preferences():
    """Clear all design preferences (liked_axes) from all images."""
    metadata = load_metadata()
    cleared_count = 0

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if "liked_axes" in img:
                img["liked_axes"] = {}
                cleared_count += 1

    save_metadata(metadata)
    logger.info(f"Reset design preferences for {cleared_count} images")
    return {"success": True, "cleared_count": cleared_count}


# ============================================================
# FEATURE 7: Sessions (Named Working Contexts)
# ============================================================

@app.get("/api/sessions")
async def list_sessions():
    """List all sessions."""
    metadata = load_metadata()
    sessions = metadata.get("sessions", [])

    # Enrich with prompt count
    enriched = []
    for session in sessions:
        prompt_count = len([
            p for p in metadata.get("prompts", [])
            if p.get("session_id") == session["id"]
        ])
        enriched.append({
            **session,
            "prompt_count": prompt_count,
        })

    return {"sessions": enriched}


@app.post("/api/sessions")
async def create_session(req: SessionRequest):
    """Create a new session."""
    metadata = load_metadata()
    if "sessions" not in metadata:
        metadata["sessions"] = []

    session_id = f"session-{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    session = {
        "id": session_id,
        "name": req.name,
        "notes": req.notes,
        "created_at": now,
    }

    metadata["sessions"].append(session)
    save_metadata(metadata)
    logger.info(f"Created session: {session_id} - {req.name}")

    return {"success": True, "session": session}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a session with its prompts."""
    metadata = load_metadata()

    for session in metadata.get("sessions", []):
        if session["id"] == session_id:
            # Get prompts for this session
            session_prompts = [
                p for p in metadata.get("prompts", [])
                if p.get("session_id") == session_id
            ]
            return {
                **session,
                "prompts": session_prompts,
                "prompt_count": len(session_prompts),
            }

    raise HTTPException(status_code=404, detail="Session not found")


@app.patch("/api/sessions/{session_id}")
async def update_session(session_id: str, req: SessionUpdateRequest):
    """Update a session's name or notes."""
    metadata = load_metadata()

    for session in metadata.get("sessions", []):
        if session["id"] == session_id:
            if req.name is not None:
                session["name"] = req.name
            if req.notes is not None:
                session["notes"] = req.notes

            save_metadata(metadata)
            logger.info(f"Updated session: {session_id}")
            return {"success": True, "session": session}

    raise HTTPException(status_code=404, detail="Session not found")


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, delete_prompts: bool = False):
    """Delete a session. Optionally delete all prompts in the session."""
    metadata = load_metadata()
    sessions = metadata.get("sessions", [])

    for i, session in enumerate(sessions):
        if session["id"] == session_id:
            # Handle prompts in the session
            if delete_prompts:
                # Delete all prompts and their images
                prompts_to_delete = [
                    p for p in metadata.get("prompts", [])
                    if p.get("session_id") == session_id
                ]
                for prompt in prompts_to_delete:
                    # Delete image files and remove from favorites
                    for img in prompt.get("images", []):
                        _metadata_manager.delete_image_file(
                            metadata, img["id"], img.get("image_path")
                        )

                metadata["prompts"] = [
                    p for p in metadata.get("prompts", [])
                    if p.get("session_id") != session_id
                ]
                logger.info(f"Deleted {len(prompts_to_delete)} prompts from session {session_id}")
            else:
                # Just clear session_id from prompts
                for prompt in metadata.get("prompts", []):
                    if prompt.get("session_id") == session_id:
                        prompt["session_id"] = None

            # Delete the session
            sessions.pop(i)
            save_metadata(metadata)
            logger.info(f"Deleted session: {session_id}")
            return {"success": True, "deleted_id": session_id}

    raise HTTPException(status_code=404, detail="Session not found")


@app.post("/api/sessions/{session_id}/prompts")
async def add_prompts_to_session(session_id: str, prompt_ids: list[str]):
    """Add existing prompts to a session."""
    metadata = load_metadata()

    # Verify session exists
    session_exists = any(s["id"] == session_id for s in metadata.get("sessions", []))
    if not session_exists:
        raise HTTPException(status_code=404, detail="Session not found")

    added = []
    for prompt in metadata.get("prompts", []):
        if prompt["id"] in prompt_ids:
            prompt["session_id"] = session_id
            added.append(prompt["id"])

    save_metadata(metadata)
    logger.info(f"Added {len(added)} prompts to session {session_id}")
    return {"success": True, "added": added}


@app.delete("/api/sessions/{session_id}/prompts")
async def remove_prompts_from_session(session_id: str, prompt_ids: list[str]):
    """Remove prompts from a session (doesn't delete them)."""
    metadata = load_metadata()

    removed = []
    for prompt in metadata.get("prompts", []):
        if prompt["id"] in prompt_ids and prompt.get("session_id") == session_id:
            prompt["session_id"] = None
            removed.append(prompt["id"])

    save_metadata(metadata)
    logger.info(f"Removed {len(removed)} prompts from session {session_id}")
    return {"success": True, "removed": removed}


# === Settings Endpoints ===

DEFAULT_ITERATION_PROMPT = """Create a variation of this image while maintaining its core essence.
Focus on: {focus}
Original concept: {original_prompt}

Generate a new scene description that explores this direction while keeping the fundamental visual identity."""


@app.get("/api/settings")
async def get_settings():
    """Get app settings including variation/iteration prompts and image generation defaults."""
    metadata = load_metadata()
    settings = metadata.get("settings", {})
    return {
        "variation_prompt": settings.get(
            "variation_prompt",
            load_default_variation_prompt()
        ),
        "iteration_prompt": settings.get(
            "iteration_prompt",
            DEFAULT_ITERATION_PROMPT
        ),
        "text_model": GeminiService.DEFAULT_TEXT_MODEL,
        "image_model": GeminiService.DEFAULT_IMAGE_MODEL,
        # Image generation defaults
        "image_size": settings.get("image_size"),  # None = use model default (1K)
        "aspect_ratio": settings.get("aspect_ratio"),  # None = use model default (1:1)
        "seed": settings.get("seed"),  # None = random each time
        "safety_level": settings.get("safety_level"),  # None = use model default
        # Nano Banana specific
        "thinking_level": settings.get("thinking_level"),  # None = high (default)
        "temperature": settings.get("temperature"),  # None = 1.0 (default)
        "google_search_grounding": settings.get("google_search_grounding"),  # None = disabled
    }


@app.put("/api/settings")
async def update_settings(req: SettingsRequest):
    """Update app settings including image generation defaults."""
    metadata = load_metadata()
    if "settings" not in metadata:
        metadata["settings"] = {}
    metadata["settings"]["variation_prompt"] = req.variation_prompt
    if req.iteration_prompt is not None:
        metadata["settings"]["iteration_prompt"] = req.iteration_prompt
    # Image generation defaults
    if req.image_size is not None:
        metadata["settings"]["image_size"] = req.image_size
    if req.aspect_ratio is not None:
        metadata["settings"]["aspect_ratio"] = req.aspect_ratio
    if req.seed is not None:
        metadata["settings"]["seed"] = req.seed
    if req.safety_level is not None:
        metadata["settings"]["safety_level"] = req.safety_level
    # Nano Banana specific
    if req.thinking_level is not None:
        metadata["settings"]["thinking_level"] = req.thinking_level
    if req.temperature is not None:
        metadata["settings"]["temperature"] = req.temperature
    if req.google_search_grounding is not None:
        metadata["settings"]["google_search_grounding"] = req.google_search_grounding
    save_metadata(metadata)
    logger.info("Updated settings")
    return {"success": True}


# Serve static files
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# Ensure preferences directory exists for preference images
PREF_DIR = IMAGES_DIR / "preferences"
PREF_DIR.mkdir(exist_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
