"""Analysis routes for Pageant - Prompt Archaeology, Style Gradient, Design System Generator."""

import asyncio
import base64
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from gemini_service import GeminiService

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# Initialize Gemini service (reuse from main server)
def load_api_key() -> str:
    import os
    if api_key := os.environ.get("GEMINI_API_KEY"):
        return api_key.strip()
    if key_path_str := os.environ.get("GEMINI_API_KEY_PATH"):
        key_path = Path(key_path_str).expanduser()
        if key_path.exists():
            return key_path.read_text().strip()
    default_path = Path.home() / ".gemini" / "apikey_backup.txt"
    if default_path.exists():
        return default_path.read_text().strip()
    old_path = Path.home() / ".gemini" / "apikey.txt"
    if old_path.exists():
        return old_path.read_text().strip()
    raise FileNotFoundError("Gemini API key not found")

gemini = GeminiService(api_key=load_api_key())

# Paths
BASE_DIR = Path(__file__).parent.parent
IMAGES_DIR = BASE_DIR / "generated_images"


# ============================================================
# FEATURE 1: PROMPT ARCHAEOLOGY - Reverse Engineering
# ============================================================

class AnalyzeImageRequest(BaseModel):
    image_id: str | None = None  # Analyze existing image by ID


class ImageDNA(BaseModel):
    """The extracted 'DNA' of an image."""
    estimated_prompt: str
    style_tags: list[str]
    color_palette: list[dict[str, str]]  # [{name, hex, percentage}]
    composition: str  # e.g., "rule of thirds", "centered", "diagonal"
    mood: str
    lighting: str
    subject_matter: list[str]
    artistic_style: str
    technical_qualities: dict[str, str]  # {detail_level, contrast, saturation}
    confidence: float


ARCHAEOLOGY_SYSTEM_PROMPT = """You are an expert image analyst. Analyze the provided image and extract its visual DNA.

Return your analysis as JSON with this exact structure:
{
  "estimated_prompt": "A detailed prompt that could recreate this image (2-3 sentences)",
  "style_tags": ["tag1", "tag2", ...],  // 5-10 descriptive tags
  "color_palette": [
    {"name": "color name", "hex": "#RRGGBB", "percentage": 30},
    // 4-6 dominant colors
  ],
  "composition": "description of composition style",
  "mood": "emotional mood of the image",
  "lighting": "lighting characteristics",
  "subject_matter": ["main subject", "secondary elements"],
  "artistic_style": "art style or genre",
  "technical_qualities": {
    "detail_level": "high/medium/low",
    "contrast": "high/medium/low",
    "saturation": "vibrant/muted/neutral"
  },
  "confidence": 0.85  // 0-1 confidence in analysis
}

Be specific and detailed. Focus on elements that would help recreate the image."""


@router.post("/archaeology")
async def analyze_image_archaeology(file: UploadFile = File(None), image_id: str = Form(None)):
    """Analyze an image and extract its visual DNA for recreation."""

    # Get image bytes from upload or existing image
    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/png"
    elif image_id:
        # Load from existing images
        metadata_path = IMAGES_DIR / "metadata.json"
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail="No images found")

        with open(metadata_path) as f:
            metadata = json.load(f)

        # Find image
        for prompt in metadata.get("prompts", []):
            for img in prompt.get("images", []):
                if img["id"] == image_id:
                    img_path = IMAGES_DIR / img["image_path"]
                    if img_path.exists():
                        image_bytes = img_path.read_bytes()
                        mime_type = img.get("mime_type", "image/png")
                        break
        else:
            raise HTTPException(status_code=404, detail="Image not found")
    else:
        raise HTTPException(status_code=400, detail="Provide either file or image_id")

    # Use Gemini to analyze
    try:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=ARCHAEOLOGY_SYSTEM_PROMPT,
        )

        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            "Analyze this image and extract its visual DNA. Return JSON only.",
        ]

        response = await gemini.client.aio.models.generate_content(
            model=gemini.DEFAULT_TEXT_MODEL,
            contents=contents,
            config=config,
        )

        # Extract JSON from response
        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        # Parse JSON from response (handle markdown code blocks)
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = text

        dna = json.loads(json_str.strip())

        return {
            "success": True,
            "dna": dna,
            "raw_analysis": text,
        }

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Failed to parse analysis: {e}",
            "raw_analysis": text if 'text' in dir() else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ============================================================
# FEATURE 2: STYLE GRADIENT EXPLORER
# ============================================================

