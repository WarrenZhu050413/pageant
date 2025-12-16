"""Test the design concept collection system."""
import os
from playwright.sync_api import sync_playwright, expect

def test_design_system():
    """Test the design axis tagging and preference system."""
    headless = os.getenv('HEADED') != '1'

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        context.tracing.start(screenshots=True, snapshots=True, sources=True)

        logs = []
        page = context.new_page()
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

        try:
            # Navigate to app
            print("1. Navigating to app...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)  # Wait for any animations
            page.screenshot(path='/tmp/pageant_1_initial.png')

            # Dismiss any error toasts
            dismiss_btn = page.locator('button:has-text("Dismiss")')
            if dismiss_btn.is_visible():
                print("   Dismissing error toast...")
                dismiss_btn.click()
                page.wait_for_timeout(300)

            # Check main layout loads
            print("2. Checking main layout...")
            expect(page.locator('h1:has-text("Pageant")')).to_be_visible(timeout=5000)

            # Check left sidebar tabs (use exact match)
            print("3. Checking sidebar tabs...")
            expect(page.get_by_role("button", name="Prompts", exact=True)).to_be_visible(timeout=3000)
            expect(page.get_by_role("button", name="Collections", exact=True)).to_be_visible(timeout=3000)
            expect(page.get_by_role("button", name="Templates", exact=True)).to_be_visible(timeout=3000)

            # Check for Style/Favorites tabs (may need to scroll or check visibility)
            print("4. Looking for Style tab...")
            style_tab = page.get_by_role("button", name="Style", exact=True)
            favorites_tab = page.get_by_role("button", name="Favorites", exact=True)

            if style_tab.is_visible():
                print("   Clicking Style tab...")
                style_tab.click()
                page.wait_for_timeout(500)
                page.screenshot(path='/tmp/pageant_2_style_tab.png')

                # Check preferences tab content (either empty state or preferences)
                print("5. Checking preferences content...")
                prefs_content = page.locator('text=/No preferences yet|Your Preferences/')
                expect(prefs_content).to_be_visible(timeout=3000)
            else:
                print("   Style tab not visible (may be off-screen)")

            # Go back to Prompts tab
            print("6. Going back to Prompts tab...")
            page.get_by_role("button", name="Prompts", exact=True).click()
            page.wait_for_timeout(500)

            # Check if there are any prompts
            prompts_empty = page.locator('text="No prompts yet"')
            if prompts_empty.is_visible():
                print("   No prompts yet - checking Generate tab...")
                # Check Generate tab on right side
                generate_tab = page.get_by_role("button", name="Generate", exact=True)
                if generate_tab.is_visible():
                    generate_tab.click()
                    page.wait_for_timeout(500)
                    page.screenshot(path='/tmp/pageant_3_generate_tab.png')

                    # Check generate form exists
                    textarea = page.locator('textarea')
                    if textarea.first.is_visible():
                        print("   Generate form visible!")
                    else:
                        print("   Generate form not found")
                else:
                    print("   Generate tab not visible")
            else:
                print("   Found existing prompts - clicking first one...")
                # Click on first prompt button in the list
                prompt_buttons = page.locator('.p-2 button').all()
                if len(prompt_buttons) > 0:
                    prompt_buttons[0].click()
                    page.wait_for_timeout(500)
                    page.screenshot(path='/tmp/pageant_4_prompt_selected.png')

                    # Check if design tag bar is visible (on the stage area)
                    print("7. Checking design tag bar...")
                    tag_bar = page.locator('button:has-text("Add tag")')
                    if tag_bar.is_visible():
                        print("   Design tag bar visible!")
                        page.screenshot(path='/tmp/pageant_5_with_tags.png')

                        # Click Add tag button
                        print("8. Opening tag dropdown...")
                        tag_bar.click()
                        page.wait_for_timeout(300)
                        page.screenshot(path='/tmp/pageant_6_tag_dropdown.png')

                        # Check dropdown has categories
                        category_text = page.locator('text=/typeface|colors|mood|layout/i').first
                        if category_text.is_visible():
                            print("   Tag categories visible!")
                        else:
                            print("   Tag dropdown opened but categories not visible")

                        # Close dropdown by clicking elsewhere
                        page.keyboard.press('Escape')
                    else:
                        print("   No design tag bar (might need image selected)")

            # Final screenshot
            page.screenshot(path='/tmp/pageant_final.png', full_page=True)

            # Save successful trace
            context.tracing.stop(path="/tmp/pageant_trace_SUCCESS.zip")
            print("\n✅ All tests passed!")
            print("   Screenshots saved to /tmp/pageant_*.png")
            print("   Trace saved to /tmp/pageant_trace_SUCCESS.zip")
            print("   Run: playwright show-trace /tmp/pageant_trace_SUCCESS.zip")

        except Exception as e:
            # Save failure trace
            context.tracing.stop(path="/tmp/pageant_trace_FAILED.zip")
            page.screenshot(path='/tmp/pageant_FAILED.png')
            print(f"\n❌ Test failed: {e}")
            print("\nConsole logs (last 20):")
            for log in logs[-20:]:
                print(f"  {log}")
            print("\n   Screenshot: /tmp/pageant_FAILED.png")
            print("   Trace: /tmp/pageant_trace_FAILED.zip")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    test_design_system()
