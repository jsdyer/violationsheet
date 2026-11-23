"""Exercise Violation Sheet at a project subpath in Chromium."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    screenshots = ROOT / "browser-checks"
    screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / "dist", Path(temporary) / "violationsheet")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/violationsheet/")
                page.wait_for_function("() => /per 100,000|not published/i.test(document.querySelector('#finding').textContent)")
                page.locator("#service").fill("Kitimat")
                page.locator("#service").dispatch_event("input")
                page.wait_for_function("() => document.querySelector('#finding').textContent.includes('Kitimat')")
                page.locator("#service").fill('<img src=x onerror="alert(1)">')
                page.locator("#service").dispatch_event("input")
                html = page.locator("#finding").inner_html()
                assert "<img" not in html
                assert page.locator("img").count() == 0
                page.locator("#service").fill("Langley")
                page.locator("#service").dispatch_event("input")
                page.wait_for_function("() => document.querySelector('#rows').textContent.includes('2025') || document.querySelector('#rows').textContent.includes('2024')")
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                assert not errors, errors
                browser.close()
            print("Browser checks passed: project subpath, a service beyond the shortcuts, safe text and mobile layout")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
