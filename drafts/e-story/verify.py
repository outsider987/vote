"""Capture the story and check replay data, interactions, and browser diagnostics."""

from pathlib import Path
import subprocess
import time

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:8772/drafts/e-story/"
CHROME = "/home/outsider/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome"
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
faults = []


def watch(page):
    page.on("console", lambda m: faults.append((m.type, m.text)) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: faults.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: faults.append(("requestfailed", r.url, r.failure)))


def ready(page, t):
    watch(page)
    page.goto(f"{BASE}?t={t}", wait_until="domcontentloaded", timeout=120_000)
    page.wait_for_function("getComputedStyle(document.querySelector('#loading')).visibility === 'hidden'", timeout=30_000)
    page.wait_for_timeout(900)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=ARGS, headless=True)
    for name, size, t in [
        ("shot-20.png", (1440, 900), .2),
        ("shot-60.png", (1440, 900), .6),
        ("shot-100.png", (1440, 900), 1),
        ("shot-mobile.png", (390, 844), .6),
    ]:
        page = browser.new_page(viewport={"width": size[0], "height": size[1]}, device_scale_factor=1)
        ready(page, t)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"horizontal scroll: {name}"
        page.screenshot(path=str(HERE / name))
        shown_progress = round(page.evaluate("window.__story.getSnapshot().summary.overall"), 1)
        if t == .2:
            summary = page.evaluate("window.__story.getSnapshot().summary")
            assert summary["mayorDecided"] > 0 and summary["councilDecided"] > 0
        if t == 1:
            checks = page.evaluate("""async () => {
              const [mayor,council]=await Promise.all([
                fetch('../../data/mayor-2022.json').then(r=>r.json()),
                fetch('../../data/council-2022.json').then(r=>r.json())]);
              const s=window.__story.getSnapshot();
              return {
                mayorExact:mayor.counties.every((c,i)=>c.candidates.every((x,j)=>x.votes===s.mayorStates[i].votes[j])),
                councilExact:council.counties.every(c=>c.districts.every(d=>d.candidates.every((x,j)=>x.votes===s.councilStates.get(d.id).votes[j]))),
                mayors:Object.values(s.summary.mayorSeats).reduce((a,b)=>a+b,0),
                councilors:Object.values(s.summary.councilSeats).reduce((a,b)=>a+b,0),
                rows:document.querySelectorAll('#mayor-table tbody tr').length
              };
            }""")
            assert checks == {"mayorExact": True, "councilExact": True, "mayors": 22, "councilors": 910, "rows": 22}, checks
            page.locator("#mayor-table [data-sort=votes]").click()
            page.locator("#mayor-table [data-sort=votes]").click()
            assert page.locator("#mayor-table tbody tr").first.get_attribute("data-code") == "65000"
            page.locator("#island-inset button[data-code='09020']").click()
            assert page.locator("#explore-detail h3").inner_text() == "金門縣"
            page.locator("#island-inset button[data-code='09007']").click()
            assert page.locator("#explore-detail h3").inner_text() == "連江縣"
            page.locator("#text-toggle").click()
            page.locator("#county-select").select_option("09020")
            page.locator("#election-select").select_option("council")
            assert page.locator("#text-detail .quota-badge").count() > 0
            assert page.locator("#text-detail .avatar").count() > 0
            page.locator("#text-close").click()
            print("100% votes exact; 22 mayor and 910 council seats; sorting, islands, text view, quota badge passed")
        if size[0] == 390:
            assert page.locator("#all-candidates").is_visible()
            page.locator("#mobile-sort").select_option("votes")
            assert page.locator("#mayor-table tbody tr").first.get_attribute("data-code") == "65000"
            for i in range(9):
                page.evaluate("t => window.__story.setProgress(t)", min(1, i / 8 + .005))
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                assert page.evaluate("document.querySelector('#chapter-panel').scrollHeight - document.querySelector('#chapter-panel').clientHeight <= 2")
            print("390px layout and mobile sorting passed")
        print(name, shown_progress)
        page.close()

    context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1,
                                  record_video_dir=str(HERE), record_video_size={"width": 1280, "height": 720})
    page = context.new_page()
    start = time.monotonic()
    ready(page, 0)
    trim_start = max(0, time.monotonic() - start - .15)
    page.evaluate("""async () => new Promise(resolve => {
      const end=document.querySelector('#final').offsetTop,start=performance.now();
      function tick(now){const t=Math.min(1,(now-start)/9400);scrollTo({top:end*t,behavior:'instant'});
        if(t<1)requestAnimationFrame(tick);else resolve()}
      requestAnimationFrame(tick)
    })""")
    page.wait_for_timeout(2700)
    page.close()
    raw = Path(page.video.path())
    context.close()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{trim_start:.2f}", "-i", str(raw),
                    "-t", "12", "-c:v", "libvpx-vp9", "-b:v", "900k", "-deadline", "realtime", "-cpu-used", "8",
                    str(HERE / "preview.webm")], check=True)
    raw.unlink()
    browser.close()

assert not faults, faults
print("No console errors, warnings, page errors, or failed requests. Video: preview.webm")
