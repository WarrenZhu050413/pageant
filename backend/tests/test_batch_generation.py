"""Test: Compare single-call batch generation vs. multi-call generation.

This script tests whether Gemini can generate multiple images in a single API call
and compares quality/cost vs. the current multi-call approach.

Model options:
- gemini-3-pro-image-preview: Gemini 2.0 Flash experimental (native image gen)
- imagen-4.0-generate-001: Imagen 4 (native batch via number_of_images)
"""

import asyncio
import base64
import os
import time
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types

# Model to test - using the same as the main service
GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview"
IMAGEN_MODEL = "imagen-4.0-generate-001"


@dataclass
class GenerationResult:
    """Result from a generation attempt."""
    images: list[bytes]
    prompt_tokens: int
    completion_tokens: int
    elapsed_seconds: float
    approach: str
    model: str = ""


async def generate_with_imagen_batch(
    client: genai.Client,
    prompt: str,
    count: int,
) -> GenerationResult:
    """Generate multiple images using Imagen's native batch capability.

    Imagen supports number_of_images parameter for true batch generation.
    """
    start = time.time()

    try:
        # Imagen uses generate_images() method with native batch support
        response = await client.aio.models.generate_images(
            model=IMAGEN_MODEL,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=count,
            ),
        )

        elapsed = time.time() - start

        # Extract images from response
        images = []
        if hasattr(response, 'generated_images'):
            for img in response.generated_images:
                if hasattr(img, 'image') and hasattr(img.image, 'image_bytes'):
                    images.append(img.image.image_bytes)

        return GenerationResult(
            images=images,
            prompt_tokens=0,  # Imagen pricing is per-image, not per-token
            completion_tokens=0,
            elapsed_seconds=elapsed,
            approach="imagen_batch",
            model=IMAGEN_MODEL,
        )
    except Exception as e:
        print(f"    Imagen error: {e}")
        return GenerationResult(
            images=[],
            prompt_tokens=0,
            completion_tokens=0,
            elapsed_seconds=time.time() - start,
            approach="imagen_batch",
            model=IMAGEN_MODEL,
        )


async def generate_batch_single_call(
    client: genai.Client,
    prompt: str,
    count: int,
    context_image: bytes | None = None,
) -> GenerationResult:
    """Attempt to generate multiple images in a single API call using Gemini.

    Strategy: Ask the model to generate N distinct variations in one call.
    """
    start = time.time()

    # Craft prompt asking for multiple images
    batch_prompt = f"""Generate {count} distinct image variations of the following concept.
Each variation should be different in style, mood, or composition.

Concept: {prompt}

Generate all {count} images now."""

    config = types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
    )

    contents: list | str
    if context_image:
        contents = [
            types.Part.from_bytes(data=context_image, mime_type="image/png"),
            batch_prompt,
        ]
    else:
        contents = batch_prompt

    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=contents,
            config=config,
        )

        elapsed = time.time() - start

        # Extract images
        images = []
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "inline_data") and part.inline_data:
                            if hasattr(part.inline_data, "data") and part.inline_data.data:
                                images.append(part.inline_data.data)

        # Extract usage
        prompt_tokens = 0
        completion_tokens = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

        return GenerationResult(
            images=images,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            elapsed_seconds=elapsed,
            approach="gemini_single_call",
            model=GEMINI_IMAGE_MODEL,
        )
    except Exception as e:
        print(f"    Gemini batch error: {e}")
        return GenerationResult(
            images=[],
            prompt_tokens=0,
            completion_tokens=0,
            elapsed_seconds=time.time() - start,
            approach="gemini_single_call",
            model=GEMINI_IMAGE_MODEL,
        )


async def generate_multi_call(
    client: genai.Client,
    prompt: str,
    count: int,
    context_image: bytes | None = None,
) -> GenerationResult:
    """Generate images with multiple separate API calls (current approach)."""
    start = time.time()

    config = types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],  # Some models require TEXT too
    )

    async def single_gen(variation_suffix: str) -> tuple[bytes | None, int, int]:
        varied_prompt = f"{prompt}{variation_suffix}"

        contents: list | str
        if context_image:
            contents = [
                types.Part.from_bytes(data=context_image, mime_type="image/png"),
                varied_prompt,
            ]
        else:
            contents = varied_prompt

        try:
            resp = await client.aio.models.generate_content(
                model=GEMINI_IMAGE_MODEL,
                contents=contents,
                config=config,
            )

            img = None
            if resp.candidates:
                for cand in resp.candidates:
                    if cand.content and cand.content.parts:
                        for part in cand.content.parts:
                            if hasattr(part, "inline_data") and part.inline_data:
                                if hasattr(part.inline_data, "data"):
                                    img = part.inline_data.data
                                    break

            pt = 0
            ct = 0
            if hasattr(resp, "usage_metadata") and resp.usage_metadata:
                pt = getattr(resp.usage_metadata, "prompt_token_count", 0) or 0
                ct = getattr(resp.usage_metadata, "candidates_token_count", 0) or 0

            return img, pt, ct
        except Exception as e:
            print(f"    Multi-call error: {e}")
            return None, 0, 0

    # Variation suffixes to ensure different outputs
    suffixes = [
        "",
        "\n\n[Style variation: warm, cinematic lighting]",
        "\n\n[Style variation: cool, minimal aesthetic]",
        "\n\n[Style variation: bold, graphic style]",
    ]

    # Run in parallel
    tasks = [single_gen(suffixes[i % len(suffixes)]) for i in range(count)]
    results = await asyncio.gather(*tasks)

    elapsed = time.time() - start

    images = [r[0] for r in results if r[0]]
    total_prompt = sum(r[1] for r in results)
    total_completion = sum(r[2] for r in results)

    return GenerationResult(
        images=images,
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
        elapsed_seconds=elapsed,
        approach="multi_call",
        model=GEMINI_IMAGE_MODEL,
    )