class StyleGradientRequest(BaseModel):
    pole_a: str  # e.g., "minimalist"
    pole_b: str  # e.g., "maximalist"
    subject: str  # What to generate
    steps: int = 5  # Number of interpolation steps


GRADIENT_SYSTEM_PROMPT = """You are an expert at creating image generation prompts along a style spectrum.

Given two style poles (A and B) and a subject, create {steps} prompts that smoothly interpolate between the poles.

Step 1 should be fully pole A, step {steps} should be fully pole B.
Middle steps should blend the qualities progressively.

For each step, provide:
1. A detailed generation prompt incorporating the subject with the blended style
2. The percentage weight of each pole (should sum to 100%)
3. Key style attributes at this point in the spectrum

Return as JSON array:
[
  {{
    "step": 1,
    "pole_a_weight": 100,
    "pole_b_weight": 0,
    "prompt": "detailed prompt...",
    "style_notes": "key characteristics at this step"
  }},
  ...
]"""


@router.post("/gradient")
async def generate_style_gradient(req: StyleGradientRequest):
    """Generate prompts along a style spectrum between two poles."""

    steps = min(max(2, req.steps), 10)  # Clamp between 2-10

    user_prompt = f"""Create {steps} prompts interpolating between:
Pole A: {req.pole_a}
Pole B: {req.pole_b}
Subject: {req.subject}

Return a JSON array with {steps} items."""

    try:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=GRADIENT_SYSTEM_PROMPT.format(steps=steps),
        )

        response = await gemini.client.aio.models.generate_content(
            model=gemini.DEFAULT_TEXT_MODEL,
            contents=user_prompt,
            config=config,
        )

        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        # Parse JSON
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = text

        gradient = json.loads(json_str.strip())

        return {
            "success": True,
            "pole_a": req.pole_a,
            "pole_b": req.pole_b,
            "subject": req.subject,
            "gradient": gradient,
        }

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Failed to parse gradient: {e}",
            "raw_response": text if 'text' in dir() else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gradient generation failed: {str(e)}")


@router.post("/gradient/generate")
async def generate_gradient_images(
    pole_a: str = Form(...),
    pole_b: str = Form(...),
    subject: str = Form(...),
    steps: int = Form(5),
):
    """Generate actual images along the style gradient."""

    # First get the gradient prompts
    gradient_result = await generate_style_gradient(
        StyleGradientRequest(pole_a=pole_a, pole_b=pole_b, subject=subject, steps=steps)
    )

    if not gradient_result.get("success"):
        return gradient_result

    gradient = gradient_result["gradient"]

    # Generate images for each step
    async def generate_step(step_data: dict) -> dict:
        try:
            result = await gemini.generate_image(step_data["prompt"])
            if result.images:
                return {
                    **step_data,
                    "image": result.images[0],
                    "success": True,
                }
            return {**step_data, "success": False, "error": "No image generated"}
        except Exception as e:
            return {**step_data, "success": False, "error": str(e)}

    # Generate all images in parallel
    tasks = [generate_step(step) for step in gradient]
    results = await asyncio.gather(*tasks)

    return {
        "success": True,
        "pole_a": pole_a,
        "pole_b": pole_b,
        "subject": subject,
        "results": results,
    }


# ============================================================
# FEATURE 3: DESIGN SYSTEM GENERATOR
# ============================================================

class DesignSystemRequest(BaseModel):
    image_id: str | None = None


