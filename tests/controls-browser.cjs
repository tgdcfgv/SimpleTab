const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
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
    assert.equal(await page.locator('#appStoreBtn').isVisible(), false);
    await page.click('#spaceEditBtn');
    assert.equal(await page.locator('#bulkEditorDialog').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsLayout"]');
    const toggles = await page.locator('[data-dock-setting]').evaluateAll(inputs => inputs.map(input => input.id));
    const ids = ['accountBtn', 'settingsBtn', 'addGroupBtn', 'addSiteBtn', 'appStoreBtn', 'spaceEditBtn', 'spaceTabHint'];
    for (let index = 0; index < toggles.length; index++) {
      const toggle = page.locator(`#${toggles[index]}`);
      const before = await toggle.isChecked();
      await page.click(`label[for="${toggles[index]}"]`);
      assert.equal(await page.locator(`#${ids[index]}`).evaluate(el => el.hidden), before);
      await page.click(`label[for="${toggles[index]}"]`);
    }
    for (const input of await page.locator('#dockSpaceSettings input').all()) {
      const id = await input.getAttribute('id');
      await page.click(`label[for="${id}"]`);
    }
    assert.equal(await page.locator('.space-dock-btn:not([hidden])').count(), 0);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    assert.equal(await page.locator('.space-dock-btn:not([hidden])').count(), 0);
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsLayout"]');
    for (const input of await page.locator('#dockSpaceSettings input').all()) {
      const id = await input.getAttribute('id');
      await page.click(`label[for="${id}"]`);
    }
    await page.click('label[for="dockEnabledToggle"]');
    assert.equal(await page.locator('#dockPositionSelect').isDisabled(), true);
    assert.equal(await page.locator('#dockPositionSetting button.custom-select-trigger-global').isDisabled(), true);
    await page.click('#closeSettingsBtn');
    assert.equal(await page.locator('#spaceDock').isVisible(), false);
    await page.click('#settingsFallbackBtn');
    await page.click('[data-settings-panel="settingsLayout"]');
    await page.click('label[for="dockEnabledToggle"]');
    const positionTrigger = page.locator('#dockPositionSetting .custom-select-trigger-global');
    await positionTrigger.click();
    await page.locator('#dockPositionSetting .custom-option-global').filter({ hasText: '右侧' }).click();
    assert.equal(await page.locator('html').getAttribute('data-dock-position'), 'right');
    await positionTrigger.focus();
    await page.mouse.move(0, 0);
    assert.equal(await positionTrigger.evaluate(el => getComputedStyle(el).boxShadow), 'none');
    assert.equal(await positionTrigger.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#dockPositionSetting .custom-select-trigger-global')).borderTopColor === 'rgba(0, 0, 0, 0)');
    for (const panel of ['settingsGeneral', 'settingsAppearance', 'settingsLayout', 'settingsAccount', 'settingsData', 'settingsAbout']) {
      await page.click(`[data-settings-panel="${panel}"]`);
      const colors = await page.locator('.settings-nav-btn.active').evaluate(el => [getComputedStyle(el.querySelector('span')).color, getComputedStyle(el.querySelector('svg')).color]);
      assert.equal(colors[0], colors[1]);
    }
    await page.click('[data-settings-panel="settingsAppearance"]');
    await page.setInputFiles('#wallpaperUpload', { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
    await page.waitForFunction(() => !document.querySelector('#wallpaperUpload').disabled);
    assert.equal(await page.locator('#wallpaperThumbnail').isVisible(), true);
    assert.equal(await page.locator('#clearWallpaperBtn').innerText(), '移除');
    await page.locator('#wallpaperChooseBtn').hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.wallpaper-replace')).opacity === '1');
    await page.screenshot({ animations: 'disabled', path: '/tmp/simtab-wallpaper-preview.png' });
    await page.click('[data-settings-panel="settingsData"]');
    const downloadReady = page.waitForEvent('download');
    await page.click('#exportBtnNew');
    const download = await downloadReady;
    const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(backup.settings.wallpaper, png);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('appData')).settings.wallpaper), null);
    assert.equal(await page.evaluate(async () => {
      const { portableSnapshot } = await import('./js/wallpaper.js');
      const { appData } = await import('./js/storage.js');
      return portableSnapshot(appData).settings.wallpaper;
    }), null);
    await page.click('[data-settings-panel="settingsAppearance"]');
    await page.click('#clearWallpaperBtn');
    await page.waitForFunction(() => !document.body.style.backgroundImage.includes('blob:'));
    assert.equal(await page.locator('#wallpaperThumbnail').isVisible(), false);
    await page.click('[data-settings-panel="settingsData"]');
    await page.setInputFiles('#importFileNew', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(() => document.body.style.backgroundImage.includes('blob:'));
    await page.reload();
    await page.waitForFunction(() => document.body.style.backgroundImage.includes('blob:'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('appData')).settings.wallpaper), null);
    await page.click('#spaceEditBtn');
    assert.equal(await page.locator('#bulkEditorDialog').isVisible(),true);
    assert.equal(await page.locator('#spaceModal').count(),0);
    await page.keyboard.press('Escape');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(async value => {
        const { appData } = await import('./js/storage.js');
        appData.settings.theme = value;
        (await import('./js/render.js')).applySettings();
      }, theme);
      for (const width of [390, 768, 1400]) {
        await page.setViewportSize({ width, height: 844 });
        await page.click('#settingsBtn');
        for (const panel of ['settingsAppearance', 'settingsLayout']) {
          await page.click(`[data-settings-panel="${panel}"]`);
          assert.equal(await page.locator('.settings-content').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${panel}: ${width}`);
        }
        await page.click('#closeSettingsBtn');
        await page.click('#spaceEditBtn');
        assert.equal(await page.locator('#bulkEditorDialog').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        await page.screenshot({ animations: 'disabled', path: `/tmp/simtab-spaces-${theme}-${width}.png` });
        await page.keyboard.press('Escape');
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: all Dock toggles, per-space visibility, disabled positioning, settings recovery, matching navigation colors, focus-free menus, wallpaper thumbnail/export/import/local-only storage, consolidated editor dock entry, responsive light/dark layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
