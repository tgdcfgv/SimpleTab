const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const [language, lang, heading, engine] of [
      ['zh-CN', 'zh-CN', '设置', 'bing'], ['en-US', 'en', 'Settings', 'google'],
      ['zh-TW', 'zh-TW', '設定', 'google'], ['ja-JP', 'ja', '設定', 'google']
    ]) {
      const context = await browser.newContext({ locale: language });
      await context.route('https://**/*', route => route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(APP_URL);
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      assert.equal(await page.locator('html').getAttribute('lang'), lang);
      assert.equal(await page.locator('#searchEngineSelect').inputValue(), engine);
      await page.click('#settingsBtn');
      assert.equal(await page.locator('#settingsTitle').innerText(), heading);
      assert.equal(await page.locator('#languageSelect option').count(), 4);
      await page.screenshot({ path: `/tmp/simtab-language-${lang}.png`, animations: 'disabled' });
      await page.click('[data-settings-panel="settingsData"]');
      if (lang === 'en') assert.match(await page.locator('#migrationGuide').innerText(), /Export bookmarks from Edge/);
      await page.click('#openBulkEditor');
      if (lang === 'en') {
        assert.match(await page.locator('#bulkSelectionCount').innerText(), /sites selected/);
        assert.deepEqual(await page.locator('#bulkEditorDialog [aria-label], #bulkEditorDialog [title]').evaluateAll(elements => elements.flatMap(element => ['aria-label', 'title'].map(attr => element.getAttribute(attr) || '')).filter(value => /[\u3400-\u9fff]/.test(value))), []);
      }
      await page.click('#bulkClose');
      if (!await page.locator('#settingsModal').isVisible()) await page.click('#settingsBtn');
      await page.click('[data-settings-panel="settingsGeneral"]');
      if (lang === 'en') {
        const han = await page.locator('[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder]').evaluateAll(els => els.flatMap(el => {
          const texts = [el.dataset.i18n ? el.textContent : '', ...['title','aria-label','placeholder'].map(a => el.hasAttribute(`data-i18n-${a}`) ? el.getAttribute(a) : '')];
          return texts.filter(s => /[\u3400-\u9fff]/.test(s));
        }));
        assert.deepEqual(han, [], `Untranslated English UI: ${han.join('\n')}`);
        const before = await page.evaluate(async () => (await import('./js/storage.js')).appData.spaces);
        await page.selectOption('#languageSelect', 'ja');
        await page.waitForFunction(() => document.documentElement.lang === 'ja');
        await page.waitForFunction(() => !document.querySelector('.app-container').inert);
        assert.deepEqual(await page.evaluate(async () => (await import('./js/storage.js')).appData.spaces), before);
        assert.equal(await page.locator('#searchEngineSelect').inputValue(), 'google');
        await page.reload();
        await page.waitForFunction(() => !document.querySelector('.app-container').inert);
        assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
      }
      assert.deepEqual(errors, []);
      console.log(`${language}: OK`);
      await context.close();
    }
    // Extension preferences must win over an older local bookmark snapshot,
    // including when the current content is saved to a separate cloud account.
    const extension = await browser.newContext({ locale: 'en-US' });
    await extension.route('https://**/*', route => route.abort());
    await extension.addInitScript(() => {
      window.chrome = window.chrome || {};
      chrome.storage = { local: {
        get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, JSON.parse(localStorage.getItem('mock:' + key) || 'null')])),
        set: async values => { for (const [key, value] of Object.entries(values)) localStorage.setItem('mock:' + key, JSON.stringify(value)); }
      } };
    });
    const page = await extension.newPage();
    await page.goto(APP_URL);
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#settingsBtn');
    await page.selectOption('#languageSelect', 'ja');
    await page.waitForFunction(() => document.documentElement.lang === 'ja' && !document.querySelector('.app-container').inert);
    await page.evaluate(() => {
      const snapshot = JSON.parse(localStorage.getItem('mock:appData'));
      snapshot.settings.language = 'en';
      localStorage.setItem('mock:appData', JSON.stringify(snapshot));
    });
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
    console.log('Extension preference persistence: OK');
    await extension.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
