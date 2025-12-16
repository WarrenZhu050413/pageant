"""Test all view modes and take screenshots"""
from playwright.sync_api import sync_playwright, expect

SCREENSHOTS_DIR = "/tmp/pageant_ui_review"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    page.goto("http://localhost:5173")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(500)

    # Test 1: Single View (default)
    print("1. Single View")
    page.screenshot(path=f"{SCREENSHOTS_DIR}/view_single.png")

    # Test 2: Grid View
    print("2. Grid View")
    grid_btn = page.locator('button[class*="rounded-lg"]:has(svg)').nth(1)  # Grid button
    page.keyboard.press("2")  # Keyboard shortcut
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/view_grid.png")

    # Test 3: Compare View
    print("3. Compare View")
    page.keyboard.press("3")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/view_compare.png")

    # Back to single
    page.keyboard.press("1")
    page.wait_for_timeout(300)

    # Test 4: Navigate images with arrow keys
    print("4. Navigate images")
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/nav_next.png")

    # Test 5: Toggle favorite
    print("5. Toggle favorite")
    page.keyboard.press("f")
    page.wait_for_timeout(300)

    # Test 6: Select mode
    print("6. Select mode")
    page.keyboard.press("s")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/mode_select.png")

    # Exit select mode
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    # Test 7: Batch mode
    print("7. Batch mode")
    page.keyboard.press("b")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/mode_batch.png")

    # Exit batch mode
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    # Test 8: Go to Generate tab
    print("8. Generate tab")
    page.keyboard.press("g")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/tab_generate.png")

    # Test 9: Different prompt selection
    print("9. Different prompt")
    second_prompt = page.locator('[class*="rounded-lg"]:has(img)').nth(2)
    if second_prompt.is_visible():
        second_prompt.click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/prompt_change.png")

    # Test 10: Grid view with multiple images
    print("10. Grid with images")
    page.keyboard.press("2")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SCREENSHOTS_DIR}/grid_with_images.png")

    print("\nAll screenshots saved!")

    # Print any errors
    errors = [l for l in logs if 'error' in l.lower()]
    if errors:
        print("\nErrors found:")
        for e in errors[-10:]:
            print(f"  {e}")

    browser.close()
