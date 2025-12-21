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
import aiohttp
from datetime import datetime
from pathlib import Path

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from typing import Any, Generic, Literal, Optional, TypeVar

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
    from backend.gemini_service import GeminiService, _detect_image_mime_type, _convert_heic_to_jpeg
    from backend import config
    from backend.search.indexer import get_background_indexer
    from backend.search.search_service import get_search_service
except ImportError:
    from metadata_manager import MetadataManager
    from gemini_service import GeminiService, _detect_image_mime_type, _convert_heic_to_jpeg
    import config
    from search.indexer import get_background_indexer
    from search.search_service import get_search_service

# Paths (defined early for use in lifespan)
BASE_DIR = Path(__file__).parent.parent
IMAGES_DIR = BASE_DIR / "generated_images"
METADATA_PATH = IMAGES_DIR / "metadata.json"

# Configure logging
LOG_DIR = BASE_DIR / "logs"
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifespan handler for startup/shutdown tasks."""
    # Startup: start background indexer (if search is enabled)
    if config.ENABLE_SEARCH:
        logger.info("Starting background indexer...")
        indexer = get_background_indexer(IMAGES_DIR)
        await indexer.start()
    else:
        logger.info("Search disabled (ENABLE_SEARCH=false), skipping indexer")

    yield

    # Shutdown: stop background indexer
    if config.ENABLE_SEARCH:
        logger.info("Stopping background indexer...")
        indexer = get_background_indexer(IMAGES_DIR)
        await indexer.stop()


app = FastAPI(title="Gemini Pageant API", lifespan=lifespan)


# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global metadata manager instance
_metadata_manager = MetadataManager(METADATA_PATH, IMAGES_DIR)

# Initialize Gemini service (API key loaded from config)
gemini = GeminiService(api_key=config.get_gemini_api_key())


# Image generation parameter options (matching frontend)
IMAGE_SIZE_OPTIONS = ["1K", "2K", "4K"]
ASPECT_RATIO_OPTIONS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]
SAFETY_LEVEL_OPTIONS = ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"]


# Request/Response models for Two-Phase Generation
class GeneratePromptsRequest(BaseModel):
    """Request for generating prompt variations only (phase 1).

    Frontend sends the complete prompt (including template text).
    Backend passes it through to Gemini without modification.
    """
    prompt: str  # Complete prompt from frontend (includes template + user input)
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
    """A single prompt variation with optional per-variation context assignment."""
    id: str
    text: str
    title: str = ""  # Short title for this variation (2-5 words)
    mood: str = ""
    type: str = ""
    design: dict[str, list[str]] = {}  # Design tags by axis (colors, composition, etc.)
    design_dimensions: list[dict] = []  # 3-4 substantial design dimensions from AI
    # Per-variation context image assignment
    recommended_context_ids: list[str] = []  # Image IDs to use for THIS variation
    context_reasoning: str | None = None  # Why these images were chosen


class AnnotationSuggestionResponse(BaseModel):
    """Suggested annotation polish for a context image."""
    image_id: str
    original_annotation: str | None = None
    suggested_annotation: str
    reason: str


class GeneratePromptsResponse(BaseModel):
    """Response with prompt variations and optional annotation suggestions."""
    success: bool
    variations: list[PromptVariation] = []
    base_prompt: str = ""
    generated_title: str | None = None  # Title from model (generated or refined from user's)
    annotation_suggestions: list[AnnotationSuggestionResponse] = []  # Suggested annotation polish
    error: str | None = None


class GenerateFromPromptsRequest(BaseModel):
    """Request for generating images from edited prompts (phase 2)."""
    title: str
    prompts: list[dict]  # [{ text: str, mood?: str }]
    context_image_ids: list[str] = []
    session_id: str | None = None
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


# === Design Dimension Analysis ===
class DesignDimension(BaseModel):
    """Rich AI-analyzed design dimension metadata."""
    axis: str              # e.g., "lighting", "mood", "colors"
    name: str              # Evocative name, e.g., "Eerie Green Cast"
    description: str       # 2-3 sentence analysis
    tags: list[str]        # Design vocabulary tags
    generation_prompt: str # Prompt for generating pure concept image
    source: Literal["auto", "user"] = "auto"  # How it was created
    confirmed: bool = False  # User confirmed this suggestion


class UpdateDimensionsRequest(BaseModel):
    """Request for updating design dimensions on an image."""
    dimensions: dict[str, DesignDimension]  # axis -> dimension


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


# === NEW: Batch Operations ===
class BatchDeleteRequest(BaseModel):
    image_ids: list[str]


class BatchFavoriteRequest(BaseModel):
    image_ids: list[str]


class BatchDownloadRequest(BaseModel):
    image_ids: list[str]


# === Image Notes ===
class ImageNotesRequest(BaseModel):
    notes: str = ""
    annotation: str = ""


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
# Prompts are now constructed by frontend and sent as complete prompts to backend


def _flatten_design(design: dict) -> list[str]:
    """Flatten design tags dict into a flat list of tags."""
    tags = []
    for axis_tags in design.values():
        if isinstance(axis_tags, list):
            tags.extend(axis_tags)
    return tags


def _sanitize_filename(text: str, max_length: int = 40) -> str:
    """Sanitize text for use in filename - remove special characters and limit length."""
    import re
    # Remove special characters, keep alphanumeric and spaces
    sanitized = re.sub(r'[^\w\s-]', '', text)
    # Replace spaces with hyphens and collapse multiple hyphens
    sanitized = re.sub(r'[\s_]+', '-', sanitized)
    sanitized = re.sub(r'-+', '-', sanitized)
    # Remove leading/trailing hyphens and limit length
    return sanitized.strip('-')[:max_length]


async def _generate_single_image(
    prompt: str,
    index: int,
    title: str = "image",
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

        # Generate timestamp-based filename: yyyy-mm-dd-hh-mm-ss-title-number.ext
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d-%H-%M-%S")
        sanitized_title = _sanitize_filename(title)
        image_id = f"{timestamp}-{sanitized_title}-{index + 1}"

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
            "generated_at": now.isoformat(),
            "varied_prompt": prompt,  # Store the actual prompt used for this image
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


def _format_liked_axes(liked_axes: dict | None) -> str | None:
    """Format liked_axes dict into a human-readable string for the AI.

    Example: {"lighting": ["Warm Lighting"], "mood": ["Serene", "Peaceful"]}
    Returns: "User prefers in this image: Warm Lighting, Serene, Peaceful"
    """
    if not liked_axes:
        return None
    all_tags = []
    for tags in liked_axes.values():
        if tags:
            all_tags.extend(tags)
    if not all_tags:
        return None
    return f"User prefers in this image: {', '.join(all_tags)}"


def _scene_to_variation(scene: dict) -> PromptVariation:
    """Convert a scene dict from gemini service to PromptVariation.

    Used by both SSE and non-SSE generate-prompts endpoints to share formatting logic.
    Handles both dict (from SSE JSON) and Pydantic object (from direct call) inputs.
    """
    # Handle design dimensions - may be Pydantic objects or dicts
    dims = scene.get("design_dimensions", [])
    if dims and hasattr(dims[0], "model_dump"):
        dims = [dim.model_dump() for dim in dims]

    # Handle design - may be Pydantic object or dict
    design = scene.get("design", {})
    if hasattr(design, "model_dump"):
        design = design.model_dump()

    return PromptVariation(
        id=f"var-{uuid.uuid4().hex[:8]}",
        text=scene.get("description", ""),
        title=scene.get("title", ""),
        mood=scene.get("mood", ""),
        type=scene.get("type", ""),
        design=design,
        design_dimensions=dims,
        recommended_context_ids=scene.get("recommended_context_ids", []),
        context_reasoning=scene.get("context_reasoning"),
    )


def _load_context_images(metadata: dict, image_ids: list[str]) -> list[tuple[bytes, str, str | None]]:
    """Load multiple context images with preference data for AI generation.

    Returns list of (bytes, mime_type, context_description) tuples.
    The context_description includes the user's annotation AND their liked tags.
    """
    context_images = []
    for img_id in image_ids:
        img_data, img_path = _find_image_by_id(metadata, img_id)
        if img_data and img_path:
            # Only send annotation to API (notes are user workspace only)
            # Support both old "caption" field and new "annotation" field
            annotation = img_data.get("annotation") or img_data.get("caption", "") or ""
            annotation = annotation.strip() if annotation else ""

            # Extract and format liked_axes preferences
            liked_axes = img_data.get("liked_axes", {}) or None
            liked_text = _format_liked_axes(liked_axes)

            # Combine annotation and liked preferences into context description
            if annotation and liked_text:
                context_desc = f"{annotation}\n\n{liked_text}"
            elif annotation:
                context_desc = annotation
            elif liked_text:
                context_desc = liked_text
            else:
                context_desc = None

            context_images.append((
                img_path.read_bytes(),
                img_data.get("mime_type", "image/png"),
                context_desc,
            ))
    return context_images


def _load_context_image_pool(metadata: dict, image_ids: list[str]) -> list[tuple[str, bytes, str, str | None, dict | None, list[str] | None]]:
    """Load context images with IDs for per-variation assignment.

    Returns list of (image_id, bytes, mime_type, annotation, confirmed_dimensions, liked_dimension_axes) tuples.
    confirmed_dimensions is a dict of axis -> DesignDimension for dimensions with confirmed=True.
    liked_dimension_axes is a list of axis names the user has liked.

    Note: The annotation includes both the user's text annotation AND their liked design tags.
    """
    pool = []
    for img_id in image_ids:
        img_data, img_path = _find_image_by_id(metadata, img_id)
        if img_data and img_path:
            # Support both old "caption" field and new "annotation" field
            annotation = img_data.get("annotation") or img_data.get("caption", "") or ""
            annotation = annotation.strip() if annotation else ""

            # Extract and format liked_axes preferences (from design tags)
            liked_axes = img_data.get("liked_axes", {}) or None
            liked_text = _format_liked_axes(liked_axes)

            # Combine annotation and liked preferences
            if annotation and liked_text:
                combined_annotation = f"{annotation}\n\n{liked_text}"
            elif annotation:
                combined_annotation = annotation
            elif liked_text:
                combined_annotation = liked_text
            else:
                combined_annotation = None

            # Extract confirmed design dimensions
            confirmed_dims = None
            design_dimensions = img_data.get("design_dimensions")
            if design_dimensions:
                confirmed_dims = {
                    axis: dim
                    for axis, dim in design_dimensions.items()
                    if dim.get("confirmed", False)
                }
                if not confirmed_dims:
                    confirmed_dims = None

            # Extract liked dimension axes
            liked_dimension_axes = img_data.get("liked_dimension_axes")
            if liked_dimension_axes and not liked_dimension_axes:
                liked_dimension_axes = None  # Don't include empty list

            pool.append((
                img_id,
                img_path.read_bytes(),
                img_data.get("mime_type", "image/png"),
                combined_annotation,
                confirmed_dims,
                liked_dimension_axes,
            ))
    return pool


# ============================================================
# TWO-PHASE GENERATION: Prompt Variations → Image Generation
# ============================================================

@app.get("/api/generate-prompts/stream")
async def generate_prompt_variations_stream(
    prompt: str,
    count: int = 4,
    context_image_ids: str | None = None,  # Comma-separated IDs
):
    """Stream prompt variation generation via Server-Sent Events.

    Frontend sends the complete prompt (including template text).
    Backend passes it through to Gemini without modification.

    Events:
    - {"type": "chunk", "text": "..."} - Partial JSON text
    - {"type": "complete", "variations": [...], ...} - Final parsed result
    - {"type": "error", "error": "..."} - Error message
    """
    count = min(max(1, count), 10)

    # Parse context_image_ids from comma-separated string
    image_ids = []
    if context_image_ids:
        image_ids = [id.strip() for id in context_image_ids.split(",") if id.strip()]

    logger.info(f"[SSE] Generate prompts stream: count={count}, prompt='{prompt[:50]}...', context_images={len(image_ids)}")

    # Load context images as a pool with IDs
    metadata = load_metadata()
    context_image_pool = None
    if image_ids:
        context_image_pool = _load_context_image_pool(metadata, image_ids)
        if context_image_pool:
            logger.info(f"[SSE] Loaded {len(context_image_pool)} context image(s)")

    async def event_generator():
        try:
            async for event in gemini.generate_prompt_variations_stream(
                prompt=prompt,
                count=count,
                context_image_pool=context_image_pool,
            ):
                if event["type"] == "chunk":
                    # Stream partial text
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "complete":
                    # Convert to response format using shared helper
                    variations = [
                        _scene_to_variation(scene).model_dump()
                        for scene in event["scenes"][:count]
                    ]

                    # Convert annotation suggestions
                    annotation_suggestions = []
                    if event.get("annotation_suggestions"):
                        annotation_map = {item[0]: item[3] for item in (context_image_pool or [])}
                        for sug in event["annotation_suggestions"]:
                            annotation_suggestions.append({
                                "image_id": sug["image_id"],
                                "original_annotation": annotation_map.get(sug["image_id"]) or sug.get("original_annotation"),
                                "suggested_annotation": sug["suggested_annotation"],
                                "reason": sug["reason"],
                            })

                    response = {
                        "type": "complete",
                        "success": True,
                        "variations": variations,
                        "base_prompt": prompt,
                        "generated_title": event["title"],
                        "annotation_suggestions": annotation_suggestions,
                    }
                    yield f"data: {json.dumps(response)}\n\n"
                elif event["type"] == "error":
                    yield f"data: {json.dumps({'type': 'error', 'success': False, 'error': event['error']})}\n\n"

        except Exception as e:
            logger.error(f"[SSE] Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'success': False, 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@app.post("/api/generate-prompts", response_model=GeneratePromptsResponse)
async def generate_prompt_variations(req: GeneratePromptsRequest):
    """Generate prompt variations only (Phase 1 of two-phase generation).

    Uses Gemini's structured JSON output for guaranteed valid responses.
    Returns text variations that the user can review, edit, and select
    before committing to image generation.

    If context_image_ids are provided, the images and their annotations are
    passed to the model. The model assigns specific images to each variation
    via recommended_context_ids for targeted image generation.
    """
    count = min(max(1, req.count), 10)  # Clamp between 1 and 10
    title_info = f", title='{req.title}'" if req.title else ""
    logger.info(f"Generate prompts request: count={count}, prompt='{req.prompt[:50]}...'{title_info}, context_images={len(req.context_image_ids)}")

    # Load context images as a pool with IDs for per-variation assignment
    metadata = load_metadata()
    context_image_pool = None
    if req.context_image_ids:
        context_image_pool = _load_context_image_pool(metadata, req.context_image_ids)
        if context_image_pool:
            pool_summary = [(item[0], item[3][:30] if item[3] else "(no annotation)") for item in context_image_pool]
            logger.info(f"[CONTEXT TRACE] Phase 1 - Loaded {len(context_image_pool)} context image(s) as pool:")
            for img_id, ann_preview in pool_summary:
                logger.info(f"  - {img_id}: {ann_preview}...")

    try:
        # Use structured output for guaranteed JSON response
        logger.info(f"Generating {count} prompt variations (structured output)...")
        generated_title, scene_variations, annotation_suggestions = await gemini.generate_prompt_variations(
            prompt=req.prompt,
            count=count,
            context_image_pool=context_image_pool,
        )
        logger.info(f"Received title='{generated_title}', {len(scene_variations)} structured scene variations")

        # Log per-variation context assignments from the text model
        if context_image_pool:
            logger.info(f"[CONTEXT TRACE] Text model returned per-variation context assignments:")
            for i, scene in enumerate(scene_variations[:count]):
                ctx_ids = scene.recommended_context_ids or []
                reasoning = scene.context_reasoning or "(no reasoning)"
                logger.info(f"  - Variation {i+1} ({scene.mood}): {len(ctx_ids)} context(s) = {ctx_ids}")
                if ctx_ids:
                    logger.info(f"    Reasoning: {reasoning[:80]}...")

        # Convert SceneVariation objects to response model using shared helper
        variations = [
            _scene_to_variation(scene.model_dump())
            for scene in scene_variations[:count]
        ]

        # Convert annotation suggestions if present
        annotation_suggestion_responses = []
        if annotation_suggestions:
            # Build a map of image_id -> original annotation from the pool
            annotation_map = {item[0]: item[3] for item in (context_image_pool or [])}
            for sug in annotation_suggestions:
                annotation_suggestion_responses.append(AnnotationSuggestionResponse(
                    image_id=sug.image_id,
                    original_annotation=annotation_map.get(sug.image_id) or sug.original_annotation,
                    suggested_annotation=sug.suggested_annotation,
                    reason=sug.reason,
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
            annotation_suggestions=annotation_suggestion_responses,
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

    Each prompt can have recommended_context_ids for per-variation context.
    If not specified, falls back to the global context_image_ids.
    """
    if not req.prompts:
        return PromptResponse(success=False, errors=["No prompts provided"])

    count = len(req.prompts)
    logger.info(f"Generate images from {count} prompts, title='{req.title}'")

    metadata = load_metadata()

    # Build a map of image_id -> (bytes, mime_type, annotation) for per-variation lookup
    context_image_map: dict[str, tuple[bytes, str, str | None]] = {}
    all_context_ids = set(req.context_image_ids)
    # Also collect any per-prompt recommended_context_ids
    for prompt_data in req.prompts:
        all_context_ids.update(prompt_data.get("recommended_context_ids", []))

    # Load all potentially needed context images
    for img_id in all_context_ids:
        if img_id not in context_image_map:
            img_data, img_path = _find_image_by_id(metadata, img_id)
            if img_data and img_path:
                # Support both old "caption" field and new "annotation" field
                annotation = img_data.get("annotation") or img_data.get("caption", "") or ""
                context_image_map[img_id] = (
                    img_path.read_bytes(),
                    img_data.get("mime_type", "image/png"),
                    annotation.strip() if annotation else None,
                )

    # Global fallback context images
    global_context_images = None
    if req.context_image_ids:
        global_context_images = [
            context_image_map[img_id]
            for img_id in req.context_image_ids
            if img_id in context_image_map
        ]
        if global_context_images:
            logger.info(f"Loaded {len(global_context_images)} global context image(s)")

    # Log Phase 2 context setup
    logger.info(f"[CONTEXT TRACE] Phase 2 - Generating {count} images with context:")
    logger.info(f"  - Context map size: {len(context_image_map)} images loaded")

    # Generate images in parallel with per-variation context
    tasks = []
    for i, prompt_data in enumerate(req.prompts):
        # Use per-variation context if available, otherwise fall back to global
        per_var_ids = prompt_data.get("recommended_context_ids", [])
        if per_var_ids:
            variation_context = [
                context_image_map[img_id]
                for img_id in per_var_ids
                if img_id in context_image_map
            ]
            logger.info(f"[CONTEXT TRACE] Prompt #{i+1}: using {len(variation_context)} per-variation context: {per_var_ids}")
        else:
            # No per-variation context assigned - use no context (not global fallback)
            variation_context = None
            logger.info(f"[CONTEXT TRACE] Prompt #{i+1}: no per-variation context assigned, using 0 context images")

        tasks.append(
            _generate_single_image(
                prompt_data.get("text", ""),
                i,
                title=req.title,
                context_images=variation_context,
                image_size=req.image_size,
                aspect_ratio=req.aspect_ratio,
                seed=req.seed,
                safety_level=req.safety_level,
                thinking_level=req.thinking_level,
                temperature=req.temperature,
                google_search_grounding=req.google_search_grounding,
            )
        )
    results = await asyncio.gather(*tasks)

    # Process results and add metadata from prompts
    images = []
    errors = []
    for i, result in enumerate(results):
        if result.get("success"):
            del result["success"]
            # Add mood, title, and design from original prompt data if available
            if i < len(req.prompts):
                result["mood"] = req.prompts[i].get("mood", "")
                result["variation_title"] = req.prompts[i].get("title", "")  # Short variation title
                result["variation_type"] = "user-edited"
                # Add design tags if passed from frontend
                if "design" in req.prompts[i]:
                    result["design_tags"] = _flatten_design(req.prompts[i]["design"])
                    result["annotations"] = req.prompts[i]["design"]
                # Add design dimensions if passed from frontend
                if "design_dimensions" in req.prompts[i]:
                    # Convert list to dict keyed by axis for easy access
                    dims_list = req.prompts[i]["design_dimensions"]
                    if dims_list:
                        result["design_dimensions"] = {
                            dim["axis"]: dim for dim in dims_list
                        }
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
        "context_image_ids": req.context_image_ids,
        "session_id": req.session_id,
        "created_at": datetime.now().isoformat(),
        "images": images,
        "generation_mode": "two-phase",  # Mark as two-phase generation
        "base_prompt": req.base_prompt,  # Original prompt that generated variations
    }

    # Atomically append to fresh metadata (prevents race condition with concurrent requests)
    async with _metadata_manager.atomic() as fresh_metadata:
        fresh_metadata["prompts"].append(prompt_entry)

    # Queue images for background indexing (semantic search)
    if config.ENABLE_SEARCH:
        indexer = get_background_indexer(IMAGES_DIR)
        for img in images:
            indexer.queue_for_indexing(
                image_id=img["id"],
                image_path=img["image_path"],
                prompt_id=prompt_id,
                prompt_text=img.get("varied_prompt", ""),
            )

    logger.info(f"Generated {len(images)} images from prompts, prompt_id={prompt_id}")

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
    """Delete a prompt and all its images.

    If this is a concept prompt (is_concept=True), also cleans up the
    associated token's concept references to keep them in sync.
    """
    metadata = load_metadata()
    deleted_token_id = None

    # Get vector store if search is enabled
    vector_store = None
    if config.ENABLE_SEARCH:
        from backend.search.vector_store import get_vector_store
        vector_store = get_vector_store(IMAGES_DIR / "search_index")

    for i, prompt in enumerate(metadata.get("prompts", [])):
        if prompt["id"] == prompt_id:
            # Delete all image files and remove from favorites
            for img in prompt.get("images", []):
                _metadata_manager.delete_image_file(
                    metadata, img["id"], img.get("image_path")
                )
                # Remove from search index
                if vector_store:
                    vector_store.delete_image(img["id"])

            # If this is a concept prompt, clean up the linked token's references
            if prompt.get("is_concept"):
                tokens = metadata.get("tokens", [])
                for token in tokens:
                    if token.get("concept_prompt_id") == prompt_id:
                        # Clear concept references from the token
                        token["concept_prompt_id"] = None
                        token["concept_image_id"] = None
                        token["concept_image_path"] = None
                        deleted_token_id = token["id"]
                        logger.info(f"Cleared concept references from token: {token['id']}")
                        break

            # Remove prompt
            metadata["prompts"].pop(i)
            save_metadata(metadata)
            logger.info(f"Deleted prompt: {prompt_id}")
            return {"success": True, "deleted_id": prompt_id, "updated_token_id": deleted_token_id}

    raise HTTPException(status_code=404, detail="Prompt not found")


