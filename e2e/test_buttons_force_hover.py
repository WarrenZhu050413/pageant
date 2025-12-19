"""
Force hover state to test button visibility.
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

        # Force the overlay to be visible by adding CSS
        page.evaluate("""
            () => {
                // Find all overlays and make them visible
                const overlays = document.querySelectorAll('[class*="opacity-0"][class*="hover:opacity-100"]');
                overlays.forEach(el => {
                    el.classList.remove('opacity-0');
                    el.classList.add('opacity-100');
                });
                console.log('Found and modified', overlays.length, 'overlays');
            }
        """)

        page.wait_for_timeout(500)

        # Take screenshot with forced visibility
        page.screenshot(path=str(SCREENSHOT_DIR / "buttons_forced_visible.png"), full_page=True)
        print("Forced visibility screenshot saved")

        # Check overlay button positions
        result = page.evaluate("""
            () => {
                const overlay = document.querySelector('[class*="from-ink"]');
                const img = document.querySelector('img[class*="object-contain"]');
                const buttonContainer = document.querySelector('[class*="bottom-3"]');

                let data = { overlay: null, img: null, buttons: null, problem: null };

                if (overlay) {
                    const rect = overlay.getBoundingClientRect();
                    data.overlay = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
                }

                if (img) {
                    const rect = img.getBoundingClientRect();
                    data.img = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
                }

                if (buttonContainer) {
                    const rect = buttonContainer.getBoundingClientRect();
                    data.buttons = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };

                    // Check if buttons extend past viewport
                    if (rect.bottom > window.innerHeight) {
                        data.problem = 'Buttons extend below viewport';
                    }
                }

                // Check if overlay extends past image
                if (data.overlay && data.img) {
                    if (data.overlay.bottom > data.img.bottom + 5) {
                        data.problem = (data.problem || '') + ' Overlay extends past image bottom';
                    }
                }

                return data;
            }
        """)

        print(f"Overlay: {result.get('overlay')}")
        print(f"Image: {result.get('img')}")
        print(f"Buttons: {result.get('buttons')}")
        if result.get('problem'):
            print(f"⚠️ Problem detected: {result['problem']}")
        else:
            print("✅ No positioning problems detected")

        browser.close()

if __name__ == "__main__":
    main()
