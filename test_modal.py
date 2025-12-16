"""Test the modal functionality."""
from playwright.sync_api import sync_playwright

def test_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        context.tracing.start(screenshots=True, snapshots=True, sources=True)

        logs = []
        page = context.new_page()
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

        try:
            # Navigate to app (preview mode uses 4173)
            print("1. Navigating to app...")
            page.goto('http://localhost:4173')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)
            page.screenshot(path='/tmp/modal_1_initial.png')

            # Look for Save as Template button
            save_template_btn = page.locator('button:has-text("Save as Template")')
            if save_template_btn.is_visible():
                print("2. Clicking Save as Template...")
                save_template_btn.click()
                page.wait_for_timeout(1000)
                page.screenshot(path='/tmp/modal_2_save_template.png')
                print("   Screenshot saved!")

                # Check if modal appeared
                modal = page.locator('[class*="fixed"][class*="z-50"]')
                if modal.count() > 0:
                    print("   Modal is visible!")
                else:
                    print("   Modal NOT visible - checking for any dialogs...")
                    # Check for any dialog elements
                    dialogs = page.locator('dialog, [role="dialog"], [class*="Dialog"], [class*="modal"]')
                    print(f"   Found {dialogs.count()} dialog-like elements")

                # Press Escape to close
                page.keyboard.press('Escape')
                page.wait_for_timeout(500)

            # Also try Delete Prompt button
            delete_btn = page.locator('button:has-text("Delete Prompt")')
            if delete_btn.is_visible():
                print("3. Clicking Delete Prompt...")
                delete_btn.click()
                page.wait_for_timeout(1000)
                page.screenshot(path='/tmp/modal_3_delete.png')
                print("   Screenshot saved!")

                # Press Escape to close
                page.keyboard.press('Escape')
                page.wait_for_timeout(500)

            context.tracing.stop(path="/tmp/modal_trace.zip")
            print("\nConsole logs:")
            for log in logs[-15:]:
                print(f"  {log}")
            print("\nDone! Screenshots in /tmp/modal_*.png")

        except Exception as e:
            context.tracing.stop(path="/tmp/modal_trace_FAILED.zip")
            page.screenshot(path='/tmp/modal_FAILED.png')
            print(f"Error: {e}")
            print("\nConsole logs:")
            for log in logs[-15:]:
                print(f"  {log}")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    test_modal()