class BatchDeletePromptsRequest(BaseModel):
    prompt_ids: list[str]


@app.post("/api/batch/delete-prompts")
async def batch_delete_prompts(req: BatchDeletePromptsRequest):
    """Delete multiple prompts and all their images.

    If any are concept prompts, cleans up the linked token references.
    """
    metadata = load_metadata()
    deleted_ids = []
    updated_token_ids = []
    errors = []

    # Get vector store if search is enabled
    vector_store = None
    if config.ENABLE_SEARCH:
        from backend.search.vector_store import get_vector_store
        vector_store = get_vector_store(IMAGES_DIR / "search_index")

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
                    # Remove from search index
                    if vector_store:
                        vector_store.delete_image(img["id"])

                # If this is a concept prompt, clean up the linked token's references
                if prompt.get("is_concept"):
                    tokens = metadata.get("tokens", [])
                    for token in tokens:
                        if token.get("concept_prompt_id") == prompt_id:
                            token["concept_prompt_id"] = None
                            token["concept_image_id"] = None
                            token["concept_image_path"] = None
                            updated_token_ids.append(token["id"])
                            logger.info(f"Cleared concept references from token: {token['id']}")
                            break

                # Remove prompt
                metadata["prompts"].pop(i)
                deleted_ids.append(prompt_id)
                logger.info(f"Batch deleted prompt: {prompt_id}")
                break

        if not found:
            errors.append(f"Prompt not found: {prompt_id}")

    save_metadata(metadata)
    return {"success": True, "deleted_ids": deleted_ids, "updated_token_ids": updated_token_ids, "errors": errors}


