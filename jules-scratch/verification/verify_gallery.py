from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('file:///app/index.html')

        gallery_section = page.locator('#gallery')

        # Scroll the gallery section into view
        gallery_section.scroll_into_view_if_needed()

        # Wait for the heading to be visible to ensure the section is rendered
        heading = gallery_section.locator('h2')
        expect(heading).to_be_visible()

        gallery_section.screenshot(path='jules-scratch/verification/gallery_verification.png')
        browser.close()

run()
