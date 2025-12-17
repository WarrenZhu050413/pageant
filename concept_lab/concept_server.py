#!/usr/bin/env python3
"""Enhanced Concept Isolation Server v2.0

Architecture:
1. User provides image + optional design dimensions
2. If no dimensions specified, Gemini suggests 4-5 relevant design dimensions
3. For each dimension, generate a pure concept reference image

Runs on port 8766 to avoid conflict with main pageant backend (8765).
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

# Google Generative AI
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

# Known design axes from pageant's design system
KNOWN_AXES = ['colors', 'composition', 'mood', 'layout', 'aesthetic', 'typeface_feel']
EXTENDED_AXES = ['lighting', 'texture', 'rhythm', 'depth', 'contrast', 'materiality', 'atmosphere']

# Default number of dimensions to suggest
DEFAULT_DIMENSION_COUNT = 5

# Model names (matching pageant backend)
TEXT_MODEL = "gemini-2.0-flash"
IMAGE_MODEL = "gemini-3-pro-image-preview"  # Same as pageant backend

# Output directory
OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def get_api_key() -> str:
    """Get Gemini API key from standard locations."""
    if api_key := os.environ.get("GEMINI_API_KEY"):
        return api_key.strip()
    key_path = Path.home() / ".gemini" / "apikey.txt"
    if key_path.exists():
        return key_path.read_text().strip()
    backup_path = Path.home() / ".gemini" / "apikey_backup.txt"
    if backup_path.exists():
        return backup_path.read_text().strip()
    raise ValueError("No Gemini API key found")


# Initialize client
client = genai.Client(api_key=get_api_key())

# =============================================================================
# Prompts (reusing pageant design vocabulary)
# =============================================================================

DIMENSION_ANALYSIS_PROMPT = """You are a visual design analyst. Analyze this image and identify the {count} most distinctive and interesting design dimensions.

For each dimension, provide:
1. **axis**: A design axis category. Use one of these known axes when appropriate:
   - colors: Color palette, temperature, saturation, contrast
   - composition: Framing, balance, lines, depth, negative space
   - mood: Emotional tone, atmosphere, narrative feeling
   - layout: Structure, density, flow, hierarchy
   - aesthetic: Style movement (art-deco, minimalist, etc.), era, approach
   - lighting: Light direction, quality, contrast, shadow character
   - texture: Surface quality, pattern, material feel

   You may also use custom axes like: rhythm, depth, contrast, materiality, atmosphere

2. **name**: An evocative 2-4 word name for this specific design concept (e.g., "Chiaroscuro Glow", "Urban Melancholia", "Brutalist Grid")

3. **description**: A detailed description (2-3 sentences) of this design dimension as it appears in the image. Be specific and evocative.

4. **tags**: 2-3 short tags from pageant's design vocabulary:
   - colors: monochromatic, complementary, warm, cool, vibrant, muted, high-contrast, moody-dark, light-airy
   - composition: rule-of-thirds, symmetrical, centered, diagonal-lines, negative-space, layered
   - mood: dramatic, serene, energetic, mysterious, elegant, contemplative, whimsical, bold, intimate, nostalgic
   - aesthetic: photorealistic, stylized, art-nouveau, art-deco, minimalist, maximalist, surreal, cinematic

5. **generation_prompt**: A prompt (2-3 sentences) to generate an abstract image that purely embodies this design concept, WITHOUT the original subject matter.