@app.delete("/api/images/{image_id}")
async def delete_image(image_id: str):
    """Delete a single image from a prompt.

    If the image is a concept image for a token, also clears the token's
    concept references to keep them in sync.
    """
    metadata = load_metadata()
    updated_token_id = None

    for prompt in metadata.get("prompts", []):
        for i, img in enumerate(prompt.get("images", [])):
            if img["id"] == image_id:
                # Delete file and remove from favorites
                _metadata_manager.delete_image_file(
                    metadata, image_id, img.get("image_path")
                )

                # Remove from search index
                if config.ENABLE_SEARCH:
                    from backend.search.vector_store import get_vector_store
                    vector_store = get_vector_store(IMAGES_DIR / "search_index")
                    vector_store.delete_image(image_id)

                # Remove from prompt
                prompt["images"].pop(i)

                # If this is a concept image, clear the linked token's references
                tokens = metadata.get("tokens", [])
                for token in tokens:
                    if token.get("concept_image_id") == image_id:
                        token["concept_prompt_id"] = None
                        token["concept_image_id"] = None
                        token["concept_image_path"] = None
                        updated_token_id = token["id"]
                        logger.info(f"Cleared concept references from token: {token['id']}")
                        break

                save_metadata(metadata)
                return {"success": True, "deleted_id": image_id, "updated_token_id": updated_token_id}

    raise HTTPException(status_code=404, detail="Image not found")


