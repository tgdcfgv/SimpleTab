const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1360, height: 920 } });
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html');
    await page.locator('.site-btn').first().waitFor();
    const keys = () => page.locator('#dockItems > *').evaluateAll(items => items.map(item => item.dataset.dockKey));
    const state = () => page.evaluate(async () => {
      const { appData } = await import('./js/storage.js');
      return JSON.parse(JSON.stringify(appData));
    });
    const saveSettled = () => page.waitForFunction(async () => {
      const { appData } = await import('./js/storage.js');
      const saved = JSON.parse(localStorage.getItem('appData'));
      return JSON.stringify(saved?.settings) === JSON.stringify(appData.settings);
    });
    assert(await page.locator('#dockItems > *').evaluateAll(items => items.every(item => item.draggable)));
    // Native drag starts immediately and displays the removal hint without opening settings.
    let source = await page.locator('#settingsBtn').boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2, { steps: 4 });
    await page.locator('#dockRemoveHint').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#dockRemoveHint').innerText(), '拖出程序坞移除');
    await page.screenshot({ path: '/tmp/simpletab-dock-drag-hint.png' });
    const beforeCancel = await keys();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(await keys(), beforeCancel);
    assert.equal(await page.locator('#settingsModal').isVisible(), false);
    assert.equal(await page.locator('#dockRemoveHint').isVisible(), false);
    // Actions and spaces can be interleaved; the saved DOM order also gives keyboard order.
    const first = page.locator('#dockItems > :not([hidden])').first();
    await page.locator('#settingsBtn').dragTo(first, { targetPosition: { x: 2, y: 18 } });
    assert.equal((await keys())[0], 'action:settingsBtn');
    const work = page.locator('.space-dock-btn[data-space-id="space-work"]');
    await work.dragTo(page.locator('#settingsBtn'), { targetPosition: { x: 2, y: 18 } });
    assert.equal((await keys())[0], 'space:space-work');
    await page.locator('.site-btn').first().dragTo(page.locator('#spaceDock'));
    const website = page.locator('.dock-site-btn');
    const siteKey = await website.getAttribute('data-dock-key');
    await website.dragTo(page.locator('#settingsBtn'), { targetPosition: { x: 2, y: 18 } });
    let ordered = await keys();
    assert.equal(ordered.indexOf(siteKey) + 1, ordered.indexOf('action:settingsBtn'));
    await saveSettled();
    await page.reload();
    await page.locator('.dock-site-btn').waitFor();
    assert.deepEqual(await keys(), ordered);
    // Vertical docks use the same native movement and vertical insertion point.
    for (const position of ['left', 'right']) {
      await page.evaluate(async position => {
        const { appData } = await import('./js/storage.js');
        appData.settings.dockPosition = position;
        (await import('./js/render.js')).applySettings();
      }, position);
      await page.locator('#addSiteBtn').dragTo(page.locator('#settingsBtn'), { targetPosition: { x: 18, y: 2 } });
      ordered = await keys();
      assert.equal(ordered.indexOf('action:addSiteBtn') + 1, ordered.indexOf('action:settingsBtn'));
    }
    const before = await state();
    await page.locator('#accountBtn').dragTo(page.locator('.top-bar'));
    assert.equal((await state()).settings.showDockAccountButton, false);
    assert.equal(await page.locator('#accountBtn').isVisible(), false);
    const home = page.locator('.space-dock-btn[data-space-id="space-home"]');
    await home.dragTo(page.locator('.top-bar'));
    let after = await state();
    assert(after.settings.hiddenDockSpaces.includes('space-home'));
    assert.deepEqual(after.spaces, before.spaces);
    // Even after hiding Settings, the fallback remains reachable on small screens.
    await page.locator('#settingsBtn').dragTo(page.locator('.top-bar'));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#settingsFallbackBtn').isVisible(), true);
    await page.locator('#settingsFallbackBtn').click();
    await page.click('[data-settings-panel="settingsLayout"]');
    await page.click('label[for="dockSettingsToggle"]');
    await page.click('label[for="dockAccountToggle"]');
    await page.click('label[for="dock-space-space-home"]');
    await page.click('#closeSettingsBtn');
    assert(await page.locator('#settingsBtn').isVisible());
    assert(await page.locator('#accountBtn').isVisible());
    assert(await home.isVisible());
    await saveSettled();
    await page.reload();
    await page.locator('#settingsBtn').waitFor();
    assert.equal(await page.locator('#dockRemoveHint').isVisible(), false);
    await page.setViewportSize({ width: 1360, height: 920 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: '/tmp/simpletab-dock-order-dark.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: all dock buttons native-draggable, hint, Escape cancellation, mixed ordering, persistence, left/right docks, action/space hiding and mobile settings recovery.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
