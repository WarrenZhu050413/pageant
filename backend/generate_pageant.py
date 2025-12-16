#!/usr/bin/env python3
"""Generate exciting images for the Gemini Pageant showcase."""

import asyncio
import base64
import json
import os
from datetime import datetime
from pathlib import Path

from gemini_service import GeminiService

# Exciting use cases with prompts
USE_CASES = [
    {
        "id": "neural-architecture",
        "title": "Neural Network as Architecture",
        "category": "Technical Concept",
        "prompt": """Create a stunning architectural visualization where a neural network's layers
        are reimagined as a grand building interior. Each layer is a floor with glowing connection
        pathways between neurons visualized as elegant bridges. Style: Sci-fi meets classical
        architecture, dramatic lighting, deep blues and golden accents. High detail, photorealistic.""",
        "use_for": "Explaining deep learning architectures in documentation",
    },
    {
        "id": "recursion-space",
        "title": "Recursion as Physical Space",
        "category": "Abstract Concept",
        "prompt": """Visualize the concept of recursion as a physical space: a person standing
        in a room that contains a smaller version of the same room, which contains an even smaller
        version, creating an infinite nested effect. Use warm wood tones, soft lighting, and
        surreal M.C. Escher-inspired perspective. The viewer should feel the infinite depth.""",
        "use_for": "Teaching recursion concepts to programming students",
    },
    {
        "id": "space-mission-control",
        "title": "Space Mission Control Dashboard",
        "category": "UI/UX Concept",
        "prompt": """Design a futuristic space mission control dashboard UI. Multiple holographic
        displays showing planetary trajectories, spacecraft telemetry, and crew vitals. Style:
        Dark theme with cyan and orange accents, glassmorphism effects, clean sans-serif typography.
        Inspired by Interstellar and The Expanse. Show it as if photographed in a real control room.""",
        "use_for": "Inspiration for data-dense dashboard design",
    },
    {
        "id": "climate-evolution",
        "title": "Climate Change Journey",
        "category": "Data Storytelling",
        "prompt": """Create a triptych-style image showing the same landscape across three time
        periods: 1900 (pristine forest), 2020 (urban encroachment), and 2100 (two possible futures
        split - one devastated, one rewilded). Use consistent composition to show transformation.
        Painterly style, emotional impact, documentary photography meets concept art.""",
        "use_for": "Visualizing time-series environmental data",
    },
    {
        "id": "404-explorer",
        "title": "404 Error: Lost Explorer",
        "category": "Error State Art",
        "prompt": """A friendly 404 error page illustration: A charming robot explorer with a
        flashlight, standing in a mystical foggy forest with glowing mushrooms and floating
        lanterns. The robot looks puzzled but hopeful, holding a torn map. Style: Miyazaki-inspired,
        warm and whimsical despite being lost. Include subtle '404' integrated into the environment.""",
        "use_for": "Friendly error pages that reduce user frustration",
    },
    {
        "id": "api-data-flow",
        "title": "API Data Flow as Water System",
        "category": "Technical Concept",
        "prompt": """Visualize REST API data flow as an elegant water system in a Japanese garden.
        GET requests are gentle streams, POST requests are waterfalls, responses are koi fish
        carrying data packets. Authentication is a ceremonial gate. Style: Traditional Japanese
        woodblock print (ukiyo-e) with modern tech elements subtly integrated. Serene yet technical.""",
        "use_for": "Making API documentation more engaging",
    },
    {
        "id": "onboarding-library",
        "title": "Welcome to the Knowledge Library",
        "category": "Onboarding Art",
        "prompt": """A user entering a magnificent digital library for an app onboarding screen.
        Infinite bookshelves stretching upward, floating holographic cards showing features,
        a warm welcoming light at the center. The person is a silhouette walking toward the light.
        Style: Epic scale, dreamlike atmosphere, rich purples and golds, cinematic lighting.""",
        "use_for": "App onboarding screens that inspire exploration",
    },
    {
        "id": "git-branches",
        "title": "Git Branches as Living Tree",
        "category": "Technical Concept",
        "prompt": """Git version control visualized as a magnificent living tree. The main trunk
        is the main branch, with beautiful branches growing outward representing feature branches.
        Some branches merge back into the trunk (merge commits), while some extend into flowers
        (releases). Style: Scientific botanical illustration meets digital art, on aged paper
        texture. Show commit dots as glowing fruit.""",
        "use_for": "Git tutorials and documentation",
    },
    {
        "id": "microservices-city",
        "title": "Microservices as City Districts",
        "category": "Architecture Diagram",
        "prompt": """A bird's-eye view of a futuristic city where each district represents a
        microservice. Connected by glowing transit lines (APIs), each building has a distinct
        style representing its function: Auth is a fortress, Database is a warehouse, Frontend
        is a glass tower. Style: Detailed isometric illustration, cyberpunk meets clean design,
        neon accents against dark buildings.""",
        "use_for": "System architecture documentation",
    },
    {
        "id": "loading-meditation",
        "title": "Loading State as Zen Garden",
        "category": "UI/UX Concept",
        "prompt": """A peaceful Zen garden scene for a loading state. Ripples slowly forming in
        sand, a single stone creating circular patterns. Subtle particles floating upward like
        fireflies. Style: Minimalist Japanese aesthetics, muted colors, one accent color (sage
        green). The image should feel calming and patient, making waiting feel intentional.""",
        "use_for": "Loading states that reduce perceived wait time",
    },
]


