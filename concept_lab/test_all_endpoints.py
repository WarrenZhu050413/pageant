#!/usr/bin/env python3
"""Test all concept_lab endpoints and save results for HTML documentation."""

import base64
import httpx
import asyncio
import json
from pathlib import Path
from datetime import datetime

CONCEPT_SERVER = "http://localhost:8767"
CONCEPTS_DIR = Path("/Users/wz/Desktop/Concepts")
OUTPUT_DIR = Path(__file__).parent / "test_results"
OUTPUT_DIR.mkdir(exist_ok=True)

# Track all results
all_results = {}


async def test_get_axes():
    """Test GET /api/axes"""
    print("\n" + "=" * 60)
    print("1. GET /api/axes")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{CONCEPT_SERVER}/api/axes")
        result = response.json()

        print(f"Status: {response.status_code}")
        print(f"Known axes: {result['known_axes']}")
        print(f"Extended axes: {result['extended_axes']}")

        all_results["get_axes"] = {
            "endpoint": "GET /api/axes",
            "description": "Returns list of known design axes with descriptions",
            "input": "None (GET request)",
            "response": result,
            "status": response.status_code
        }
        return result


async def test_dimension_presets():
    """Test GET /api/dimension-presets"""
    print("\n" + "=" * 60)
    print("2. GET /api/dimension-presets")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{CONCEPT_SERVER}/api/dimension-presets")
        result = response.json()

        print(f"Status: {response.status_code}")
        print(f"Presets available: {list(result['presets'].keys())}")

        all_results["dimension_presets"] = {
            "endpoint": "GET /api/dimension-presets",
            "description": "Returns preset dimension ranges for gradient variations (saturation, warmth, contrast, etc.)",
            "input": "None (GET request)",
            "response": result,
            "status": response.status_code
        }
        return result