@app.patch("/api/images/{image_id}/notes")
async def update_image_notes(image_id: str, req: ImageNotesRequest):
    """Update notes and/or annotation for an image."""
    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                # Update notes and annotation
                if req.notes is not None:
                    img["notes"] = req.notes
                if req.annotation is not None:
                    img["annotation"] = req.annotation
                    # Remove old "caption" field if present (migration)
                    img.pop("caption", None)

                save_metadata(metadata)
                return {
                    "id": image_id,
                    "notes": img.get("notes", ""),
                    "annotation": img.get("annotation") or img.get("caption", ""),
                }

    raise HTTPException(status_code=404, detail="Image not found")


@app.post("/api/upload")
async def upload_images(
    files: list[UploadFile] = File(...),
    title: str = Form("Uploaded Images"),
):
    """Upload custom images to create a new prompt."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    metadata = load_metadata()
    prompt_id = f"upload-{uuid.uuid4().hex[:8]}"
    images = []

    # HEIC may have non-standard content types from browsers
    ALLOWED_IMAGE_TYPES = {"image/", "application/octet-stream"}
    HEIC_EXTENSIONS = {".heic", ".heif"}

    for file in files:
        # Validate file type - allow HEIC even with generic content-type
        filename_ext = Path(file.filename or "").suffix.lower()
        content_type = file.content_type or ""
        is_image = content_type.startswith("image/")
        is_heic_file = filename_ext in HEIC_EXTENSIONS
        is_generic_binary = content_type == "application/octet-stream"

        if not (is_image or (is_heic_file and is_generic_binary)):
            continue

        # Read file content
        content = await file.read()

        # Detect actual MIME type from file bytes
        detected_mime_type = _detect_image_mime_type(content)

        # Convert HEIC/HEIF to JPEG for browser compatibility
        # Browsers don't support HEIC natively
        if detected_mime_type in ("image/heic", "image/heif", "image/avif"):
            content, detected_mime_type = _convert_heic_to_jpeg(content)
            ext = ".jpg"
        else:
            ext = Path(file.filename or "image.png").suffix or ".png"

        # Generate unique filename and save
        image_id = f"img-{uuid.uuid4().hex[:8]}"
        filename = f"{image_id}{ext}"
        image_path = IMAGES_DIR / filename
        image_path.write_bytes(content)

        images.append({
            "id": image_id,
            "image_path": filename,
            "mime_type": detected_mime_type,
            "created_at": datetime.now().isoformat(),
        })

    if not images:
        raise HTTPException(status_code=400, detail="No valid images uploaded")

    # Create prompt entry
    prompt_entry = {
        "id": prompt_id,
        "title": title,
        "prompt": f"Uploaded {len(images)} image(s)",
        "created_at": datetime.now().isoformat(),
        "images": images,
    }

    # Atomically append to fresh metadata (prevents race condition with concurrent requests)
    async with _metadata_manager.atomic() as fresh_metadata:
        fresh_metadata["prompts"].append(prompt_entry)

    # Queue uploaded images for background indexing (semantic search)
    if config.ENABLE_SEARCH:
        indexer = get_background_indexer(IMAGES_DIR)
        for img in images:
            indexer.queue_for_indexing(
                image_id=img["id"],
                image_path=img["image_path"],
                prompt_id=prompt_id,
                prompt_text="",  # Uploaded images have no prompt text
            )

    logger.info(f"Uploaded {len(images)} images as prompt: {prompt_id}")

    return {
        "success": True,
        "prompt_id": prompt_id,
        "images": images,
    }


class AnalyzeRequest(BaseModel):
    url: str


class ImportUrlRequest(BaseModel):
    url: str
    tags: list[str] = []
    pageUrl: str | None = None  # Source page where image was found


@app.post("/api/import-url")
async def import_image_from_url(req: ImportUrlRequest):
    """Import an image from a URL (used by extension and other clients)."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(req.url) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch image")
                image_bytes = await resp.read()
                mime_type = resp.headers.get("Content-Type", "image/jpeg")

        # Generate filename
        ext = ".png" if "png" in mime_type else ".jpg"
        image_id = f"scout-{uuid.uuid4().hex[:8]}"
        filename = f"{image_id}{ext}"
        image_path = IMAGES_DIR / filename
        image_path.write_bytes(image_bytes)

        # Save Metadata (Create a prompt entry for it)
        prompt_entry = {
            "id": f"prompt-{image_id}",
            "title": "Saved from Scout",
            "prompt": f"Imported from {req.pageUrl or 'web'}",
            "created_at": datetime.now().isoformat(),
            "images": [{
                "id": image_id,
                "image_path": filename,
                "mime_type": mime_type,
                "created_at": datetime.now().isoformat(),
                "tags": req.tags,
                "source_url": req.url,
                "page_url": req.pageUrl
            }]
        }

        async with _metadata_manager.atomic() as fresh_metadata:
            fresh_metadata["prompts"].append(prompt_entry)

        logger.info(f"Imported image from URL: {image_id}")
        return {"success": True, "id": image_id}
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Import from URL failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
                "use_for": "User-generated image",
                "prompt_id": prompt["id"],
            })
    return {"images": all_images}


