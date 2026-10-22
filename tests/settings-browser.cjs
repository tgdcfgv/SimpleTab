const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { version } = require('../manifest.json');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext();
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP_URL);
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#settingsBtn');
    assert.deepEqual(await page.locator('.settings-nav-btn span').allTextContents(), ['账户与同步', '常规', '外观', '内容与布局', '关于']);
    assert.equal(await page.locator('#settingsData').isVisible(), true);
    await page.click('[data-settings-panel="settingsGeneral"]');
    assert.equal(await page.locator('#settingsGeneral').isVisible(), true);
    assert.equal(await page.locator('#settingsGeneral .settings-group').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    for (const [panel, controls] of Object.entries({
      settingsGeneral: ['openModeSelect', 'searchEngineSettings'],
      settingsAppearance: ['themeSelect', 'wallpaperUpload', 'accentColorInput'],
      settingsContent: ['cardDisplayLabel', 'iconSizeSlider', 'compactModeToggle', 'dockPositionSelect', 'dockEditButtonToggle', 'dockTabHintToggle'],
      settingsData: ['accountPanel', 'bookmarkFile', 'exportBtnNew', 'importFileNew']
    })) {
      for (const id of controls) assert.equal(await page.locator(`#${id}`).evaluate(el => el.closest('.settings-section').id), panel);
    }
    await page.click('[data-settings-panel="settingsContent"]');
    assert.equal(await page.locator('#iconSizeSetting').isVisible(), false);
    const displayRowHeight = await page.locator('.card-display-setting').evaluate(el => el.offsetHeight);
    await page.click('button[data-card-mode="icon-only"]');
    assert.equal(await page.locator('.card-display-setting').evaluate(el => el.offsetHeight), displayRowHeight);
    await page.locator('#iconSizeSlider').fill('48');
    assert.equal(await page.locator('html').getAttribute('data-card-mode'), 'icon-only');
    assert.equal(await page.locator('html').evaluate(el => el.style.getPropertyValue('--pure-icon-size')), '48px');
    await page.click('label[for="compactModeToggle"]');
    assert.equal(await page.locator('html').getAttribute('data-compact'), 'true');
    await page.click('button[data-card-mode="icon-text"]');
    assert.equal(await page.locator('#iconSizeSetting').isVisible(), false);
    await page.click('button[data-card-mode="icon-only"]');
    assert.equal(await page.locator('#iconSizeSlider').inputValue(), '48');
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsContent"]');
    assert.equal(await page.locator('button[data-card-mode="icon-only"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#iconSizeSlider').inputValue(), '48');
    await page.screenshot({ path: '/tmp/simtab-settings-appearance.png', animations: 'disabled' });
    await page.click('[data-settings-panel="settingsData"]');
    assert.equal(await page.locator('#dataOverviewGrid').count(), 0);
    assert.equal(await page.locator('#openAuthModalBtn').isVisible(), true);
    const oldGroups = await page.evaluate(async () => (await import('./js/storage.js')).appData.groups.length);
    await page.setInputFiles('#bookmarkFile', { name: 'bookmarks.html', mimeType: 'text/html', buffer: Buffer.from('<a href="https://example.com/new-bookmark">新书签</a>') });
    await page.waitForFunction(() => document.querySelector('#bookmarkImportStatus').textContent.includes('已导入 1'));
    assert.equal(await page.evaluate(async () => (await import('./js/storage.js')).appData.groups.length), oldGroups + 1);
    const downloadReady = page.waitForEvent('download');
    await page.click('#exportBtnNew');
    const download = await downloadReady;
    assert(download.suggestedFilename().endsWith('.json'));
    await page.screenshot({ path: '/tmp/simtab-settings-data.png', animations: 'disabled' });
    for (const width of [390, 620, 760, 1400]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.locator('.settings-sidebar').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      for (const panel of ['settingsGeneral', 'settingsAppearance', 'settingsContent', 'settingsData', 'settingsAbout']) {
        await page.click(`[data-settings-panel="${panel}"]`);
        assert.equal(await page.locator('.settings-content').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${panel} overflows at ${width}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('[data-settings-panel="settingsData"]');
    await page.screenshot({ path: '/tmp/simtab-settings-data-mobile.png', animations: 'disabled' });
    await page.click('[data-settings-panel="settingsAbout"]');
    assert.equal(await page.locator('#settingsData').isVisible(), false);
    assert.equal(await page.locator('#appVersion').innerText(), `v${version}`);
    assert.equal(await page.getByRole('link', { name: '扩展安装说明' }).isVisible(), true);
    await page.locator('#closeSettingsBtn').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.querySelector('#settingsModal').contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settingsModal').isVisible(), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsGeneral"]');
    assert.equal(await page.locator('#settingsGeneral .settings-group').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.locator('#dockTabHintToggle + label').evaluate(el => getComputedStyle(el, '::before').transitionDuration), '0s');
    await page.keyboard.press('Escape');
    await page.click('#accountBtn');
    assert.equal(await page.locator('#authModal').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: consolidated navigation, icon slider persistence, login entry, bookmark import, JSON export, responsive panels, standalone about panel, keyboard focus, reduced motion, account shortcut, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
