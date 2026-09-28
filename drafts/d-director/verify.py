import asyncio
import json
import shutil
from pathlib import Path

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8771/drafts/d-director/'
CHROME = '/home/outsider/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


async def ready(page, t):
    issues = []
    page.on('console', lambda m: issues.append(f'console {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: issues.append(f'pageerror: {e}'))
    page.on('requestfailed', lambda r: issues.append(f'request failed: {r.url} {r.failure}'))
    page.on('response', lambda r: issues.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 else None)
    await page.goto(f'{URL}?t={t}', wait_until='domcontentloaded', timeout=60000)
    await page.wait_for_function('window.__director && document.fonts.status === "loaded"', timeout=60000)
    await page.wait_for_timeout(1150)
    assert not issues, issues
    return issues


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, args=ARGS)
        desktop = await browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        for value, name in [(.2, 'shot-20.png'), (.6, 'shot-60.png'), (1, 'shot-100.png')]:
            page = await desktop.new_page()
            issues = await ready(page, value)
            await page.screenshot(path=str(ROOT / name))
            assert not issues, issues
            data = await page.evaluate('window.__director.getState()')
            assert abs(data['progress'] - value) < .0001, data
            if value == 1:
                assert data['overall'] == 100 and data['decided'] == 22, data
                assert data['seats'] == {'中國國民黨': 14, '民主進步黨': 5, '台灣民眾黨': 1, '無黨籍及未經政黨推薦': 2}, data
                await page.get_by_role('button', name='議員', exact=True).click()
                council = await page.evaluate('window.__director.getState()')
                assert council['overall'] == 100 and council['decided'] == 910, council
                expected = json.loads((ROOT.parent.parent / 'data/council-2022.json').read_text())
                assert sum(council['seats'].values()) == sum(c['seats'] for c in expected['counties'])
                await page.evaluate("window.__director.select('09020')")
                await page.get_by_role('button', name='文字戰況').click()
                assert await page.locator('.badge.quota').count() > 0
                await page.get_by_role('button', name='關閉文字戰況').click()
            print(name, data)
            await page.close()
        await desktop.close()

        mobile = await browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        page = await mobile.new_page()
        issues = await ready(page, .6)
        await page.screenshot(path=str(ROOT / 'shot-mobile.png'))
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.get_by_role('button', name='展開或收合焦點選戰').click()
        assert await page.locator('#lower-third').evaluate('(el) => el.classList.contains("expanded")')
        await page.get_by_role('button', name='展開或收合焦點選戰').click()
        await page.get_by_role('button', name='各縣市', exact=True).click()
        assert await page.locator('#mobile-counties button').count() == 22
        await page.locator('#mobile-counties button[data-code="09020"]').click()
        assert await page.locator('#race-name').inner_text() == '金門縣'
        assert not issues, issues
        await mobile.close()

        video_context = await browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1, record_video_dir=str(ROOT), record_video_size={'width': 1280, 'height': 720})
        page = await video_context.new_page()
        issues = await ready(page, .66)
        await page.evaluate('''() => {
          window.__bannerChecks = [];
          new MutationObserver(() => {
            const banner = document.getElementById('call-banner');
            if (banner.classList.contains('show')) {
              const county = document.getElementById('call-context').textContent.split(' · ')[0];
              window.__bannerChecks.push([county, document.getElementById('race-name').textContent]);
            }
          }).observe(document.getElementById('call-banner'), {attributes: true, attributeFilter: ['class']});
        }''')
        await page.get_by_role('button', name='播放重播').click()
        await page.wait_for_timeout(12000)
        video = page.video
        assert not issues, issues
        checks = await page.evaluate('window.__bannerChecks')
        assert checks and all(county == focus for county, focus in checks), checks
        await video_context.close()
        shutil.move(await video.path(), ROOT / 'preview.webm')
        await browser.close()
        print('verified: 22 mayor seats, 910 council seats, quota badge, mobile touch, zero browser issues')


if __name__ == '__main__':
    asyncio.run(main())
