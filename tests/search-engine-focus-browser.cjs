const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const touch of [false, true]) {
      const context = await browser.newContext({ hasTouch: touch, isMobile: touch,
        viewport: { width: touch ? 390 : 1280, height: 844 } });
      await context.route('https://**/*', route => route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(APP_URL);
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      const engine = page.locator('#searchEngineSelect + .custom-select-container');
      const trigger = engine.locator('.custom-select-trigger-global');
      await page.fill('#searchInput', '输入中的搜索内容');
      await page.evaluate(() => {
        const input = document.getElementById('searchInput');
        input.setSelectionRange(2, 5);
        window.searchFocusEvents = [];
        input.addEventListener('focus', () => window.searchFocusEvents.push('focus'));
        input.addEventListener('blur', () => window.searchFocusEvents.push('blur'));
      });
      if (touch) await trigger.tap(); else await trigger.click();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'searchInput', 'opening the engine menu while typing must retain input focus');
      await page.press('#searchInput', 'Escape');
      assert.equal(await engine.locator('.custom-select-options-global').isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'searchInput');
      if (touch) await trigger.tap(); else await trigger.click();
      if (touch) await engine.locator('.custom-option-global').nth(1).tap();
      else await engine.locator('.custom-option-global').nth(1).click();
      assert.deepEqual(await page.evaluate(() => {
        const input = document.getElementById('searchInput');
        return { active: document.activeElement.id, value: input.value, start: input.selectionStart, end: input.selectionEnd,
          events: window.searchFocusEvents, open: document.querySelector('.search-container').classList.contains('engine-select-open') };
      }), { active: 'searchInput', value: '输入中的搜索内容', start: 2, end: 5, events: [], open: false });
      assert.equal(await page.locator('#searchEngineSelect').evaluate(select => select.selectedIndex), 1);
      const expectedUrl = await page.evaluate(async () => {
        const { appData, SEARCH_ENGINES } = await import('./js/storage.js');
        appData.settings.openLinksInNewTab = true;
        window.open = url => { window.lastSearchUrl = url; };
        return SEARCH_ENGINES.find(engine => engine.id === appData.settings.searchEngine).searchUrl +
          encodeURIComponent(document.getElementById('searchInput').value);
      });
      await page.press('#searchInput', 'Enter');
      assert.equal(await page.evaluate(() => window.lastSearchUrl), expectedUrl);

      // Keyboard selection must return to the input once, without a trigger detour.
      await trigger.focus();
      await trigger.press('Enter');
      await engine.locator('.custom-option-global').first().focus();
      await page.evaluate(() => { window.selectionFocusEvents = []; document.addEventListener('focusin', event => window.selectionFocusEvents.push(event.target.id || event.target.className)); });
      await engine.locator('.custom-option-global').first().press('Enter');
      assert.deepEqual(await page.evaluate(() => window.selectionFocusEvents), ['searchInput']);
      await trigger.focus(); await trigger.press('Enter'); await trigger.press('Escape');
      assert.equal(await engine.locator('.custom-select-options-global').isVisible(), false);
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: mouse/touch engine changes preserve input focus, query and selection; keyboard selection focuses the input once; Escape remains accessible.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