async def generate_all_images(output_dir: Path, api_key: str):
    """Generate all pageant images."""
    service = GeminiService(api_key=api_key)
    results = []

    output_dir.mkdir(parents=True, exist_ok=True)

    for i, use_case in enumerate(USE_CASES, 1):
        print(f"\n[{i}/{len(USE_CASES)}] {use_case['title']}")
        print(f"    Category: {use_case['category']}")
        print(f"    Use: {use_case['use_for']}")

        try:
            result = await service.generate_image(use_case["prompt"])

            if result.images:
                # Save the image
                img_data = result.images[0]
                img_bytes = base64.b64decode(img_data["data"])

                # Determine extension from mime type
                ext = "png" if "png" in img_data["mime_type"] else "jpg"
                img_path = output_dir / f"{use_case['id']}.{ext}"

                img_path.write_bytes(img_bytes)
                print(f"    Saved: {img_path}")

                results.append({
                    "id": use_case["id"],
                    "title": use_case["title"],
                    "category": use_case["category"],
                    "prompt": use_case["prompt"],
                    "use_for": use_case["use_for"],
                    "image_path": str(img_path.name),
                    "mime_type": img_data["mime_type"],
                    "model_response": result.text,
                    "usage": result.usage,
                    "generated_at": datetime.now().isoformat(),
                })
            else:
                print(f"    [WARN] No image generated")
                results.append({
                    **use_case,
                    "image_path": None,
                    "error": "No image generated",
                })

        except Exception as e:
            print(f"    [ERROR] {e}")
            results.append({
                **use_case,
                "image_path": None,
                "error": str(e),
            })

        # Brief pause between requests
        if i < len(USE_CASES):
            await asyncio.sleep(1)

    # Save metadata
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "model": service.DEFAULT_IMAGE_MODEL,
            "images": results,
        }, f, indent=2)

    print(f"\n✓ Metadata saved: {metadata_path}")
    return results


async def main():
    # Load API key
    api_key_path = Path.home() / ".gemini" / "apikey.txt"
    api_key = api_key_path.read_text().strip()

    # Output directory
    output_dir = Path(__file__).parent.parent / "generated_images"

    print("=" * 60)
    print("GEMINI NANO BANANA PRO - IMAGE PAGEANT GENERATOR")
    print("=" * 60)
    print(f"Output: {output_dir}")
    print(f"Use Cases: {len(USE_CASES)}")

    results = await generate_all_images(output_dir, api_key)

    successful = sum(1 for r in results if r.get("image_path"))
    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {successful}/{len(USE_CASES)} images generated")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