def generate_comparison_html(
    prompt: str,
    results: list[GenerationResult],
    output_path: Path,
):
    """Generate side-by-side HTML comparison."""

    def images_to_data_urls(images: list[bytes]) -> list[str]:
        urls = []
        for img in images:
            # Detect format
            if img[:8] == b'\x89PNG\r\n\x1a\n':
                mime = "image/png"
            elif img[:2] == b'\xff\xd8':
                mime = "image/jpeg"
            else:
                mime = "image/png"
            b64 = base64.b64encode(img).decode()
            urls.append(f"data:{mime};base64,{b64}")
        return urls

    # Build columns HTML
    columns_html = ""
    for result in results:
        urls = images_to_data_urls(result.images)

        # Calculate cost (approximate)
        INPUT_COST_PER_1M = 0.075
        OUTPUT_COST_PER_1M = 0.30
        cost = (
            result.prompt_tokens * INPUT_COST_PER_1M / 1_000_000 +
            result.completion_tokens * OUTPUT_COST_PER_1M / 1_000_000
        )

        images_grid = ""
        if urls:
            images_grid = "\n".join(f'<img src="{url}" alt="Generated {i+1}">' for i, url in enumerate(urls))
        else:
            images_grid = '<div class="no-images">No images generated</div>'

        columns_html += f"""
        <div class="column">
            <h2>{result.approach} <span class="model">({result.model})</span></h2>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">{len(result.images)}</div>
                    <div class="stat-label">Images</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{result.prompt_tokens:,}</div>
                    <div class="stat-label">Input Tokens</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{result.completion_tokens:,}</div>
                    <div class="stat-label">Output Tokens</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{result.elapsed_seconds:.1f}s</div>
                    <div class="stat-label">Time</div>
                </div>
            </div>
            <div class="images">
                {images_grid}
            </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Batch vs Multi-Call Generation Comparison</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: #e5e5e5;
            padding: 2rem;
        }}
        h1 {{
            text-align: center;
            margin-bottom: 1rem;
            font-weight: 500;
        }}
        .prompt {{
            text-align: center;
            color: #888;
            margin-bottom: 2rem;
            font-style: italic;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }}
        .comparison {{
            display: grid;
            grid-template-columns: repeat({len(results)}, 1fr);
            gap: 1.5rem;
            max-width: 1800px;
            margin: 0 auto;
        }}
        .column {{
            background: #141414;
            border-radius: 12px;
            padding: 1.5rem;
        }}
        .column h2 {{
            font-size: 1rem;
            margin-bottom: 1rem;
            color: #fff;
        }}
        .model {{
            color: #666;
            font-weight: 400;
            font-size: 0.8rem;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
            margin-bottom: 1rem;
            font-size: 0.85rem;
        }}
        .stat {{
            background: #1a1a1a;
            padding: 0.5rem;
            border-radius: 6px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 1.1rem;
            font-weight: 600;
            color: #fff;
        }}
        .stat-label {{
            color: #666;
            font-size: 0.7rem;
        }}
        .images {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }}
        .images img {{
            width: 100%;
            aspect-ratio: 1;
            object-fit: cover;
            border-radius: 6px;
            background: #222;
        }}
        .no-images {{
            text-align: center;
            color: #666;
            padding: 2rem;
            background: #1a1a1a;
            border-radius: 6px;
            grid-column: span 2;
        }}
    </style>
</head>
<body>
    <h1>Image Generation Comparison</h1>
    <p class="prompt">Prompt: "{prompt}"</p>

    <div class="comparison">
        {columns_html}
    </div>
</body>
</html>
"""

    output_path.write_text(html)
    print(f"Comparison HTML written to: {output_path}")


