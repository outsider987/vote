"""Run from the repo root while `python3 -m http.server 8774 --bind 127.0.0.1` is serving."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8774/drafts/g-skyline/'
CHROME = '/home/outsider/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ORDER = '10017 63000 65000 68000 10002 10018 10004 10005 66000 10007 10008 10009 10020 10010 67000 64000 10013 10015 10014 10016 09020 09007'.split()


def watch(page, faults):
    page.on('console', lambda message: faults.append(f'console {message.type}: {message.text}') if message.type in ('error', 'warning') else None)
    page.on('pageerror', lambda error: faults.append(f'pageerror: {error}'))
    page.on('requestfailed', lambda request: faults.append(f'requestfailed: {request.url} {request.failure}'))
    page.on('response', lambda response: faults.append(f'HTTP {response.status}: {response.url}') if response.status >= 400 else None)


def load(page, t):
    page.goto(f'{URL}?t={t}', wait_until='domcontentloaded', timeout=60000)
    page.wait_for_function('document.body.classList.contains("entered") && !!window.__skyline', timeout=60000)
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(1000)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    faults = []
    desktop = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    watch(desktop, faults)

    for t, filename in [(0.2, 'shot-20.png'), (0.6, 'shot-60.png'), (1, 'shot-100.png')]:
        load(desktop, t)
        desktop.screenshot(path=str(HERE / filename))
        assert desktop.evaluate('document.documentElement.scrollWidth <= innerWidth')

    actual = desktop.evaluate('window.__skyline.getSnapshot().mayorVotes')
    results = {county['code']: county for county in json.loads((ROOT / 'data/mayor-2022.json').read_text())['counties']}
    for code, votes in zip(ORDER, actual, strict=True):
        assert votes == [candidate['votes'] for candidate in results[code]['candidates']], code
    assert desktop.locator('#decidedCount').inner_text() == '22 / 22'

    desktop.evaluate('window.__skyline.setProgress(0.6)')
    first = desktop.evaluate('window.__skyline.getSnapshot().mayorVotes')
    desktop.evaluate('window.__skyline.setProgress(0.6)')
    assert desktop.evaluate('window.__skyline.getSnapshot().mayorVotes') == first

    desktop.get_by_role('button', name='議員', exact=True).click()
    assert desktop.locator('#districtChooser').is_visible()
    desktop.evaluate('window.__skyline.setProgress(1)')
    assert desktop.locator('#decidedCount').inner_text() == '910 / 910'
    desktop.get_by_role('button', name='文字結果').click()
    assert desktop.locator('#textResults').get_by_text('婦女保障名額').count() == 4
    assert desktop.evaluate('document.documentElement.scrollWidth <= innerWidth')
    desktop.get_by_role('button', name='關閉文字結果').click()
    desktop.evaluate('window.__skyline.select(20)')
    assert desktop.evaluate('window.__skyline.getSnapshot().selected') == '09020'
    desktop.get_by_role('button', name='下一縣市').click()
    assert desktop.evaluate('window.__skyline.getSnapshot().selected') == '09007'

    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    watch(mobile, faults)
    load(mobile, 0.6)
    mobile.screenshot(path=str(HERE / 'shot-mobile.png'))
    assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
    mobile.get_by_role('button', name='離島', exact=True).tap()
    assert mobile.evaluate('window.__skyline.getSnapshot().selected') == '10016'
    mobile.get_by_role('button', name='下一縣市').tap()
    assert mobile.evaluate('window.__skyline.getSnapshot().selected') == '09020'
    mobile.get_by_role('button', name='文字結果').tap()
    assert mobile.locator('#textView').is_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
    mobile.close()
    desktop.close()

    video_context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1,
                                        record_video_dir=str(HERE), record_video_size={'width': 1280, 'height': 720})
    video_page = video_context.new_page()
    watch(video_page, faults)
    video_page.goto(f'{URL}?t=0.15', wait_until='domcontentloaded', timeout=60000)
    video_page.wait_for_function('document.body.classList.contains("entered")', timeout=60000)
    video_page.evaluate('''() => new Promise(resolve => {
        const start = performance.now();
        const id = setInterval(() => {
            const fraction = Math.min(1, (performance.now() - start) / 8000);
            window.__skyline.setProgress(0.15 + 0.85 * fraction);
            if (fraction === 1) { clearInterval(id); resolve(); }
        }, 100);
    })''')
    video_page.evaluate('window.__skyline.select(20)')
    video_page.wait_for_timeout(1900)
    video_page.close()
    video_context.close()
    video_path = Path(video_page.video.path())
    video_path.replace(HERE / 'preview.webm')

    browser.close()
    assert not faults, '\n'.join(faults)
    print('PASS: exact 2022 votes, 22/22 mayor seats, 910/910 council seats, 4 women quota badges, islands, mobile, text view, clean console/network')