# ============================================================
# Design Tokens
# ============================================================

class DesignDimensionData(BaseModel):
    """A design dimension for token creation."""
    axis: str
    name: str
    description: str
    tags: list[str]
    generation_prompt: str
    commonality: str | None = None


class CreateTokenRequest(BaseModel):
    """Request for creating a design token."""
    name: str
    description: str | None = None
    image_ids: list[str]
    prompts: list[str] = []
    creation_method: Literal["ai-extraction", "manual"]

    # For AI extraction only
    dimension: DesignDimensionData | None = None
    generate_concept: bool = False
    concept_prompt: str | None = None  # Frontend constructs the prompt

    # Categorization
    category: str | None = None
    tags: list[str] = []


def _build_token_image(img_data: dict) -> dict:
    """Build a DesignTokenImage from image data."""
    return {
        "id": img_data["id"],
        "annotation": img_data.get("annotation"),
        "liked_axes": img_data.get("liked_axes"),
        "image_path": img_data.get("image_path"),
    }


def _find_image_data(metadata: dict, image_id: str) -> tuple[dict | None, Path | None]:
    """Find image data and path by ID."""
    for prompt_data in metadata.get("prompts", []):
        for img in prompt_data.get("images", []):
            if img["id"] == image_id:
                return img, IMAGES_DIR / img["image_path"]
    return None, None


@app.get("/api/tokens")
async def list_tokens():
    """List all design tokens."""
    metadata = load_metadata()
    return {"tokens": metadata.get("tokens", [])}


@app.post("/api/tokens")
async def create_token(req: CreateTokenRequest):
    """Create a new design token (manual or from extraction)."""
    metadata = load_metadata()
    if "tokens" not in metadata:
        metadata["tokens"] = []

    # Build token images from image IDs
    token_images = []
    for image_id in req.image_ids:
        img_data, _ = _find_image_data(metadata, image_id)
        if img_data:
            token_images.append(_build_token_image(img_data))

    if not token_images:
        raise HTTPException(status_code=400, detail="No valid images found")

    token_id = f"tok-{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    token = {
        "id": token_id,
        "name": req.name,
        "description": req.description,
        "created_at": now,
        "use_count": 0,
        "images": token_images,
        "prompts": req.prompts,
        "creation_method": req.creation_method,
        "category": req.category,
        "tags": req.tags,
    }

    # Add extraction metadata for AI-extracted tokens
    if req.creation_method == "ai-extraction" and req.dimension:
        token["extraction"] = {
            "dimension": req.dimension.model_dump(),
            "generation_prompt": req.dimension.generation_prompt,
        }
        # Add dimension prompt to token prompts
        if req.dimension.generation_prompt and req.dimension.generation_prompt not in req.prompts:
            token["prompts"].append(req.dimension.generation_prompt)
        # Use dimension axis as category if not specified
        if not req.category:
            token["category"] = req.dimension.axis
        # Use dimension tags if not specified
        if not req.tags:
            token["tags"] = req.dimension.tags

    # Generate concept image if requested (frontend provides the prompt)
    if req.generate_concept and req.concept_prompt:
        try:
            dimension_dict = req.dimension.model_dump() if req.dimension else {}

            # Get source image to reference during concept generation
            source_image_bytes = None
            source_mime_type = "image/jpeg"
            if token_images:
                first_image = token_images[0]
                if first_image.get("image_path"):
                    source_path = IMAGES_DIR / first_image["image_path"]
                    if source_path.exists():
                        source_image_bytes = source_path.read_bytes()
                        # Determine mime type from extension
                        ext = source_path.suffix.lower()
                        if ext == ".png":
                            source_mime_type = "image/png"
                        elif ext in (".jpg", ".jpeg"):
                            source_mime_type = "image/jpeg"

            result = await gemini.generate_concept_image(
                prompt=req.concept_prompt,
                aspect_ratio="1:1",
                source_image_bytes=source_image_bytes,
                source_image_mime_type=source_mime_type,
            )
            if result.images:
                # Save concept image
                concept_filename = f"concept-{uuid.uuid4().hex[:8]}.jpg"
                concept_path = IMAGES_DIR / concept_filename
                # Decode base64 string to bytes before writing
                image_data = base64.b64decode(result.images[0]["data"])
                concept_path.write_bytes(image_data)
                token["concept_image_path"] = concept_filename
                token["concept_image_id"] = f"concept-{token_id}"
                token["concept_prompt_id"] = f"concept-prompt-{token_id}"

                # Create full Prompt entry for the concept image (same metadata as regular images)
                # Include source image IDs as context so they appear in the Context section
                source_image_ids = [img["id"] for img in token_images] if token_images else []
                concept_prompt = {
                    "id": f"concept-prompt-{token_id}",
                    "prompt": dimension_dict.get("generation_prompt", ""),
                    "title": f"Concept: {dimension_dict.get('name', 'Untitled')}",
                    "created_at": now,
                    "context_image_ids": source_image_ids,
                    "images": [
                        {
                            "id": f"concept-{token_id}",
                            "image_path": concept_filename,
                            "mime_type": "image/jpeg",
                            "generated_at": now,
                            "varied_prompt": dimension_dict.get("generation_prompt", ""),
                            "variation_title": dimension_dict.get("name", ""),
                            "variation_type": "concept",
                            "design_dimensions": {
                                dimension_dict.get("axis", "concept"): dimension_dict
                            },
                        }
                    ],
                    "is_concept": True,
                    "concept_axis": dimension_dict.get("axis"),
                    "source_image_id": token_images[0]["id"] if token_images else None,
                }
                # Store concept prompt to add during atomic save
                token["_concept_prompt"] = concept_prompt
                logger.info(f"Generated concept image for token: {concept_filename}")
        except Exception as e:
            logger.warning(f"Failed to generate concept image: {e}")
            # Continue without concept image

    # Atomically append to fresh metadata (prevents race condition with concurrent requests)
    concept_prompt_to_add = token.pop("_concept_prompt", None)
    async with _metadata_manager.atomic() as fresh_metadata:
        if "tokens" not in fresh_metadata:
            fresh_metadata["tokens"] = []
        fresh_metadata["tokens"].append(token)
        if concept_prompt_to_add:
            fresh_metadata["prompts"].append(concept_prompt_to_add)

    logger.info(f"Created token: {token_id} - {req.name} ({req.creation_method})")
    return {"success": True, "token": token}


