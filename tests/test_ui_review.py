"""
Comprehensive UI Review Test for Pageant React Migration
Tests all major UI components, interactions, and takes screenshots for review.
"""
import os
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:5173"
SCREENSHOTS_DIR = "/tmp/pageant_ui_review"

def setup():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def test_comprehensive_ui_review():
    setup()
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()

        # Capture console logs
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: logs.append(f"[PAGE ERROR] {err}"))

        try:
            # 1. Initial Load
            print("\n=== 1. Testing Initial Load ===")
            page.goto(BASE_URL)
            page.wait_for_load_state('networkidle')
            page.screenshot(path=f"{SCREENSHOTS_DIR}/01_initial_load.png", full_page=True)
            print("  - Initial page loaded")

            # Check main layout exists
            app_shell = page.locator('[class*="grid"]').first
            expect(app_shell).to_be_visible(timeout=5000)
            print("  - App shell grid layout visible")

            # 2. Left Sidebar Analysis
            print("\n=== 2. Testing Left Sidebar ===")

            # Check header
            header = page.locator('text="Pageant"')
            expect(header).to_be_visible(timeout=3000)
            print("  - Header 'Pageant' visible")

            # Check tabs
            tabs = ['Prompts', 'Collections', 'Templates', 'Favorites']
            for tab in tabs:
                tab_btn = page.locator(f'button:has-text("{tab}")')
                expect(tab_btn).to_be_visible(timeout=3000)
                print(f"  - Tab '{tab}' visible")

            # Click through tabs and screenshot each
            for tab in tabs:
                page.locator(f'button:has-text("{tab}")').click()
                page.wait_for_timeout(300)  # Allow animation
                page.screenshot(path=f"{SCREENSHOTS_DIR}/02_tab_{tab.lower()}.png", full_page=True)
                print(f"  - Tab '{tab}' clicked and screenshotted")

            # Return to Prompts tab
            page.locator('button:has-text("Prompts")').click()
            page.wait_for_timeout(300)

            # 3. Notes Section
            print("\n=== 3. Testing Notes Section ===")
            notes_toggle = page.locator('button:has-text("Notes")')
            if notes_toggle.is_visible():
                notes_toggle.click()
                page.wait_for_timeout(300)
                page.screenshot(path=f"{SCREENSHOTS_DIR}/03_notes_expanded.png", full_page=True)
                print("  - Notes section toggled")

            # 4. Main Stage Analysis
            print("\n=== 4. Testing Main Stage ===")

            # Check view mode buttons
            view_buttons = page.locator('header button').all()
            print(f"  - Found {len(view_buttons)} header buttons")

            # Check for Select and Batch buttons
            select_btn = page.locator('button:has-text("Select")')
            batch_btn = page.locator('button:has-text("Batch")')
            expect(select_btn).to_be_visible(timeout=3000)
            expect(batch_btn).to_be_visible(timeout=3000)
            print("  - Select and Batch buttons visible")

            # Test Select mode
            select_btn.click()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SCREENSHOTS_DIR}/04_select_mode.png", full_page=True)
            print("  - Select mode activated")

            # Test Batch mode
            batch_btn.click()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SCREENSHOTS_DIR}/04_batch_mode.png", full_page=True)
            print("  - Batch mode activated")

            # Deactivate batch mode
            batch_btn.click()
            page.wait_for_timeout(300)

            # 5. Right Panel Analysis
            print("\n=== 5. Testing Right Panel ===")

            # Check right panel tabs
            right_tabs = ['Info', 'Generate', 'Settings']
            for tab in right_tabs:
                tab_btn = page.locator(f'button:has-text("{tab}")')
                if tab_btn.is_visible():
                    tab_btn.click()
                    page.wait_for_timeout(300)
                    page.screenshot(path=f"{SCREENSHOTS_DIR}/05_right_{tab.lower()}.png", full_page=True)
                    print(f"  - Right panel tab '{tab}' visible and clicked")

            # 6. Generate Tab Deep Dive
            print("\n=== 6. Testing Generate Tab ===")
            page.locator('button:has-text("Generate")').click()
            page.wait_for_timeout(300)

            # Check form elements
            prompt_textarea = page.locator('textarea').first
            if prompt_textarea.is_visible():
                prompt_textarea.fill("A beautiful sunset over mountains")
                page.screenshot(path=f"{SCREENSHOTS_DIR}/06_generate_filled.png", full_page=True)
                print("  - Prompt textarea filled")

            # Check count selector
            count_buttons = page.locator('button:has-text("1"), button:has-text("2"), button:has-text("4"), button:has-text("8")').all()
            print(f"  - Found {len(count_buttons)} count buttons")

            # Check generate button
            gen_btn = page.locator('button:has-text("Generate Images"), button:has-text("Generate")')
            if gen_btn.first.is_visible():
                print("  - Generate button visible")

            # 7. Settings Tab Deep Dive
            print("\n=== 7. Testing Settings Tab ===")
            settings_tab = page.locator('button:has-text("Settings")')
            if settings_tab.is_visible():
                settings_tab.click()
                page.wait_for_timeout(300)
                page.screenshot(path=f"{SCREENSHOTS_DIR}/07_settings.png", full_page=True)
                print("  - Settings tab opened")

            # 8. Responsive Layout Check
            print("\n=== 8. Testing Layout Dimensions ===")

            # Get layout measurements
            html = page.content()

            # Check for three-column layout
            grid_container = page.evaluate('''() => {
                const el = document.querySelector('[class*="grid-cols"]');
                if (el) {
                    const style = window.getComputedStyle(el);
                    return {
                        display: style.display,
                        gridTemplateColumns: style.gridTemplateColumns,
                        width: el.offsetWidth,
                        height: el.offsetHeight
                    };
                }
                return null;
            }''')
            print(f"  - Grid container: {grid_container}")

            # 9. Color and Typography Check
            print("\n=== 9. Testing Design System ===")

            # Check CSS variables are applied
            css_vars = page.evaluate('''() => {
                const root = document.documentElement;
                const style = getComputedStyle(root);
                return {
                    fontDisplay: style.getPropertyValue('--font-display'),
                    fontBody: style.getPropertyValue('--font-body'),
                    colorBrass: style.getPropertyValue('--color-brass'),
                    colorSurface: style.getPropertyValue('--color-surface'),
                };
            }''')
            print(f"  - CSS Variables: {css_vars}")

            # 10. Animation Check
            print("\n=== 10. Testing Animations ===")

            # Click tabs rapidly to check animations
            page.locator('button:has-text("Collections")').click()
            page.wait_for_timeout(100)
            page.locator('button:has-text("Templates")').click()
            page.wait_for_timeout(100)
            page.locator('button:has-text("Prompts")').click()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SCREENSHOTS_DIR}/10_after_animations.png", full_page=True)
            print("  - Tab animations tested")

            # Final full-page screenshot
            page.screenshot(path=f"{SCREENSHOTS_DIR}/11_final_state.png", full_page=True)

            # Save trace
            context.tracing.stop(path=f"{SCREENSHOTS_DIR}/trace.zip")

            print("\n=== Console Logs ===")
            for log in logs[-30:]:
                print(f"  {log}")

            print(f"\n=== Screenshots saved to: {SCREENSHOTS_DIR} ===")
            print("Run: open " + SCREENSHOTS_DIR)

        except Exception as e:
            print(f"\n!!! ERROR: {e}")
            page.screenshot(path=f"{SCREENSHOTS_DIR}/error_state.png", full_page=True)
            context.tracing.stop(path=f"{SCREENSHOTS_DIR}/trace_error.zip")

            print("\n=== Console Logs (last 30) ===")
            for log in logs[-30:]:
                print(f"  {log}")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    test_comprehensive_ui_review()
