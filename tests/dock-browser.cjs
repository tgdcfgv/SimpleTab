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
    await page.waitForFunction(async () => (await import('./js/storage.js')).syncManager.ready);
    const source = page.locator('.site-btn').first();
    const url = await source.getAttribute('href');
    const count = await page.locator('.site-btn').count();
    await source.dragTo(page.locator('#spaceDock'));
    assert.equal(await page.locator('.dock-site-btn').count(), 1);
    assert.equal(await page.locator('.dock-site-btn').getAttribute('href'), url);
    assert.equal(await page.locator('.site-btn').count(), count);
    await source.dragTo(page.locator('#spaceDock'));
    assert.equal(await page.locator('.dock-site-btn').count(), 1);
    // Returning a pinned site to its original group does not create a duplicate.
    await page.locator('.dock-site-btn').dragTo(source.locator('xpath=ancestor::div[contains(@class,"group-card")]').locator('.group-header'));
    assert.equal(await page.locator('.dock-site-btn').count(), 0);
    assert.equal(await page.locator('.site-btn').count(), count);
    await source.dragTo(page.locator('#spaceDock'));
    const externalDrop = async value => page.evaluate(value => {
      const transfer = new DataTransfer();
      transfer.setData('text/uri-list', value);
      const dock = document.getElementById('spaceDock');
      dock.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      dock.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, value);
    await externalDrop('https://example.org/project');
    assert.equal(await page.locator('.dock-site-btn').count(), 2);
    assert.equal(await page.locator('#siteModal').isVisible(), false);
    await externalDrop('javascript:alert(1)');
    assert.equal(await page.locator('.dock-site-btn').count(), 2);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('appData'))?.settings.dockLinks.length === 2);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.dock-site-btn').length === 2);
    for (const position of ['left', 'right', 'bottom']) {
      await page.evaluate(async position => {
        const { appData } = await import('./js/storage.js');
        appData.settings.dockPosition = position;
        (await import('./js/render.js')).applySettings();
      }, position);
      assert(await page.locator('.dock-site-btn').first().isVisible());
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/simpletab-dock-mobile.png' });
    await page.locator(`.dock-site-btn[href="${url}"]`).focus();
    await page.keyboard.press('Delete');
    await page.locator('#okConfirmBtn').click();
    assert.equal(await page.locator('.dock-site-btn').count(), 1);
    // An external shortcut can be returned to an empty group and survives reload.
    await page.setViewportSize({ width: 1360, height: 920 });
    const emptyGroup = page.locator('.group-card').filter({ has: page.locator('.empty-group-state') }).first();
    const groupId = await emptyGroup.getAttribute('data-id');
    const title = emptyGroup.locator('.group-header');
    await page.locator('.dock-site-btn').dragTo(title);
    assert.equal(await page.locator('.dock-site-btn').count(), 0);
    assert.equal(await page.locator(`.group-card[data-id="${groupId}"] .site-btn[href="https://example.org/project"]`).count(), 1);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('appData'))?.settings.dockLinks.length === 0);
    await page.reload();
    await page.locator('.site-btn[href="https://example.org/project"]').waitFor();
    assert.equal(await page.locator('.dock-site-btn').count(), 0);
    // Dropping outside the dock removes only the shortcut.
    await page.locator('.site-btn[href="https://example.org/project"]').dragTo(page.locator('#spaceDock'));
    await page.locator('.dock-site-btn').dragTo(page.locator('.top-bar'));
    assert.equal(await page.locator('.dock-site-btn').count(), 0);
    assert.equal(await page.locator('.site-btn[href="https://example.org/project"]').count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: internal/external dock drops, duplicate prevention, original retained, safe URLs, persistence, positions, keyboard removal, returning to original/empty groups, drag-out removal and persistence.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
