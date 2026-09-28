"""Run from anywhere: python3 drafts/f-galaxy/check.py."""
from collections import Counter
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
URL = "http://127.0.0.1:8773/drafts/f-galaxy/"
CHROME = "/home/outsider/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome"
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def watch(page):
    problems = []
    page.on("console", lambda m: problems.append(f"console {m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
    page.on("requestfailed", lambda r: problems.append(f"request failed: {r.url} {r.failure}"))
    page.on("response", lambda r: problems.append(f"HTTP {r.status}: {r.url}") if r.status >= 400 else None)
    return problems


def open_page(browser, width, height, t, *, touch=False):
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    problems = watch(page)
    page.goto(f"{URL}?t={t}", wait_until="networkidle", timeout=60000)
    page.wait_for_function("window.__galaxy && document.querySelector('#loading').classList.contains('done')")
    page.wait_for_timeout(1500)
    return page, problems


def check():
    expected_mayor = Counter()
    expected_council = Counter()
    mayor = json.loads((ROOT / "data/mayor-2022.json").read_text())
    council = json.loads((ROOT / "data/council-2022.json").read_text())
    for county in mayor["counties"]:
        expected_mayor.update(c["party"] for c in county["candidates"] if c["elected"])
    for county in council["counties"]:
        for district in county["districts"]:
            expected_council.update(c["party"] for c in district["candidates"] if c["elected"])

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME, args=ARGS)
        for t, filename, viewport in [(.2, "shot-20.png", (1440, 900)), (.6, "shot-60.png", (1440, 900)), (1, "shot-100.png", (1440, 900)), (.6, "shot-mobile.png", (390, 844))]:
            page, problems = open_page(browser, *viewport, t, touch=viewport[0] < 500)
            state = page.evaluate("window.__galaxy.getState()")
            assert state["progress"] == t, state
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "horizontal page scroll"
            if t == 1:
                assert state["decidedMayor"] == 22 and state["decidedCouncil"] == 910, state
                assert state["tallyMayor"] == dict(expected_mayor), state
                assert state["tallyCouncil"] == dict(expected_council), state
                taipei = next(c for c in mayor["counties"] if c["name"] == "臺北市")
                winner = next(c for c in taipei["candidates"] if c["elected"])
                assert page.locator("#card-vote-number").inner_text() == f"{winner['votes']:,}"
            page.screenshot(path=str(HERE / filename))
            if viewport[0] == 390:
                page.touchscreen.tap(145, 360)
                assert "open" in page.locator("#candidate-card").get_attribute("class"), "mobile seat tap"
                page.locator("#card-close").click()
                page.locator(".map-island.kinmen").click()
                assert page.locator("#county-filter").input_value() == "09020", "Kinmen map control"
                assert page.locator("#card-race").inner_text() == "金門縣長"
            else:
                page.locator("#mayor-emphasis").click()
                assert page.locator("#mayor-emphasis").get_attribute("aria-pressed") == "true"
                page.locator("#party-filter").select_option("中國國民黨")
                assert page.locator("#party-filter").input_value() == "中國國民黨"
            if t == .6 and viewport[0] == 1440:
                for x, y in [(735, 367), (814, 441), (660, 230)]:
                    page.mouse.move(x, y)
                    page.wait_for_timeout(60)
                    if page.locator("#seat-tooltip").is_visible():
                        page.mouse.click(x, y)
                        break
                else:
                    raise AssertionError("seat hover tooltip")
                assert page.locator("#candidate-card").get_attribute("class").endswith("open")
                first = page.locator("#card-vote-number").inner_text()
                page.evaluate("window.__galaxy.setProgress(.6)")
                assert page.locator("#card-vote-number").inner_text() == first, "replay must be deterministic"
                page.locator("#speed").click()
                assert page.locator("#speed").inner_text() == "2×"
                page.evaluate("window.__galaxy.setProgress(.94)")
                if page.evaluate("window.__galaxy.getState().decidedCouncil") < 910:
                    assert int(page.locator("#overall-progress").inner_text()) < 100
                page.locator("#timeline").evaluate("el => {el.value='1000'; el.dispatchEvent(new Event('input',{bubbles:true}));}")
                assert page.evaluate("window.__galaxy.getState().decidedCouncil") == 910
            if t == 1:
                page.locator("#view-toggle").click()
                page.locator("#text-council").click()
                assert page.locator("#text-list > details").count() == 22
                county = page.locator("#text-list > details").filter(has_text="金門縣").first
                county.locator(":scope > summary").click()
                district = county.locator(".districts > details").first
                district.locator(":scope > summary").click()
                district.locator(".text-candidate").filter(has_text="唐麗輝").locator("button").click()
                assert page.locator("#card-badges").inner_text() == "婦女保障當選"
                assert page.locator("#card-body .avatar").count() == 1
            assert not problems, f"{filename}: {problems}"
            print(filename, state["decidedMayor"], state["decidedCouncil"], "clean")
            page.close()

        photo_data = json.loads(json.dumps(mayor))
        next(c for county in photo_data["counties"] if county["name"] == "臺北市" for c in county["candidates"] if c["elected"])["photo"] = "./shot-20.png"
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        problems = watch(page)
        page.route("**/data/mayor-2022.json", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(photo_data, ensure_ascii=False)))
        page.goto(f"{URL}?t=1", wait_until="networkidle", timeout=60000)
        page.wait_for_function("window.__galaxy")
        assert page.locator("#card-body .avatar img").evaluate("img => img.complete && img.naturalWidth > 0"), "photo replacement"
        assert not problems, problems
        page.close()

        context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1, record_video_dir=str(HERE), record_video_size={"width": 1280, "height": 720})
        page = context.new_page()
        problems = watch(page)
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("document.querySelector('#loading').classList.contains('done')", timeout=60000)
        page.locator("#speed").click()
        page.locator("#speed").click()
        page.wait_for_timeout(10500)
        assert not problems, problems
        video = page.video
        context.close()
        raw = HERE / "preview-raw.webm"
        os.replace(video.path(), raw)
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", "4", "-i", str(raw), "-t", "12", "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "6", "-b:v", "1200k", "-an", str(HERE / "preview.webm"), "-y"], check=True)
        raw.unlink()
        browser.close()
        print("preview.webm clean")


if __name__ == "__main__":
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8773", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urlopen(URL, timeout=.5).close()
                break
            except Exception:
                time.sleep(.1)
        else:
            raise RuntimeError("HTTP server did not start")
        check()
    finally:
        server.terminate()
        server.wait(timeout=5)
