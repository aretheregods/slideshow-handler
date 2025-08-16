import os
from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the index.html file
        # The script is in jules-scratch/verification, so we go up two levels
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        index_path = os.path.join(base_dir, 'index.html')

        # Navigate to the local HTML file
        page.goto(f'file://{index_path}')

        # Path to the test presentation
        pptx_path = os.path.join(base_dir, 'jules-scratch', 'test.pptx')

        # Use the file chooser to upload the test file
        with page.expect_file_chooser() as fc_info:
            page.locator('#pptx-file').click()
        file_chooser = fc_info.value
        file_chooser.set_files(pptx_path)

        # Wait for the slide container to be visible and have content
        slide_container = page.locator('#slide-1')
        expect(slide_container).to_be_visible(timeout=10000)

        # Give it a moment to ensure rendering is complete
        page.wait_for_timeout(1000)

        # Take a screenshot
        screenshot_path = os.path.join(base_dir, 'jules-scratch', 'verification', 'verification.png')
        page.screenshot(path=screenshot_path)

        browser.close()
        print(f"Screenshot saved to {screenshot_path}")

if __name__ == "__main__":
    run_verification()
