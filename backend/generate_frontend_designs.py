#!/usr/bin/env python3
"""Generate 10 frontend design examples for the Pageant showcase."""

import asyncio
import base64
import json
from datetime import datetime
from pathlib import Path

from gemini_service import GeminiService

# 10 Diverse Frontend Design Examples
FRONTEND_DESIGNS = [
    {
        "id": "brutalist-portfolio",
        "title": "Brutalist Portfolio",
        "category": "Frontend Design",
        "prompt": """Design a brutalist portfolio website homepage. Raw concrete textures,
        stark black and white with single red accent, exposed grid system visible,
        intentionally rough typography using Impact and Courier, oversized project
        thumbnails that overlap the grid. Anti-aesthetic aesthetic. Include navigation,
        hero section, and project previews. Desktop view, full page screenshot style.""",
        "use_for": "Portfolio websites with bold artistic statement",
    },
    {
        "id": "glassmorphism-dashboard",
        "title": "Glassmorphism Analytics Dashboard",
        "category": "Frontend Design",
        "prompt": """Design a premium analytics dashboard with heavy glassmorphism effects.
        Dark purple to midnight blue gradient background with floating glass panels.
        Frosted glass cards showing real-time metrics, charts, and user activity.
        Subtle blur effects, delicate white borders, soft shadows. Include sidebar
        navigation, header with avatar, multiple chart widgets (line, bar, donut),
        and a data table. Modern, luxurious feel. Desktop 1440px width.""",
        "use_for": "Data visualization dashboards for SaaS products",
    },
    {
        "id": "retro-synthwave-landing",
        "title": "Synthwave Music App Landing",
        "category": "Frontend Design",
        "prompt": """Design a music streaming app landing page in full synthwave/retrowave
        aesthetic. Neon pink and cyan on dark purple/black. Chrome text effects,
        sunset gradient horizon, grid perspective floor, palm tree silhouettes.
        Include hero with glowing CTA button, feature cards with neon borders,
        playlist preview section, and footer. 80s retro-futurism meets modern UI.
        Dramatic, atmospheric, nostalgic. Full page view.""",
        "use_for": "Entertainment and music app landing pages",
    },
    {
        "id": "organic-wellness-app",
        "title": "Organic Wellness Mobile App",
        "category": "Frontend Design",
        "prompt": """Design a wellness/meditation mobile app interface. Soft, organic shapes
        with no sharp corners. Sage green, warm sand, and cream color palette.
        Hand-drawn botanical illustrations as decorative elements. Rounded cards for
        meditation sessions, breathing exercise timer with circular progress, daily
        mood tracker. Include bottom navigation, header with greeting, and content
        cards. Calming, natural, approachable. Mobile frame 390px width.""",
        "use_for": "Health and wellness mobile applications",
    },
    {
        "id": "neubrutalism-saas",
        "title": "Neubrutalist SaaS Pricing",
        "category": "Frontend Design",
        "prompt": """Design a SaaS pricing page in neubrutalist style. Bold black borders,
        solid bright colors (yellow, pink, blue), intentional drop shadows offset
        at sharp angles. Playful yet professional. Three pricing tiers with thick
        outlined cards, chunky buttons, bold sans-serif typography. Include feature
        comparison checkmarks, popular badge, and FAQ accordion. Fun, energetic,
        memorable. Desktop view.""",
        "use_for": "SaaS product pricing and marketing pages",
    },
    {
        "id": "editorial-magazine",
        "title": "Editorial Magazine Layout",
        "category": "Frontend Design",
        "prompt": """Design a high-end editorial magazine website article page. Large serif
        typography (like Playfair Display), generous whitespace, pull quotes in
        oversized text. Black, white, and gold accent color scheme. Full-bleed
        hero image, elegant drop caps, asymmetrical image placements within text.
        Include article header, author byline, body text with inline images, and
        related articles footer. Sophisticated, timeless, refined. Desktop view.""",
        "use_for": "Editorial content, blogs, and magazine websites",
    },
    {
        "id": "cyberpunk-game-ui",
        "title": "Cyberpunk Game Interface",
        "category": "Frontend Design",
        "prompt": """Design a cyberpunk-style game interface/HUD. Dark background with
        neon cyan and hot pink accents. Angular, futuristic UI elements with
        glitch effects and scan lines. Include health/energy bars with glow,
        minimap with hex grid, inventory slots, quest tracker, and bottom hotbar.
        Warning indicators, data streams, holographic effects. Tech-noir aesthetic.
        1920x1080 game UI overlay style.""",
        "use_for": "Game UI design and sci-fi interfaces",
    },
    {
        "id": "minimalist-ecommerce",
        "title": "Minimalist Luxury E-Commerce",
        "category": "Frontend Design",
        "prompt": """Design a minimalist luxury e-commerce product page. Near-monochromatic
        scheme with off-white background and charcoal text. Single product hero with
        large photography, minimal UI chrome. Thin elegant typography (like Didot),
        subtle hover states, price displayed with refined spacing. Include product
        images, size selector, add to cart, and product details accordion.
        Sophisticated restraint, every element purposeful. Desktop view.""",
        "use_for": "High-end e-commerce and fashion retail",
    },
    {
        "id": "indie-dev-tools",
        "title": "Indie Developer Tools Dashboard",
        "category": "Frontend Design",
        "prompt": """Design a developer tools dashboard with indie/craft aesthetic. Dark
        mode with warm orange and amber accents on near-black. Monospace font for
        code/data, friendly sans-serif for UI. Include API usage charts, endpoint
        list with status indicators, code snippet panels with syntax highlighting,
        and webhook logs. Cozy terminal vibes mixed with modern UI patterns.
        Approachable yet technical. Desktop 1280px width.""",
        "use_for": "Developer tools and API dashboards",
    },
    {
        "id": "whimsical-education",
        "title": "Whimsical Education Platform",
        "category": "Frontend Design",
        "prompt": """Design a children's education platform course page. Playful, colorful
        with rounded everything. Pastel rainbow palette with deeper purple anchors.
        Illustrated characters and icons, progress indicators with stars and badges,
        lesson cards that look like game levels. Include course header with progress
        ring, video lesson card, quiz cards, and achievement badges. Delightful,
        encouraging, engaging for young learners. Desktop view.""",
        "use_for": "Educational platforms for children and gamified learning",
    },
]