async def test_analyze_dimensions():
    """Test POST /api/analyze-dimensions"""
    print("\n" + "=" * 60)
    print("3. POST /api/analyze-dimensions")
    print("=" * 60)

    # Use portrait image
    image_path = CONCEPTS_DIR / "a93ca773-f513-412a-8f71-f971282b248c.jpg"
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Input image: {image_path.name}")
    print("Analyzing for 5 design dimensions...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/analyze-dimensions",
            json={
                "image_base64": image_base64,
                "count": 5
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "dimensions" in result:
            print(f"\n✓ Found {len(result['dimensions'])} dimensions:")
            for d in result['dimensions']:
                print(f"  - [{d['axis']}] {d['name']}: {d['tags']}")

        all_results["analyze_dimensions"] = {
            "endpoint": "POST /api/analyze-dimensions",
            "description": "Analyzes an image and auto-suggests design dimensions to extract. Uses Gemini 2.0 Flash for visual analysis.",
            "input_image": str(image_path),
            "input_image_base64": image_base64[:100] + "...",
            "response": result,
            "status": response.status_code
        }
        return result


async def test_extract_dimension():
    """Test POST /api/extract-dimension"""
    print("\n" + "=" * 60)
    print("4. POST /api/extract-dimension")
    print("=" * 60)

    # Use seascape image
    image_path = CONCEPTS_DIR / "ba14b6c5-14b1-416e-8f90-9f51989d3ecf.jpg"
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Input image: {image_path.name}")
    print("Extracting 'mood' dimension...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/extract-dimension",
            json={
                "image_base64": image_base64,
                "axis": "mood"
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "name" in result:
            print(f"\n✓ Extracted dimension:")
            print(f"  Name: {result['name']}")
            print(f"  Tags: {result['tags']}")
            print(f"  Description: {result['description'][:100]}...")

        all_results["extract_dimension"] = {
            "endpoint": "POST /api/extract-dimension",
            "description": "Extracts a specific design dimension (axis) from an image. User specifies which axis to analyze.",
            "input_image": str(image_path),
            "input_axis": "mood",
            "response": result,
            "status": response.status_code
        }
        return result


async def test_gradient_variations():
    """Test POST /api/gradient-variations"""
    print("\n" + "=" * 60)
    print("5. POST /api/gradient-variations")
    print("=" * 60)

    # Use portrait image
    image_path = CONCEPTS_DIR / "a93ca773-f513-412a-8f71-f971282b248c.jpg"
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Input image: {image_path.name}")
    print("Generating saturation gradient: vibrant → monochrome")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/gradient-variations",
            json={
                "base_prompt": "A moody portrait with dramatic lighting and urban atmosphere",
                "dimension": "saturation",
                "from_extreme": "extremely vibrant and saturated colors",
                "to_extreme": "almost completely desaturated, near monochrome",
                "count": 5,
                "image_base64": image_base64,
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "variations" in result:
            print(f"\n✓ Gradient: {result['gradient_axis']}")
            print(f"  From: {result['from_extreme']}")
            print(f"  To: {result['to_extreme']}")
            print(f"\n  Variations:")
            for v in result["variations"]:
                print(f"    [{v['position']:.1f}] {v['label']} - {v['mood']}")

        all_results["gradient_variations"] = {
            "endpoint": "POST /api/gradient-variations",
            "description": "Generates prompt variations along a gradient dimension (e.g., saturated→desaturated). Returns text prompts, not images. Two-phase workflow: preview prompts first.",
            "input_image": str(image_path),
            "input_params": {
                "base_prompt": "A moody portrait with dramatic lighting...",
                "dimension": "saturation",
                "from_extreme": "extremely vibrant and saturated colors",
                "to_extreme": "almost completely desaturated, near monochrome",
                "count": 5
            },
            "response": result,
            "status": response.status_code
        }
        return result


async def test_more_like_this():
    """Test POST /api/more-like-this"""
    print("\n" + "=" * 60)
    print("6. POST /api/more-like-this")
    print("=" * 60)

    # Use glowing orb image
    image_path = CONCEPTS_DIR / "3b1dbba4-2896-4dce-803c-0003e1f84a6e.jpg"
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Input image: {image_path.name}")
    print("Getting exploration directions...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/more-like-this",
            json={
                "image_base64": image_base64,
                "count": 5,
                "original_prompt": "Hands holding a glowing orb in darkness"
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "directions" in result:
            print(f"\n✓ Source Analysis: {result['source_analysis'][:100]}...")
            print(f"\n  Exploration Directions:")
            for d in result["directions"]:
                print(f"    - [{d['direction_type'].upper()}] {d['name']} ({d['intensity']})")

        all_results["more_like_this"] = {
            "endpoint": "POST /api/more-like-this",
            "description": "Analyzes an image and suggests creative directions to explore. Returns prompts for different variations (style, mood, composition, subject, narrative). Two-phase workflow.",
            "input_image": str(image_path),
            "input_params": {
                "original_prompt": "Hands holding a glowing orb in darkness",
                "count": 5
            },
            "response": result,
            "status": response.status_code
        }
        return result


async def test_isolate_concepts_auto():
    """Test POST /api/isolate-concepts (auto mode, no images)"""
    print("\n" + "=" * 60)
    print("7. POST /api/isolate-concepts (Auto Mode, Preview Only)")
    print("=" * 60)

    # Use another image
    image_path = CONCEPTS_DIR / "7403b592-5716-41b8-a349-e77a9104873b.jpg"
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Input image: {image_path.name}")
    print("Auto-suggesting 3 dimensions (preview only, no image generation)...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/isolate-concepts",
            json={
                "image_base64": image_base64,
                "dimensions": None,  # Auto mode
                "count": 3,
                "generate_images": False  # Preview only
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "concepts" in result:
            print(f"\n✓ Mode: {result['mode']}")
            print(f"  Concepts found: {len(result['concepts'])}")
            for c in result['concepts']:
                d = c['dimension']
                print(f"    - [{d['axis']}] {d['name']}")
                print(f"      Tags: {d['tags']}")

        all_results["isolate_concepts_auto"] = {
            "endpoint": "POST /api/isolate-concepts",
            "description": "Full pipeline endpoint. Auto mode: Gemini suggests design dimensions. With generate_images=False, only returns analysis without generating concept images.",
            "input_image": str(image_path),
            "input_params": {
                "dimensions": None,
                "count": 3,
                "generate_images": False
            },
            "response": result,
            "status": response.status_code
        }
        return result


async def test_isolate_concepts_specified():
    """Test POST /api/isolate-concepts (user-specified mode)"""
    print("\n" + "=" * 60)
    print("8. POST /api/isolate-concepts (User-Specified Mode)")
    print("=" * 60)

    # Use the large image
    image_path = CONCEPTS_DIR / "03e31479-45c8-40a8-954b-646feed6f3c0.jpg"
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Input image: {image_path.name}")
    print("Extracting user-specified dimensions: lighting, colors (preview only)...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/isolate-concepts",
            json={
                "image_base64": image_base64,
                "dimensions": ["lighting", "colors"],  # User specified
                "generate_images": False  # Preview only
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "concepts" in result:
            print(f"\n✓ Mode: {result['mode']}")
            print(f"  Concepts extracted: {len(result['concepts'])}")
            for c in result['concepts']:
                d = c['dimension']
                print(f"    - [{d['axis']}] {d['name']}")
                print(f"      Description: {d['description'][:80]}...")

        all_results["isolate_concepts_specified"] = {
            "endpoint": "POST /api/isolate-concepts",
            "description": "Full pipeline endpoint. User-specified mode: Extract specific axes provided by user. With generate_images=False, only returns analysis.",
            "input_image": str(image_path),
            "input_params": {
                "dimensions": ["lighting", "colors"],
                "generate_images": False
            },
            "response": result,
            "status": response.status_code
        }
        return result


async def test_generate_concept():
    """Test POST /api/generate-concept"""
    print("\n" + "=" * 60)
    print("9. POST /api/generate-concept (Image Generation)")
    print("=" * 60)

    print("Generating concept image for a specific dimension...")
    print("(This will call the Gemini image generation API)")

    # Create a dimension manually for testing
    dimension = {
        "axis": "mood",
        "name": "Ethereal Luminescence",
        "description": "A soft, dreamy atmosphere with gentle glowing light that creates an otherworldly, mystical feeling. The light seems to emanate from within, creating halos and soft gradients.",
        "tags": ["mystical", "soft-glow", "dreamy"],
        "generation_prompt": "Create an abstract image of soft, diffused light sources with gentle color gradients. Focus on ethereal glow effects, soft halos, and luminescent atmosphere. Use pastel blues and soft whites with subtle warmth."
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/generate-concept",
            json={
                "dimension": dimension,
                "aspect_ratio": "1:1"
            }
        )

        result = response.json()
        print(f"Status: {response.status_code}")

        if "image_base64" in result:
            print(f"\n✓ Generated image: {result['image_id']}")
            print(f"  Dimension: {result['dimension']['name']}")

            # Save the generated image
            image_data = base64.b64decode(result['image_base64'])
            output_path = OUTPUT_DIR / result['image_id']
            output_path.write_bytes(image_data)
            print(f"  Saved to: {output_path}")

            all_results["generate_concept"] = {
                "endpoint": "POST /api/generate-concept",
                "description": "Generates a pure concept image for a specific dimension using Gemini 3 Pro Image Preview. Creates abstract visual representations of design concepts.",
                "input_params": {
                    "dimension": dimension,
                    "aspect_ratio": "1:1"
                },
                "response": {
                    "image_id": result['image_id'],
                    "dimension": result['dimension'],
                    "image_base64": result['image_base64'][:100] + "..."
                },
                "generated_image_path": str(output_path),
                "status": response.status_code
            }
        else:
            print(f"\n✗ Error: {result}")
            all_results["generate_concept"] = {
                "endpoint": "POST /api/generate-concept",
                "description": "Generates a pure concept image for a specific dimension.",
                "input_params": {"dimension": dimension},
                "response": result,
                "status": response.status_code,
                "error": True
            }

        return result


async def main():
    print("=" * 60)
    print("CONCEPT LAB - COMPREHENSIVE ENDPOINT TESTING")
    print(f"Server: {CONCEPT_SERVER}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)

    # Test all endpoints
    await test_get_axes()
    await test_dimension_presets()
    await test_analyze_dimensions()
    await test_extract_dimension()
    await test_gradient_variations()
    await test_more_like_this()
    await test_isolate_concepts_auto()
    await test_isolate_concepts_specified()
    await test_generate_concept()

    # Save all results
    results_path = OUTPUT_DIR / "all_results.json"
    with open(results_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETE!")
    print(f"Results saved to: {results_path}")
    print("=" * 60)

    return all_results


if __name__ == "__main__":
    asyncio.run(main())