@app.delete("/api/tokens/{token_id}")
async def delete_token(token_id: str):
    """Delete a design token and its associated concept prompt/image."""
    metadata = load_metadata()
    tokens = metadata.get("tokens", [])

    for i, token in enumerate(tokens):
        if token["id"] == token_id:
            # Also delete associated concept prompt if it exists
            concept_prompt_id = token.get("concept_prompt_id")
            if concept_prompt_id:
                prompts = metadata.get("prompts", [])
                for j, prompt in enumerate(prompts):
                    if prompt["id"] == concept_prompt_id:
                        # Delete concept image files
                        for img in prompt.get("images", []):
                            _metadata_manager.delete_image_file(
                                metadata, img["id"], img.get("image_path")
                            )
                        prompts.pop(j)
                        logger.info(f"Deleted concept prompt: {concept_prompt_id}")
                        break

            tokens.pop(i)
            save_metadata(metadata)
            logger.info(f"Deleted token: {token_id}")
            return {"success": True, "deleted_concept_prompt": concept_prompt_id}

    raise HTTPException(status_code=404, detail="Token not found")


@app.post("/api/tokens/{token_id}/use")
async def use_token(token_id: str):
    """Increment use count for a token."""
    metadata = load_metadata()
    for token in metadata.get("tokens", []):
        if token["id"] == token_id:
            token["use_count"] = token.get("use_count", 0) + 1
            token["last_used"] = datetime.now().isoformat()
            save_metadata(metadata)
            return {"success": True, "token": token}
    raise HTTPException(status_code=404, detail="Token not found")


class GenerateConceptRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "1:1"


@app.post("/api/tokens/{token_id}/generate-concept")
async def generate_token_concept(token_id: str, request: GenerateConceptRequest):
    """Generate a concept image for an existing token.

    Frontend constructs the prompt using templates and dimension data.

    Uses a two-phase approach to avoid race conditions when multiple
    concept images are generated concurrently:
    1. Read phase: Load metadata (no lock) to get token data
    2. Generate phase: Call Gemini API (slow, no lock held)
    3. Write phase: Use context manager with file lock to atomically update metadata
    """
    # Phase 1: Read token data needed for generation (no lock needed)
    metadata = load_metadata()
    token_data = None
    for token in metadata.get("tokens", []):
        if token["id"] == token_id:
            token_data = token
            break

    if token_data is None:
        raise HTTPException(status_code=404, detail="Token not found")

    extraction = token_data.get("extraction")
    if not extraction:
        raise HTTPException(
            status_code=400,
            detail="Token has no extraction dimension - cannot generate concept"
        )

    # Get source image from token to reference during generation
    source_image_bytes = None
    source_mime_type = "image/jpeg"
    token_images = token_data.get("images", [])
    source_image_ids = [img["id"] for img in token_images] if token_images else []
    if token_images:
        first_image = token_images[0]
        image_path = first_image.get("image_path")
        if image_path:
            source_path = IMAGES_DIR / image_path
            if source_path.exists():
                source_image_bytes = source_path.read_bytes()
                ext = source_path.suffix.lower()
                if ext == ".png":
                    source_mime_type = "image/png"
                elif ext in (".jpg", ".jpeg"):
                    source_mime_type = "image/jpeg"

    dimension_dict = extraction.get("dimension", {})

    # Phase 2: Generate image (slow operation, no lock held)
    try:
        result = await gemini.generate_concept_image(
            prompt=request.prompt,
            aspect_ratio=request.aspect_ratio,
            source_image_bytes=source_image_bytes,
            source_image_mime_type=source_mime_type,
        )
    except Exception as e:
        logger.error(f"Concept generation failed: {e}")
        return {"success": False, "error": str(e)}

    if not result.images:
        return {"success": False, "error": "No image generated"}

    # Save generated image to disk (before acquiring lock)
    concept_filename = f"concept-{uuid.uuid4().hex[:8]}.jpg"
    concept_path = IMAGES_DIR / concept_filename
    image_data = base64.b64decode(result.images[0]["data"])
    concept_path.write_bytes(image_data)

    # Phase 3: Atomically update metadata with async file lock
    # Uses async context manager to avoid blocking event loop while waiting for lock
    async with _metadata_manager.atomic() as fresh_metadata:
        # Find token again in fresh metadata (may have changed during generation)
        for token in fresh_metadata.get("tokens", []):
            if token["id"] == token_id:
                token["concept_image_path"] = concept_filename
                token["concept_image_id"] = f"concept-{token_id}"
                token["concept_prompt_id"] = f"concept-prompt-{token_id}"

                # Create full Prompt entry for the concept image
                now = datetime.now().isoformat()
                concept_prompt = {
                    "id": f"concept-prompt-{token_id}",
                    "prompt": dimension_dict.get("generation_prompt", ""),
                    "title": f"Concept: {dimension_dict.get('name', 'Untitled')}",
                    "created_at": now,
                    "context_image_ids": source_image_ids,
                    "images": [
                        {
                            "id": f"concept-{token_id}",
                            "image_path": concept_filename,
                            "mime_type": "image/jpeg",
                            "generated_at": now,
                            "varied_prompt": dimension_dict.get("generation_prompt", ""),
                            "variation_title": dimension_dict.get("name", ""),
                            "variation_type": "concept",
                            "design_dimensions": {
                                dimension_dict.get("axis", "concept"): dimension_dict
                            },
                        }
                    ],
                    "is_concept": True,
                    "concept_axis": dimension_dict.get("axis"),
                    "source_image_id": token_images[0]["id"] if token_images else None,
                }
                # Remove old concept prompt if regenerating
                fresh_metadata["prompts"] = [
                    p for p in fresh_metadata.get("prompts", [])
                    if p.get("id") != f"concept-prompt-{token_id}"
                ]
                fresh_metadata["prompts"].append(concept_prompt)
                break

    logger.info(f"Generated concept image: {concept_filename}")
    return {
        "success": True,
        "concept_image_path": concept_filename,
        "concept_image_id": f"concept-{token_id}",
    }


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
# TASTE EXPORT: Portable Design Token Library
# ============================================================