async def generate_all_designs(output_dir: Path, api_key: str):
    """Generate all frontend design images."""
    service = GeminiService(api_key=api_key)
    results = []

    output_dir.mkdir(parents=True, exist_ok=True)

    # Load existing metadata if present
    metadata_path = output_dir / "metadata.json"
    existing_metadata = {"images": []}
    if metadata_path.exists():
        with open(metadata_path) as f:
            existing_metadata = json.load(f)

    for i, design in enumerate(FRONTEND_DESIGNS, 1):
        print(f"\n[{i}/{len(FRONTEND_DESIGNS)}] {design['title']}")
        print(f"    Category: {design['category']}")

        try:
            result = await service.generate_image(design["prompt"])

            if result.images:
                img_data = result.images[0]
                img_bytes = base64.b64decode(img_data["data"])

                ext = "png" if "png" in img_data["mime_type"] else "jpg"
                img_path = output_dir / f"{design['id']}.{ext}"
                img_path.write_bytes(img_bytes)
                print(f"    ✓ Saved: {img_path.name}")

                results.append({
                    "id": design["id"],
                    "title": design["title"],
                    "category": design["category"],
                    "prompt": design["prompt"],
                    "use_for": design["use_for"],
                    "image_path": img_path.name,
                    "mime_type": img_data["mime_type"],
                    "model_response": result.text,
                    "usage": result.usage,
                    "generated_at": datetime.now().isoformat(),
                })
            else:
                print(f"    ✗ No image generated")

        except Exception as e:
            print(f"    ✗ Error: {e}")

        if i < len(FRONTEND_DESIGNS):
            await asyncio.sleep(1)

    # Merge with existing metadata
    existing_ids = {img["id"] for img in existing_metadata["images"]}
    for new_img in results:
        if new_img["id"] not in existing_ids:
            existing_metadata["images"].append(new_img)
        else:
            # Update existing
            for i, img in enumerate(existing_metadata["images"]):
                if img["id"] == new_img["id"]:
                    existing_metadata["images"][i] = new_img
                    break

    existing_metadata["generated_at"] = datetime.now().isoformat()
    existing_metadata["model"] = service.DEFAULT_IMAGE_MODEL

    with open(metadata_path, "w") as f:
        json.dump(existing_metadata, f, indent=2)

    print(f"\n✓ Metadata saved: {metadata_path}")
    return results


async def main():
    api_key_path = Path.home() / ".gemini" / "apikey.txt"
    api_key = api_key_path.read_text().strip()

    output_dir = Path(__file__).parent.parent / "generated_images"

    print("=" * 60)
    print("GEMINI NANO BANANA PRO - FRONTEND DESIGN GENERATOR")
    print("=" * 60)
    print(f"Output: {output_dir}")
    print(f"Designs: {len(FRONTEND_DESIGNS)}")

    results = await generate_all_designs(output_dir, api_key)

    successful = len([r for r in results if r.get("image_path")])
    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {successful}/{len(FRONTEND_DESIGNS)} designs generated")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