async def main():
    """Run the comparison test."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set")
        return

    client = genai.Client(api_key=api_key)

    # Test prompt
    prompt = "A serene Japanese garden with a koi pond, cherry blossoms, and a traditional wooden bridge"
    variation_prompt = "Create a variation of this reference image in a different style"
    count = 4

    print(f"Testing generation approaches")
    print(f"Base prompt: '{prompt}'")
    print(f"Requested count: {count}")
    print("=" * 70)

    # === PHASE 1: Generate a reference image to use as context ===
    print("\n[0/4] Generating reference image for context tests...")
    ref_result = await generate_batch_single_call(client, prompt, 1)
    if not ref_result.images:
        print("  ERROR: Could not generate reference image. Aborting context tests.")
        return
    context_image = ref_result.images[0]
    print(f"  Reference image generated ({len(context_image):,} bytes)")

    results = []

    # === PHASE 2: Test WITHOUT context images (baseline) ===
    print("\n" + "=" * 70)
    print("PART A: WITHOUT context images (text-only prompt)")
    print("=" * 70)

    # Test 1: Imagen batch (native batch support)
    print("\n[1/4] Imagen batch (native number_of_images param)...")
    imagen_result = await generate_with_imagen_batch(client, prompt, count)
    print(f"  Generated {len(imagen_result.images)} images in {imagen_result.elapsed_seconds:.1f}s")
    print(f"  (Imagen uses per-image pricing, not token-based)")
    results.append(imagen_result)

    # Test 2: Gemini single-call (prompt asks for N images)
    print("\n[2/4] Gemini single-call (prompt asks for 4 images)...")
    single_result = await generate_batch_single_call(client, prompt, count)
    single_result.approach = "gemini_single_NO_ctx"
    print(f"  Generated {len(single_result.images)} images")
    print(f"  Tokens: {single_result.prompt_tokens} input, {single_result.completion_tokens} output")
    print(f"  Time: {single_result.elapsed_seconds:.1f}s")
    results.append(single_result)

    # Test 3: Multi-call parallel (current approach)
    print("\n[3/4] Multi-call parallel (4 separate API calls)...")
    multi_result = await generate_multi_call(client, prompt, count)
    multi_result.approach = "multi_call_NO_ctx"
    print(f"  Generated {len(multi_result.images)} images")
    print(f"  Tokens: {multi_result.prompt_tokens} input (TOTAL across {count} calls)")
    print(f"  Time: {multi_result.elapsed_seconds:.1f}s (parallel)")
    results.append(multi_result)

    # === PHASE 3: Test WITH context image ===
    print("\n" + "=" * 70)
    print("PART B: WITH context image (image-to-image)")
    print("This is where token savings matter most!")
    print("=" * 70)

    # Test 4: Single-call WITH context
    print("\n[4a/4] Gemini single-call WITH context image...")
    single_ctx = await generate_batch_single_call(client, variation_prompt, count, context_image)
    single_ctx.approach = "gemini_single_WITH_ctx"
    print(f"  Generated {len(single_ctx.images)} images")
    print(f"  Tokens: {single_ctx.prompt_tokens} input (context image counted ONCE)")
    print(f"  Time: {single_ctx.elapsed_seconds:.1f}s")
    results.append(single_ctx)

    # Test 5: Multi-call WITH context
    print("\n[4b/4] Multi-call parallel WITH context image...")
    multi_ctx = await generate_multi_call(client, variation_prompt, count, context_image)
    multi_ctx.approach = "multi_call_WITH_ctx"
    print(f"  Generated {len(multi_ctx.images)} images")
    print(f"  Tokens: {multi_ctx.prompt_tokens} input (context image counted {count}x!)")
    print(f"  Time: {multi_ctx.elapsed_seconds:.1f}s (parallel)")
    results.append(multi_ctx)

    # Generate comparison HTML
    print("\n" + "=" * 70)
    output_path = Path(__file__).parent.parent.parent / "batch_comparison.html"
    generate_comparison_html(prompt, results, output_path)

    # Summary
    print("\n=== SUMMARY ===")
    print(f"{'Approach':<25} {'Images':>7} {'Input Tokens':>13} {'Time':>8}")
    print("-" * 55)
    for r in results:
        print(f"{r.approach:<25} {len(r.images):>7} {r.prompt_tokens:>13,} {r.elapsed_seconds:>7.1f}s")

    # Token savings calculation
    if single_ctx.prompt_tokens > 0 and multi_ctx.prompt_tokens > 0:
        savings = multi_ctx.prompt_tokens - single_ctx.prompt_tokens
        pct = (savings / multi_ctx.prompt_tokens) * 100
        print(f"\n=== TOKEN SAVINGS WITH CONTEXT IMAGE ===")
        print(f"Single-call: {single_ctx.prompt_tokens:,} tokens")
        print(f"Multi-call:  {multi_ctx.prompt_tokens:,} tokens")
        print(f"Savings:     {savings:,} tokens ({pct:.0f}%)")


if __name__ == "__main__":
    asyncio.run(main())