try:
    from backend.taste_exporter import compile_taste_export, export_to_dict
except ImportError:
    from taste_exporter import compile_taste_export, export_to_dict


@app.get("/api/export/taste")
async def export_taste_profile(include_images: bool = False):
    """Export all design tokens as JSON.

    Returns the full design token library with optional base64-encoded images.
    """
    metadata = load_metadata()

    export = compile_taste_export(
        metadata,
        include_images=include_images,
        images_dir=IMAGES_DIR if include_images else None,
    )

    return export_to_dict(export)


@app.get("/api/export/taste/zip")
async def export_taste_with_images():
    """Export design tokens + images as ZIP."""
    metadata = load_metadata()

    export = compile_taste_export(
        metadata,
        include_images=False,  # We'll add images to ZIP separately
        images_dir=None,
    )

    # Create ZIP with JSON + images
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add manifest
        zf.writestr("taste-profile.json", json.dumps(export_to_dict(export), indent=2))

        # Add token images
        for token in export.tokens:
            # Add source images
            for img in token.images:
                if img.image_path:
                    img_path = IMAGES_DIR / img.image_path
                    if img_path.exists():
                        zf.write(img_path, f"images/{img.image_path}")

            # Add concept image
            if token.concept_image_path:
                concept_path = IMAGES_DIR / token.concept_image_path
                if concept_path.exists():
                    zf.write(concept_path, f"concepts/{token.concept_image_path}")

    zip_buffer.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="design-tokens-{timestamp}.zip"'
        }
    )


@app.post("/api/batch/download")
async def batch_download_images(req: BatchDownloadRequest):
    """Download multiple images as a ZIP file."""
    metadata = load_metadata()

    # Build map of all images
    image_map: dict[str, dict] = {}
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            image_map[img["id"]] = img

    # Find requested images
    found_images = []
    for img_id in req.image_ids:
        if img_id in image_map:
            found_images.append(image_map[img_id])

    if not found_images:
        raise HTTPException(status_code=404, detail="No images found")

    # Create ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for img in found_images:
            img_path = IMAGES_DIR / img["image_path"]
            if img_path.exists():
                # Use original filename or generate one
                filename = img["image_path"]
                zf.write(img_path, filename)

    zip_buffer.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="pageant-images-{timestamp}.zip"'
        }
    )


# ============================================================
# FEATURE 3: Batch Operations
# ============================================================

