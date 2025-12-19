"""
Quick test for Issue #27 and #28: Image overlay buttons positioning.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5180"
SCREENSHOT_DIR = Path("/tmp/pageant_screenshots")

def main():
    SCREENSHOT_DIR.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Take initial screenshot
        page.screenshot(path=str(SCREENSHOT_DIR / "buttons_test_initial.png"), full_page=True)
        print(f"Initial screenshot saved")

        # Find the image container and hover over it
        # The image should be in the main stage area
        image = page.locator('img[alt]').first
        if image.count() > 0:
            print("Found image, hovering...")

            # Hover to trigger button visibility
            image.hover()
            page.wait_for_timeout(500)

            # Take screenshot with hover state
            page.screenshot(path=str(SCREENSHOT_DIR / "buttons_test_hover.png"), full_page=True)
            print(f"Hover screenshot saved")

            # Check if buttons are visible
            sparkle_button = page.locator('button:has(svg)').filter(has=page.locator('[class*="Sparkles"]')).or_(
                page.locator('[tooltip="More like this"]')
            )

            # Look for the IconButton elements that should appear on hover
            overlay_buttons = page.locator('.bg-surface\\/90').all()
            print(f"Found {len(overlay_buttons)} overlay buttons")

            # Check the overlay structure
            overlay = page.locator('[class*="from-ink"]')
            if overlay.count() > 0:
                box = overlay.bounding_box()
                if box:
                    print(f"Overlay bounds: x={box['x']:.0f}, y={box['y']:.0f}, w={box['width']:.0f}, h={box['height']:.0f}")

            # Get image bounds
            img_box = image.bounding_box()
            if img_box:
                print(f"Image bounds: x={img_box['x']:.0f}, y={img_box['y']:.0f}, w={img_box['width']:.0f}, h={img_box['height']:.0f}")

        else:
            print("No image found on page")

        browser.close()

    print(f"\nScreenshots in: {SCREENSHOT_DIR}")

if __name__ == "__main__":
    main()
