"""
Test buttons on images of different aspect ratios.
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
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Get list of prompts in sidebar
        prompt_items = page.locator('[class*="rounded-lg"]').all()
        print(f"Found {len(prompt_items)} items in sidebar")

        # Test each prompt to find different image sizes
        for i, item in enumerate(prompt_items[:5]):  # Test first 5
            try:
                item.click()
                page.wait_for_timeout(500)

                # Force overlay visible
                page.evaluate("""
                    () => {
                        const overlays = document.querySelectorAll('[class*="opacity-0"][class*="hover:opacity-100"]');
                        overlays.forEach(el => {
                            el.classList.remove('opacity-0');
                            el.classList.add('opacity-100');
                        });
                    }
                """)
                page.wait_for_timeout(200)

                # Check dimensions
                result = page.evaluate("""
                    () => {
                        const img = document.querySelector('img[class*="object-contain"]');
                        const buttons = document.querySelector('[class*="bottom-3"]');
                        const viewport = { width: window.innerWidth, height: window.innerHeight };

                        if (!img || !buttons) return null;

                        const imgRect = img.getBoundingClientRect();
                        const btnRect = buttons.getBoundingClientRect();

                        return {
                            imgWidth: imgRect.width,
                            imgHeight: imgRect.height,
                            aspectRatio: (imgRect.width / imgRect.height).toFixed(2),
                            imgBottom: imgRect.bottom,
                            btnBottom: btnRect.bottom,
                            viewportHeight: viewport.height,
                            buttonsVisible: btnRect.bottom <= viewport.height,
                            buttonsInImage: btnRect.bottom <= imgRect.bottom + 10
                        };
                    }
                """)

                if result:
                    print(f"\nPrompt {i+1}: {result['imgWidth']:.0f}x{result['imgHeight']:.0f} (AR: {result['aspectRatio']})")
                    print(f"  Image bottom: {result['imgBottom']:.0f}, Buttons bottom: {result['btnBottom']:.0f}")
                    print(f"  Viewport: {result['viewportHeight']}")
                    print(f"  Buttons visible: {result['buttonsVisible']}, In image: {result['buttonsInImage']}")

                    if not result['buttonsVisible']:
                        print(f"  ⚠️ ISSUE: Buttons below viewport!")
                        page.screenshot(path=str(SCREENSHOT_DIR / f"issue_prompt_{i+1}.png"), full_page=True)

                    if not result['buttonsInImage']:
                        print(f"  ⚠️ ISSUE: Buttons extend past image!")
                        page.screenshot(path=str(SCREENSHOT_DIR / f"overlap_prompt_{i+1}.png"), full_page=True)

            except Exception as e:
                print(f"Error testing prompt {i+1}: {e}")

        browser.close()

if __name__ == "__main__":
    main()
