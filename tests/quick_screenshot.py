"""Quick screenshot to verify images load"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.goto("http://localhost:5173")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)  # Extra time for images
    page.screenshot(path="/tmp/pageant_ui_review/final_check.png", full_page=True)
    print("Screenshot saved to /tmp/pageant_ui_review/final_check.png")
    browser.close()