@app.post("/api/batch/delete")
async def batch_delete_images(req: BatchDeleteRequest):
    """Delete multiple images at once.

    If any images are concept images for tokens, also clears the token's
    concept references to keep them in sync.
    """
    metadata = load_metadata()
    deleted = []
    not_found = []
    updated_token_ids = []

    # Get vector store once if search is enabled
    vector_store = None
    if config.ENABLE_SEARCH:
        from backend.search.vector_store import get_vector_store
        vector_store = get_vector_store(IMAGES_DIR / "search_index")

    for image_id in req.image_ids:
        found = False
        for prompt in metadata.get("prompts", []):
            for i, img in enumerate(prompt.get("images", [])):
                if img["id"] == image_id:
                    # Delete file and remove from favorites
                    _metadata_manager.delete_image_file(
                        metadata, image_id, img.get("image_path")
                    )

                    # Remove from search index
                    if vector_store:
                        vector_store.delete_image(image_id)

                    # Remove from prompt
                    prompt["images"].pop(i)
                    deleted.append(image_id)
                    found = True

                    # If this is a concept image, clear the linked token's references
                    tokens = metadata.get("tokens", [])
                    for token in tokens:
                        if token.get("concept_image_id") == image_id:
                            token["concept_prompt_id"] = None
                            token["concept_image_id"] = None
                            token["concept_image_path"] = None
                            updated_token_ids.append(token["id"])
                            logger.info(f"Cleared concept references from token: {token['id']}")
                            break

                    break
            if found:
                break
        if not found:
            not_found.append(image_id)

    save_metadata(metadata)
    logger.info(f"Batch deleted {len(deleted)} images")
    return {"success": True, "deleted": deleted, "not_found": not_found, "updated_token_ids": updated_token_ids}


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
    regen_title = target_prompt.get("title", "Untitled")
    tasks = [
        _generate_single_image(
            target_prompt["prompt"],
            i,
            title=regen_title,
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
        # Atomically update fresh metadata (prevents race condition with concurrent requests)
        async with _metadata_manager.atomic() as fresh_metadata:
            # Find the prompt again in fresh metadata
            for prompt in fresh_metadata.get("prompts", []):
                if prompt["id"] == prompt_id:
                    prompt["images"].extend(new_images)
                    break
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


class LikeDimensionRequest(BaseModel):
    axis: str  # The dimension axis (colors, composition, layout, aesthetic)
    liked: bool  # True to add, False to remove


@app.patch("/api/images/{image_id}/like-dimension")
async def toggle_dimension_like(image_id: str, req: LikeDimensionRequest):
    """Toggle dimension preference for a specific axis on an image.

    liked_dimension_axes is an array of axis strings that the user has liked.
    Supports multiple likes per image.
    """
    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                if "liked_dimension_axes" not in img:
                    img["liked_dimension_axes"] = []

                liked_axes = img["liked_dimension_axes"]

                if req.liked:
                    # Add axis if not present
                    if req.axis not in liked_axes:
                        liked_axes.append(req.axis)
                else:
                    # Remove axis if present
                    if req.axis in liked_axes:
                        liked_axes.remove(req.axis)

                save_metadata(metadata)
                logger.info(f"Updated dimension preference for {image_id}: {req.axis}={req.liked}, now liked: {liked_axes}")
                return {"success": True, "liked_dimension_axes": liked_axes}

    raise HTTPException(status_code=404, detail="Image not found")


@app.patch("/api/images/{image_id}/dimensions")
async def update_dimensions(image_id: str, req: UpdateDimensionsRequest):
    """Update design dimensions for an image.

    Used to:
    - Confirm auto-suggested dimensions
    - Edit dimension metadata
    - Add user-created dimensions
    """
    metadata = load_metadata()

    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img["id"] == image_id:
                # Convert Pydantic models to dicts for JSON storage
                img["design_dimensions"] = {
                    axis: dim.model_dump()
                    for axis, dim in req.dimensions.items()
                }
                save_metadata(metadata)
                logger.info(f"Updated design dimensions for {image_id}")
                return {"id": image_id, "design_dimensions": img["design_dimensions"]}

    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/api/preferences")
async def get_design_preferences():
    """Get aggregated design preferences across all rated images.

    liked_axes format: { axis: ["tag1", "tag2"] }
    Returns count of each tag that was liked.
    """
    metadata = load_metadata()

    # Dynamically collect preferences from liked_axes
    preferences = {}
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
                    # Dynamically create axis entry if needed
                    if axis not in preferences:
                        preferences[axis] = {}
                    # Count each liked tag
                    for tag in tags:
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


@app.get("/api/settings")
async def get_settings():
    """Get app settings including image generation defaults."""
    metadata = load_metadata()
    settings = metadata.get("settings", {})
    return {
        "text_model": config.DEFAULT_TEXT_MODEL,
        "image_model": config.DEFAULT_IMAGE_MODEL,
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


# =============================================================================
# Search API Endpoints
# =============================================================================


class SearchRequest(BaseModel):
    """Request for semantic image search."""
    query: str
    limit: int = 50
    mode: Literal["text", "semantic"] = "semantic"


class SearchResult(BaseModel):
    """A single search result."""
    id: str
    image_path: str
    prompt_id: str
    score: float  # 0-1 similarity score


class SearchResponse(BaseModel):
    """Response from search endpoints."""
    success: bool
    results: list[SearchResult] = []
    error: Optional[str] = None


@app.post("/api/search", response_model=SearchResponse)
async def search_images(req: SearchRequest):
    """Search images by text query using semantic embeddings."""
    if not config.ENABLE_SEARCH:
        return SearchResponse(success=False, error="Search is disabled (ENABLE_SEARCH=false)")

    if not req.query.strip():
        return SearchResponse(success=True, results=[])

    try:
        search_service = get_search_service(IMAGES_DIR)
        results = search_service.search_by_text(req.query, limit=req.limit)

        return SearchResponse(
            success=True,
            results=[
                SearchResult(
                    id=r.id,
                    image_path=r.image_path,
                    prompt_id=r.prompt_id,
                    score=r.score,
                )
                for r in results
            ],
        )
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return SearchResponse(success=False, error=str(e))


@app.get("/api/search/similar/{image_id}", response_model=SearchResponse)
async def find_similar_images(image_id: str, limit: int = 20):
    """Find images similar to a given image (image-to-image search)."""
    if not config.ENABLE_SEARCH:
        return SearchResponse(success=False, error="Search is disabled (ENABLE_SEARCH=false)")

    try:
        metadata = load_metadata()
        img_data, img_path = _find_image_by_id(metadata, image_id)

        if not img_data or not img_path:
            return SearchResponse(success=False, error="Image not found")

        search_service = get_search_service(IMAGES_DIR)
        results = search_service.search_by_image(
            image_id=image_id,
            image_path=img_data.get("image_path", ""),
            limit=limit,
        )

        return SearchResponse(
            success=True,
            results=[
                SearchResult(
                    id=r.id,
                    image_path=r.image_path,
                    prompt_id=r.prompt_id,
                    score=r.score,
                )
                for r in results
            ],
        )
    except Exception as e:
        logger.error(f"Similar search failed: {e}")
        return SearchResponse(success=False, error=str(e))


class IndexRequest(BaseModel):
    """Request to trigger indexing."""
    image_ids: Optional[list[str]] = None  # If None, index all missing


@app.post("/api/search/index")
async def trigger_indexing(req: IndexRequest):
    """Trigger indexing for specific images or all missing images."""
    if not config.ENABLE_SEARCH:
        return {"success": False, "error": "Search is disabled (ENABLE_SEARCH=false)"}

    try:
        metadata = load_metadata()
        search_service = get_search_service(IMAGES_DIR)
        indexed_ids = search_service.get_indexed_ids()

        images_to_index = []

        if req.image_ids:
            # Index specific images
            for img_id in req.image_ids:
                img_data, img_path = _find_image_by_id(metadata, img_id)
                if img_data and img_path:
                    # Find the prompt this image belongs to
                    for prompt in metadata.get("prompts", []):
                        for img in prompt.get("images", []):
                            if img.get("id") == img_id:
                                images_to_index.append({
                                    "id": img_id,
                                    "image_path": img.get("image_path", ""),
                                    "prompt_id": prompt.get("id", ""),
                                    "prompt_text": img.get("varied_prompt", ""),
                                })
                                break
        else:
            # Index all missing images
            for prompt in metadata.get("prompts", []):
                for img in prompt.get("images", []):
                    img_id = img.get("id")
                    if img_id and img_id not in indexed_ids:
                        images_to_index.append({
                            "id": img_id,
                            "image_path": img.get("image_path", ""),
                            "prompt_id": prompt.get("id", ""),
                            "prompt_text": img.get("varied_prompt", ""),
                        })

        if images_to_index:
            indexer = get_background_indexer(IMAGES_DIR)
            count = indexer.queue_multiple(images_to_index)
            logger.info(f"Queued {count} images for indexing")
            return {"success": True, "queued": count}

        return {"success": True, "queued": 0, "message": "No images to index"}

    except Exception as e:
        logger.error(f"Index trigger failed: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/search/indexed")
async def get_indexed_image_ids():
    """Get all indexed image IDs for frontend status indicator."""
    if not config.ENABLE_SEARCH:
        return {"success": True, "indexed_ids": [], "disabled": True}

    try:
        search_service = get_search_service(IMAGES_DIR)
        indexed_ids = list(search_service.get_indexed_ids())
        return {"success": True, "indexed_ids": indexed_ids}
    except Exception as e:
        logger.error(f"Failed to get indexed IDs: {e}")
        return {"success": False, "indexed_ids": [], "error": str(e)}


@app.get("/api/search/stats")
async def get_search_stats():
    """Get search index statistics."""
    if not config.ENABLE_SEARCH:
        return {"success": True, "disabled": True, "indexed_count": 0, "pending_count": 0}

    try:
        search_service = get_search_service(IMAGES_DIR)
        stats = search_service.get_stats()
        indexer = get_background_indexer(IMAGES_DIR)

        return {
            "success": True,
            "indexed_count": stats["indexed_count"],
            "embedding_dim": stats["embedding_dim"],
            "pending_count": indexer.pending_count,
            "indexer_running": indexer.is_running,
        }
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        return {"success": False, "error": str(e)}


# Serve static files
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# Ensure preferences directory exists for preference images
PREF_DIR = IMAGES_DIR / "preferences"
PREF_DIR.mkdir(exist_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