DESIGN_SYSTEM_PROMPT = """You are an expert design system architect. Analyze the provided image and extract a comprehensive design system.

Return a complete design system as JSON:
{
  "name": "Suggested name for this design system",
  "description": "2-3 sentence description of the overall aesthetic",

  "colors": {
    "primary": {"hex": "#...", "name": "descriptive name", "usage": "main actions, key UI"},
    "secondary": {"hex": "#...", "name": "...", "usage": "..."},
    "accent": {"hex": "#...", "name": "...", "usage": "..."},
    "background": {"hex": "#...", "name": "...", "usage": "..."},
    "surface": {"hex": "#...", "name": "...", "usage": "cards, elevated elements"},
    "text": {
      "primary": "#...",
      "secondary": "#...",
      "muted": "#..."
    }
  },

  "typography": {
    "heading": {
      "family": "suggested font family",
      "weight": "bold/medium/etc",
      "style": "uppercase/normal/etc",
      "characteristics": "description of feel"
    },
    "body": {
      "family": "...",
      "weight": "...",
      "lineHeight": "1.5/1.6/etc",
      "characteristics": "..."
    },
    "accent": {
      "family": "...",
      "usage": "quotes, callouts, special text"
    }
  },

  "spacing": {
    "scale": "4px/8px base",
    "rhythm": "tight/relaxed/airy",
    "recommendations": ["use X for cards", "use Y for sections"]
  },

  "borders": {
    "radius": "none/subtle/rounded/pill",
    "style": "none/hairline/bold",
    "color_approach": "same as text/accent/subtle"
  },

  "shadows": {
    "style": "none/subtle/dramatic/layered",
    "recommendations": "when and how to use shadows"
  },

  "iconography": {
    "style": "outlined/filled/duotone",
    "weight": "light/regular/bold",
    "recommendations": "icon usage guidelines"
  },

  "imagery": {
    "style": "photography/illustration/abstract/mixed",
    "treatment": "full color/duotone/black and white",
    "recommendations": "image usage guidelines"
  },

  "mood_keywords": ["keyword1", "keyword2", ...],

  "component_suggestions": [
    {
      "name": "Button",
      "description": "How buttons should look",
      "css_snippet": "background: #...; border-radius: ..."
    },
    {
      "name": "Card",
      "description": "...",
      "css_snippet": "..."
    }
  ],

  "tailwind_config": {
    "colors": {},
    "fontFamily": {},
    "borderRadius": {}
  }
}

Be comprehensive and specific. Extract everything that would help recreate this visual style."""


@router.post("/design-system")
async def generate_design_system(file: UploadFile = File(None), image_id: str = Form(None)):
    """Extract a complete design system from a hero image."""

    # Get image bytes
    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/png"
    elif image_id:
        metadata_path = IMAGES_DIR / "metadata.json"
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail="No images found")

        with open(metadata_path) as f:
            metadata = json.load(f)

        for prompt in metadata.get("prompts", []):
            for img in prompt.get("images", []):
                if img["id"] == image_id:
                    img_path = IMAGES_DIR / img["image_path"]
                    if img_path.exists():
                        image_bytes = img_path.read_bytes()
                        mime_type = img.get("mime_type", "image/png")
                        break
        else:
            raise HTTPException(status_code=404, detail="Image not found")
    else:
        raise HTTPException(status_code=400, detail="Provide either file or image_id")

    try:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=DESIGN_SYSTEM_PROMPT,
        )

        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            "Extract a complete design system from this image. Return JSON only.",
        ]

        response = await gemini.client.aio.models.generate_content(
            model=gemini.DEFAULT_TEXT_MODEL,
            contents=contents,
            config=config,
        )

        text = ""
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            text += part.text

        # Parse JSON
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = text

        design_system = json.loads(json_str.strip())

        return {
            "success": True,
            "design_system": design_system,
            "raw_analysis": text,
        }

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Failed to parse design system: {e}",
            "raw_response": text if 'text' in dir() else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Design system generation failed: {str(e)}")


@router.post("/design-system/preview")
async def preview_design_system(
    file: UploadFile = File(None),
    image_id: str = Form(None),
    component: str = Form("card"),  # card, button, form
):
    """Generate a visual preview of the design system applied to a component."""

    # First get the design system
    if file:
        # Re-upload for design system extraction
        file_bytes = await file.read()
        # Reset file position for re-read
        import io
        file_like = io.BytesIO(file_bytes)

        # This is a simplified flow - in production you'd cache the design system
        result = await generate_design_system(
            file=UploadFile(file=file_like, filename=file.filename),
            image_id=None
        )
    else:
        result = await generate_design_system(file=None, image_id=image_id)

    if not result.get("success"):
        return result

    design_system = result["design_system"]

    # Generate a preview prompt based on the design system
    preview_prompt = f"""Create a clean UI mockup of a {component} using this design system:
Colors: Primary {design_system.get('colors', {}).get('primary', {}).get('hex', '#3B82F6')},
        Background {design_system.get('colors', {}).get('background', {}).get('hex', '#FFFFFF')}
Typography: {design_system.get('typography', {}).get('heading', {}).get('family', 'Sans-serif')}
Border radius: {design_system.get('borders', {}).get('radius', 'rounded')}
Style: {', '.join(design_system.get('mood_keywords', ['modern', 'clean'])[:3])}

Create a simple, isolated {component} component preview on a neutral background."""

    try:
        image_result = await gemini.generate_image(preview_prompt)

        if image_result.images:
            return {
                "success": True,
                "design_system": design_system,
                "preview": {
                    "component": component,
                    "image": image_result.images[0],
                },
            }
        return {
            "success": False,
            "error": "Failed to generate preview image",
            "design_system": design_system,
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Preview generation failed: {str(e)}",
            "design_system": design_system,
        }
