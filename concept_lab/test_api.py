#!/usr/bin/env python3
"""Test the Concept Isolation Lab v2.0 API."""

import base64
import httpx
import asyncio
from pathlib import Path

CONCEPT_SERVER = "http://localhost:8766"
OUTPUT_DIR = Path(__file__).parent / "outputs"


async def test_get_axes():
    """Test the axes endpoint."""
    print("=" * 60)
    print("TEST 1: Get Known Design Axes")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{CONCEPT_SERVER}/api/axes")
        print(f"Status: {response.status_code}")
        result = response.json()

        print(f"\nKnown axes: {result['known_axes']}")
        print(f"Extended axes: {result['extended_axes']}")

        return result


async def test_analyze_dimensions():
    """Test auto-suggesting design dimensions from an image."""
    print("\n" + "=" * 60)
    print("TEST 2: Auto-Suggest Design Dimensions")
    print("=" * 60)

    # Load sample image
    image_path = Path("/Users/wz/Desktop/Concepts/a93ca773-f513-412a-8f71-f971282b248c.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name} ({len(image_bytes)} bytes)")
    print("Asking Gemini to suggest 4 design dimensions...\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/analyze-dimensions",
            json={
                "image_base64": image_base64,
                "count": 4,
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "dimensions" in result:
            print(f"\n✓ Found {len(result['dimensions'])} dimensions:\n")
            for i, dim in enumerate(result['dimensions'], 1):
                print(f"  {i}. [{dim['axis']}] {dim['name']}")
                print(f"     Tags: {', '.join(dim['tags'])}")
                print(f"     Description: {dim['description'][:100]}...")
                print()
        else:
            print(f"\n✗ Error: {result}")

        return result


async def test_extract_specific_dimension():
    """Test extracting a specific dimension from an image."""
    print("\n" + "=" * 60)
    print("TEST 3: Extract Specific Dimension (lighting)")
    print("=" * 60)

    image_path = Path("/Users/wz/Desktop/Concepts/3b1dbba4-2896-4dce-803c-0003e1f84a6e.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name}")
    print("Extracting 'lighting' dimension...\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/extract-dimension",
            json={
                "image_base64": image_base64,
                "axis": "lighting",
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "name" in result:
            print(f"\n✓ Extracted: {result['name']}")
            print(f"   Axis: {result['axis']}")
            print(f"   Tags: {', '.join(result['tags'])}")
            print(f"   Description: {result['description']}")
        else:
            print(f"\n✗ Error: {result}")

        return result


async def test_generate_concept_image():
    """Test generating a concept image."""
    print("\n" + "=" * 60)
    print("TEST 4: Generate Concept Image")
    print("=" * 60)

    dimension = {
        "axis": "lighting",
        "name": "Ethereal Glow",
        "description": "Soft, warm central light source creating a gentle glow that diffuses outward into deep shadows. Classic chiaroscuro technique with dramatic contrast between the illuminated focal point and surrounding darkness.",
        "tags": ["chiaroscuro", "warm", "dramatic"],
        "generation_prompt": "Create an abstract representation of soft, ethereal lighting emerging from darkness. Focus on the interplay of warm light and deep shadow, with smooth gradients from bright center to velvety black edges. No objects, just pure light and shadow."
    }

    print(f"Generating concept for: {dimension['name']}")
    print(f"Description: {dimension['description'][:80]}...\n")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/generate-concept",
            json={
                "dimension": dimension,
                "aspect_ratio": "1:1",
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "image_id" in result:
            print(f"\n✓ Generated: {result['image_id']}")
            print(f"   Saved to: {OUTPUT_DIR / result['image_id']}")
        else:
            print(f"\n✗ Error: {result}")

        return result


async def test_full_pipeline_auto():
    """Test full pipeline with auto-suggested dimensions."""
    print("\n" + "=" * 60)
    print("TEST 5: Full Pipeline (Auto-Suggest Mode)")
    print("=" * 60)

    image_path = Path("/Users/wz/Desktop/Concepts/ba14b6c5-14b1-416e-8f90-9f51989d3ecf.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name}")
    print("Mode: Auto-suggest 3 dimensions + generate images\n")

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/isolate-concepts",
            json={
                "image_base64": image_base64,
                "count": 3,  # Auto-suggest 3 dimensions
                "generate_images": True,
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "concepts" in result:
            print(f"\n✓ Mode: {result['mode']}")
            print(f"✓ Generated {len(result['concepts'])} concepts:\n")
            for i, concept in enumerate(result['concepts'], 1):
                dim = concept['dimension']
                print(f"  {i}. [{dim['axis']}] {dim['name']}")
                print(f"     Tags: {', '.join(dim['tags'])}")
                if concept.get('image_id'):
                    print(f"     Image: {concept['image_id']}")
                print()
        else:
            print(f"\n✗ Error: {result}")

        return result


async def test_full_pipeline_specified():
    """Test full pipeline with user-specified dimensions."""
    print("\n" + "=" * 60)
    print("TEST 6: Full Pipeline (User-Specified Mode)")
    print("=" * 60)

    image_path = Path("/Users/wz/Desktop/Concepts/03e31479-45c8-40a8-954b-646feed6f3c0.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name}")
    print("Mode: User-specified dimensions ['texture', 'contrast']\n")

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/isolate-concepts",
            json={
                "image_base64": image_base64,
                "dimensions": ["texture", "contrast"],  # User specifies what to extract
                "generate_images": True,
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "concepts" in result:
            print(f"\n✓ Mode: {result['mode']}")
            print(f"✓ Generated {len(result['concepts'])} concepts:\n")
            for i, concept in enumerate(result['concepts'], 1):
                dim = concept['dimension']
                print(f"  {i}. [{dim['axis']}] {dim['name']}")
                print(f"     Tags: {', '.join(dim['tags'])}")
                print(f"     Description: {dim['description'][:100]}...")
                if concept.get('image_id'):
                    print(f"     Image: {concept['image_id']}")
                print()
        else:
            print(f"\n✗ Error: {result}")

        return result


async def main():
    print("=" * 60)
    print("CONCEPT ISOLATION LAB v2.0 - API TEST SUITE")
    print("=" * 60)
    print()

    # Test 1: Get axes
    await test_get_axes()

    # Test 2: Auto-analyze dimensions
    await test_analyze_dimensions()

    # Test 3: Extract specific dimension
    await test_extract_specific_dimension()

    # Test 4: Generate concept image
    await test_generate_concept_image()

    # Test 5: Full pipeline - auto mode
    await test_full_pipeline_auto()

    # Test 6: Full pipeline - specified mode
    await test_full_pipeline_specified()

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETE!")
    print("=" * 60)
    print(f"\nGenerated images saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