Focus on dimensions that are:
- Visually distinctive and reproducible
- Interesting enough to be used as design references
- Diverse from each other (don't pick 5 color-related dimensions)

Return ONLY valid JSON matching this schema:
{{
  "dimensions": [
    {{
      "axis": "string",
      "name": "string",
      "description": "string",
      "tags": ["string"],
      "generation_prompt": "string"
    }}
  ]
}}
"""

SINGLE_DIMENSION_PROMPT = """Analyze this image and describe the "{axis}" design dimension in detail.

For the {axis} dimension, provide:

1. **name**: An evocative 2-4 word name for how this dimension manifests in this image

2. **description**: A detailed description (2-3 sentences) focusing on:
   - Visual characteristics specific to {axis}
   - What makes this execution distinctive
   - The emotional or aesthetic impact

3. **tags**: 2-3 short descriptive tags (e.g., for colors: "warm", "muted", "high-contrast")

4. **generation_prompt**: A prompt (2-3 sentences) to generate an abstract image that purely embodies this {axis} concept, stripped of the original subject matter. Focus on recreating the pure visual essence.

Return ONLY valid JSON:
{{
  "name": "string",
  "description": "string",
  "tags": ["string"],
  "generation_prompt": "string"
}}
"""

CONCEPT_GENERATION_PROMPT = """Create an abstract, pure visual representation of this design concept:

**{dimension_name}** ({axis})

{description}

Specific guidance: {generation_prompt}

Requirements:
- Generate an abstract image that embodies ONLY this design dimension
- No recognizable objects, people, text, or specific scenes
- Focus on the pure visual essence: colors, shapes, textures, light, atmosphere
- This should work as a "design reference swatch" or "mood sample"
- Professional quality, visually striking
- Could be used as inspiration for applying this style to other work
"""

# =============================================================================
# Request/Response Models
# =============================================================================

class DesignDimension(BaseModel):
    """A single design dimension extracted from an image."""
    axis: str
    name: str
    description: str
    tags: list[str] = []
    generation_prompt: str


class AnalyzeDimensionsRequest(BaseModel):
    """Request to analyze an image and suggest design dimensions."""
    image_base64: str
    count: int = DEFAULT_DIMENSION_COUNT


class AnalyzeDimensionsResponse(BaseModel):
    """Response with suggested design dimensions."""
    dimensions: list[DesignDimension]


class ExtractDimensionRequest(BaseModel):
    """Request to extract a specific dimension from an image."""
    image_base64: str
    axis: str  # e.g., "lighting", "mood", "colors"


class GenerateConceptRequest(BaseModel):
    """Request to generate a concept image for a specific dimension."""
    dimension: DesignDimension
    aspect_ratio: str = "1:1"


class GenerateConceptResponse(BaseModel):
    """Response with generated concept image."""
    dimension: DesignDimension
    image_base64: str
    image_id: str


class ConceptResult(BaseModel):
    """Result for a single concept in the full pipeline."""
    dimension: DesignDimension
    image_base64: Optional[str] = None
    image_id: Optional[str] = None


class IsolateConceptsRequest(BaseModel):
    """Full pipeline: analyze image and generate concepts for each dimension.

    Two modes:
    1. dimensions=["lighting", "mood"] → Extract those specific axes
    2. dimensions=None, count=5 → Auto-suggest 5 interesting dimensions
    """
    image_base64: str
    dimensions: Optional[list[str]] = None  # Specific axes to extract
    count: int = DEFAULT_DIMENSION_COUNT    # How many to auto-suggest
    generate_images: bool = True            # Whether to generate concept images


class IsolateConceptsResponse(BaseModel):
    """Full response with all concepts."""
    mode: str  # "user_specified" or "auto_suggested"
    concepts: list[ConceptResult]


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="Concept Isolation Lab",
    description="Extract and generate pure design concept references from images",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Concept Isolation Lab v2.0",
        "endpoints": {
            "POST /api/analyze-dimensions": "Auto-suggest design dimensions from image",
            "POST /api/extract-dimension": "Extract a specific dimension from image",
            "POST /api/generate-concept": "Generate concept image for a dimension",
            "POST /api/isolate-concepts": "Full pipeline (analyze + generate)",
            "GET /api/axes": "List known design axes",
        }
    }


@app.get("/api/axes")
async def get_axes():
    """Get list of known design axes."""
    return {
        "known_axes": KNOWN_AXES,
        "extended_axes": EXTENDED_AXES,
        "description": {
            "colors": "Color palette, temperature, saturation, contrast",
            "composition": "Framing, balance, lines, depth, negative space",
            "mood": "Emotional tone, atmosphere, narrative feeling",
            "layout": "Structure, density, flow, hierarchy",
            "aesthetic": "Style movement, era, approach (minimalist, art-deco, etc.)",
            "typeface_feel": "Typography character if text is present",
            "lighting": "Light direction, quality, contrast, shadow character",
            "texture": "Surface quality, pattern, material feel",
        }
    }


@app.post("/api/analyze-dimensions", response_model=AnalyzeDimensionsResponse)
async def analyze_dimensions(request: AnalyzeDimensionsRequest):
    """Analyze an image and auto-suggest design dimensions to extract."""
    logger.info(f"Analyzing image for {request.count} dimensions...")

    try:
        image_bytes = base64.b64decode(request.image_base64)
        prompt = DIMENSION_ANALYSIS_PROMPT.format(count=request.count)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                types.Part.from_text(text=prompt)
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            )
        )

        result = json.loads(response.text)
        dimensions = [DesignDimension(**d) for d in result["dimensions"]]

        logger.info(f"Found {len(dimensions)} dimensions: {[d.name for d in dimensions]}")
        return AnalyzeDimensionsResponse(dimensions=dimensions)

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/extract-dimension", response_model=DesignDimension)
async def extract_dimension(request: ExtractDimensionRequest):
    """Extract a specific design dimension from an image."""
    logger.info(f"Extracting '{request.axis}' dimension...")

    try:
        image_bytes = base64.b64decode(request.image_base64)
        prompt = SINGLE_DIMENSION_PROMPT.format(axis=request.axis)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                types.Part.from_text(text=prompt)
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            )
        )

        result = json.loads(response.text)
        dimension = DesignDimension(axis=request.axis, **result)

        logger.info(f"Extracted: {dimension.name}")
        return dimension

    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/api/generate-concept", response_model=GenerateConceptResponse)
async def generate_concept(request: GenerateConceptRequest):
    """Generate a pure concept image for a specific dimension."""
    dim = request.dimension
    logger.info(f"Generating concept image for '{dim.name}' ({dim.axis})...")

    try:
        prompt = CONCEPT_GENERATION_PROMPT.format(
            dimension_name=dim.name,
            axis=dim.axis,
            description=dim.description,
            generation_prompt=dim.generation_prompt
        )

        # Use generate_content with IMAGE response modality (like pageant backend)
        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=request.aspect_ratio,
            ),
        )

        response = await client.aio.models.generate_content(
            model=IMAGE_MODEL,
            contents=prompt,
            config=config,
        )

        # Extract image from response
        image_data = None
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "inline_data") and part.inline_data:
                            if hasattr(part.inline_data, "data") and part.inline_data.data:
                                image_data = part.inline_data.data
                                break

        if not image_data:
            raise HTTPException(status_code=500, detail="No image generated in response")

        image_id = f"concept-{uuid.uuid4().hex[:8]}.jpg"
        image_path = OUTPUT_DIR / image_id
        image_path.write_bytes(image_data)

        image_b64 = base64.b64encode(image_data).decode()

        logger.info(f"Generated: {image_id}")
        return GenerateConceptResponse(
            dimension=dim,
            image_base64=image_b64,
            image_id=image_id
        )

    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/api/isolate-concepts", response_model=IsolateConceptsResponse)
async def isolate_concepts(request: IsolateConceptsRequest):
    """Full pipeline: analyze image → extract dimensions → generate concept images.

    Two modes:
    1. If `dimensions` provided (e.g., ["lighting", "mood"]): Extract those specific axes
    2. If `dimensions` is None: Auto-suggest `count` interesting dimensions
    """
    logger.info(f"Starting concept isolation pipeline...")
    logger.info(f"  Mode: {'user_specified' if request.dimensions else 'auto_suggested'}")
    logger.info(f"  Generate images: {request.generate_images}")

    concepts: list[ConceptResult] = []
    dimensions_to_process: list[DesignDimension] = []

    try:
        if request.dimensions:
            # Mode 1: User specified specific axes
            logger.info(f"  Extracting specific axes: {request.dimensions}")

            for axis in request.dimensions:
                dim = await extract_dimension(ExtractDimensionRequest(
                    image_base64=request.image_base64,
                    axis=axis
                ))
                dimensions_to_process.append(dim)

            mode = "user_specified"
        else:
            # Mode 2: Auto-suggest dimensions
            logger.info(f"  Auto-suggesting {request.count} dimensions")

            analysis = await analyze_dimensions(AnalyzeDimensionsRequest(
                image_base64=request.image_base64,
                count=request.count
            ))
            dimensions_to_process = analysis.dimensions
            mode = "auto_suggested"

        # Generate concept images if requested
        if request.generate_images:
            logger.info(f"Generating {len(dimensions_to_process)} concept images...")

            # Generate in parallel for speed
            async def generate_one(dim: DesignDimension) -> ConceptResult:
                try:
                    result = await generate_concept(GenerateConceptRequest(dimension=dim))
                    return ConceptResult(
                        dimension=dim,
                        image_base64=result.image_base64,
                        image_id=result.image_id
                    )
                except Exception as e:
                    logger.error(f"Failed to generate for {dim.name}: {e}")
                    return ConceptResult(dimension=dim)

            results = await asyncio.gather(*[generate_one(d) for d in dimensions_to_process])
            concepts = list(results)
        else:
            # Just return dimensions without images
            concepts = [ConceptResult(dimension=d) for d in dimensions_to_process]

        logger.info(f"Pipeline complete. {len(concepts)} concepts processed.")
        return IsolateConceptsResponse(mode=mode, concepts=concepts)

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


@app.get("/images/{image_id}")
async def get_image(image_id: str):
    """Serve a generated concept image."""
    image_path = OUTPUT_DIR / image_id
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path, media_type="image/jpeg")


# Serve outputs directory
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")


# =============================================================================
# Run Server
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("CONCEPT ISOLATION LAB v2.0")
    print("=" * 60)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"API docs: http://localhost:8766/docs")
    print("")
    print("Modes:")
    print("  1. User-specified: POST /api/isolate-concepts with dimensions=[...]")
    print("  2. Auto-suggest: POST /api/isolate-concepts with count=N")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8766)
