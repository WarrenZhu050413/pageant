#!/usr/bin/env python3
"""Test the new Gradient Variations and More Like This features."""

import base64
import httpx
import asyncio
from pathlib import Path

CONCEPT_SERVER = "http://localhost:8766"


async def test_gradient_variations():
    """Test the gradient variations endpoint."""
    print("=" * 60)
    print("TEST: Gradient Variations (Saturation)")
    print("=" * 60)

    # Load a sample image
    image_path = Path("/Users/wz/Desktop/Concepts/a93ca773-f513-412a-8f71-f971282b248c.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name}")
    print("Generating saturation gradient: 'extremely saturated' → 'near monochrome'\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
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

        print(f"Status: {response.status_code}")
        result = response.json()

        if "variations" in result:
            print(f"\n✓ Gradient: {result['gradient_axis']}")
            print(f"  From: {result['from_extreme']}")
            print(f"  To: {result['to_extreme']}\n")

            print("Variations along gradient:\n")
            for v in result["variations"]:
                print(f"  [{v['position']:.1f}] {v['label']}")
                print(f"       Mood: {v['mood']}")
                print(f"       {v['description'][:100]}...")
                print()
        else:
            print(f"\n✗ Error: {result}")

        return result


async def test_more_like_this():
    """Test the More Like This exploration directions."""
    print("\n" + "=" * 60)
    print("TEST: More Like This (Exploration Directions)")
    print("=" * 60)

    # Load a sample image
    image_path = Path("/Users/wz/Desktop/Concepts/3b1dbba4-2896-4dce-803c-0003e1f84a6e.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name}")
    print("Getting creative directions to explore from this image...\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/more-like-this",
            json={
                "image_base64": image_base64,
                "count": 5,
                "original_prompt": "Hands holding a glowing orb in darkness",
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "directions" in result:
            print(f"\n✓ Source Analysis: {result['source_analysis']}\n")

            print("Exploration Directions:\n")
            for i, d in enumerate(result["directions"], 1):
                print(f"  {i}. [{d['direction_type'].upper()}] {d['name']} ({d['intensity']})")
                print(f"     {d['description']}")
                print(f"     Prompt: {d['prompt'][:80]}...")
                print()
        else:
            print(f"\n✗ Error: {result}")

        return result


async def test_warmth_gradient():
    """Test warmth gradient with a different image."""
    print("\n" + "=" * 60)
    print("TEST: Gradient Variations (Warmth)")
    print("=" * 60)

    # Load seascape image
    image_path = Path("/Users/wz/Desktop/Concepts/ba14b6c5-14b1-416e-8f90-9f51989d3ecf.jpg")
    image_bytes = image_path.read_bytes()
    image_base64 = base64.b64encode(image_bytes).decode()

    print(f"Image: {image_path.name}")
    print("Generating warmth gradient: 'warm golden' → 'cool icy'\n")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{CONCEPT_SERVER}/api/gradient-variations",
            json={
                "base_prompt": "Dramatic ocean waves crashing against rocks",
                "dimension": "warmth",
                "from_extreme": "very warm, golden, amber tones",
                "to_extreme": "very cool, blue, icy tones",
                "count": 5,
                "image_base64": image_base64,
            }
        )

        print(f"Status: {response.status_code}")
        result = response.json()

        if "variations" in result:
            print(f"\n✓ Generated {len(result['variations'])} warmth variations:")
            for v in result["variations"]:
                print(f"  [{v['position']:.1f}] {v['label']} - {v['mood']}")
        else:
            print(f"\n✗ Error: {result}")

        return result


async def main():
    print("=" * 60)
    print("CONCEPT LAB - NEW FEATURES TEST")
    print("=" * 60)
    print()

    # Test 1: Saturation gradient
    await test_gradient_variations()

    # Test 2: More Like This
    await test_more_like_this()

    # Test 3: Warmth gradient
    await test_warmth_gradient()

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETE!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
