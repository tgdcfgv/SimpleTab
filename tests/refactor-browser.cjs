const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
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
    await page.evaluate(async () => {
      const s = await import('./js/storage.js');
      s.appData.spaces[1].groups[0].links.push({ id: 'cross-space', title: 'Cross space Git', url: 'https://git.example.test/' });
      s.appData.settings.openLinksInNewTab = true;
      await s.syncManager.saveData();
      window.open = url => { window.lastOpened = url; };
    });
    await page.fill('#searchInput', 'git');
    assert.equal(await page.locator('#searchResults [aria-selected="true"]').count(), 0);
    assert(await page.locator('#searchResults').innerText().then(text => text.includes('工作')));
    await page.press('#searchInput', 'Enter');
    assert.equal(await page.evaluate(() => window.lastOpened), 'https://www.bing.com/search?q=git');
    await page.fill('#searchInput', 'Cross space');
    await page.press('#searchInput', 'ArrowDown');
    assert.equal(await page.locator('#searchResults [aria-selected="true"]').count(), 1);
    await page.press('#searchInput', 'Enter');
    assert.equal(await page.evaluate(() => window.lastOpened), 'https://git.example.test/');
    await page.fill('#searchInput', 'git');
    await page.press('#searchInput', 'ArrowUp');
    assert.equal(await page.locator('#searchInput').getAttribute('aria-activedescendant'), 'search-result-1');
    await page.press('#searchInput', 'Escape');
    assert.equal(await page.locator('#searchInput').getAttribute('aria-expanded'), 'false');
    await page.evaluate(() => document.activeElement.blur());
    for (const [width, expected] of [[390, 1], [1000, 2], [1400, 3], [1920, 5], [2560, 6], [390, 1]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(n => document.querySelectorAll('#groupsContainer > .group-col').length === n, expected);
      const sizes = await page.locator('.group-col').evaluateAll(cols => cols.map(el => el.getBoundingClientRect().toJSON()));
      assert(sizes.every(rect => Math.abs(rect.top - sizes[0].top) < 2), 'Column dropped to another row');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('.group-card').count(), 5);
    }
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.waitForFunction(() => document.querySelectorAll('.group-col').length === 3);
    // Existing group and site drag handlers still persist across responsive rerenders.
    const beforeDrag = await page.locator('.group-card').first().getAttribute('data-id');
    const targetId = await page.locator('.group-card').nth(1).getAttribute('data-id');
    await page.locator('.group-header').first().dragTo(page.locator('.group-card').nth(1), { targetPosition: { x: 50, y: 15 } });
    assert.equal(await page.evaluate(async ({ source, target }) => {
      const { appData } = await import('./js/storage.js');
      const a = appData.groups.find(g => g.id === source), b = appData.groups.find(g => g.id === target);
      return a.column === b.column;
    }, { source: beforeDrag, target: targetId }), true);
    for (const width of [1000, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const count = width === 1000 ? 2 : 5;
      await page.waitForFunction(n => document.querySelectorAll('.group-col').length === n, count);
      const sourceId = await page.locator('.group-card').first().getAttribute('data-id');
      const destinationId = await page.locator('.group-col').nth(1).locator('.group-card').first().getAttribute('data-id');
      await page.locator(`[data-id="${sourceId}"] .group-header`).dragTo(page.locator(`.group-card[data-id="${destinationId}"]`), { targetPosition: { x: 40, y: 10 } });
      assert.equal(await page.locator(`.group-card[data-id="${sourceId}"]`).evaluate(el => el.parentElement.dataset.colIndex), '1');
      assert.equal(await page.locator(`.group-card[data-id="${destinationId}"]`).evaluate(el => el.parentElement.dataset.colIndex), '1');
    }
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    // Migrate old embedded data, verify removal from persisted config and blob survival.
    await page.evaluate(value => {
      const data = JSON.parse(localStorage.getItem('appData'));
      data.settings.wallpaper = value;
      localStorage.setItem('appData', JSON.stringify(data));
    }, png);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.waitForFunction(() => document.body.style.backgroundImage.includes('blob:'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('appData')).settings.wallpaper), null);
    await page.reload();
    await page.waitForFunction(() => document.body.style.backgroundImage.includes('blob:'));
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsAppearance"]');
    await page.setInputFiles('#wallpaperUpload', { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
    await page.waitForFunction(() => !document.querySelector('#wallpaperUpload').disabled);
    assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('appData'))).includes('data:image')), false);
    await page.click('#clearWallpaperBtn');
    await page.waitForFunction(() => !document.body.style.backgroundImage.includes('blob:'));
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    assert.equal(await page.evaluate(() => document.body.style.backgroundImage.includes('blob:')), false);
    // Store has one save handler and JSON import strips unsafe schemes before rendering.
    await page.evaluate(async () => {
      const { syncManager } = await import('./js/storage.js');
      const original = syncManager.saveData.bind(syncManager);
      window.storeSaves = 0;
      syncManager.saveData = (...args) => { window.storeSaves++; return original(...args); };
    });
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsLayout"]');
    await page.click('label[for="dockStoreToggle"]');
    await page.click('#closeSettingsBtn');
    await page.evaluate(() => { window.storeSaves = 0; });
    await page.click('#appStoreBtn');
    await page.click('#addStoreLinksBtn');
    await page.waitForFunction(() => document.querySelector('#appStoreModal').classList.contains('hidden'));
    assert.equal(await page.evaluate(() => window.storeSaves), 1);
    await page.click('#settingsBtn');
    const malicious = { groups: [{ id: 'imported', name: 'Imported', links: [
      { id: 'unsafe', title: 'Unsafe', url: 'javascript:alert(1)' },
      { id: 'safe', title: 'Safe', url: 'https://safe.example.test/' }
    ] }], settings: {} };
    await page.setInputFiles('#importFileNew', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malicious)) });
    await page.waitForFunction(async () => (await import('./js/storage.js')).appData.groups[0].id === 'imported');
    assert.equal(await page.locator('.site-btn').count(), 1);
    assert.equal(await page.locator('.site-btn').getAttribute('href'), 'https://safe.example.test/');
    assert.equal(await page.evaluate(() => localStorage.getItem('appData').includes('javascript:')), false);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.screenshot({ path: '/tmp/simtab-refactor-desktop.png', animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelectorAll('.group-col').length === 1);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: '/tmp/simtab-refactor-mobile.png', animations: 'disabled' });
    // Migration failure leaves the source untouched and prevents accidental overwrite.
    await page.evaluate(value => {
      const data = JSON.parse(localStorage.getItem('appData'));
      data.settings.wallpaper = value;
      localStorage.setItem('appData', JSON.stringify(data));
    }, png);
    await context.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('blocked for test'); } } });
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#syncStatus').textContent.includes('失败'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('appData')).settings.wallpaper), png);
    assert.equal(await page.evaluate(async () => (await import('./js/storage.js')).syncManager.saveData()), false);
    assert.deepEqual(errors, []);
    console.log('PASS: web-search Enter, cross-space selection, keyboard and Escape, responsive 1/2/3/5/6 columns, group drag, wallpaper migration/upload/reload/clear, failed migration preserves source, single store save, safe JSON import, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
