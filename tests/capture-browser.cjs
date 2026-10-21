const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'simtab-capture-'));
  const extensionPath = path.resolve(__dirname, '..');
  let executablePath = process.env.SIMTAB_CHROMIUM_PATH || chromium.executablePath();
  if (!fs.existsSync(executablePath)) {
    const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
    const revision = fs.existsSync(cache) && fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().at(-1);
    if (revision) executablePath = path.join(cache, revision, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  }
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let remote = { data: null, revision: 1 };
    let offlineWrite = false;
    let cloudWrites = 0;
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('https://**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (url.pathname.endsWith('/user')) return reply({ id: 'test-user', email: 'capture@example.test' });
      if (url.pathname.endsWith('/account_data')) {
        if (request.method() === 'GET') return reply([remote]);
        if (offlineWrite) return route.abort();
        cloudWrites++;
        const body = request.postDataJSON();
        if (url.searchParams.get('revision') !== `eq.${remote.revision}`) return reply([]);
        remote = { data: body.data, revision: body.revision };
        return reply([remote]);
      }
      return route.abort();
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const base = `chrome-extension://${id}/newtab.html`;
    const seed = await context.newPage();
    await seed.goto(base);
    await seed.waitForFunction(() => !document.querySelector('.app-container').inert);
    const baseline = await seed.evaluate(async () => {
      const s = await import('./js/storage.js');
      await s.syncManager.saveData();
      return (await chrome.storage.local.get('appData')).appData;
    });
    async function capture(url = 'https://saved.example.test/path', title = 'Captured title') {
      const created = context.waitForEvent('page');
      await seed.evaluate(async input => { await (await import('./js/background.js')).openCapture(input); }, { url, title });
      const page = await created;
      await page.waitForURL(`${base}#capture=*`);
      return page;
    }
    let page = await capture();
    await page.waitForSelector('#captureDialog[open]');
    await page.screenshot({ path: '/tmp/simtab-capture-desktop.png', animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: '/tmp/simtab-capture-mobile.png', animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.locator('#captureUrl').inputValue(), 'https://saved.example.test/path');
    assert.deepEqual(await seed.evaluate(async () => (await chrome.storage.local.get('appData')).appData), baseline);
    await page.selectOption('#captureSpace', 'space-work');
    const groupId = await page.locator('#captureGroup').inputValue();
    await page.fill('#captureTitle', '<Saved & safe>');
    await page.click('#captureSave');
    await page.waitForFunction(() => document.querySelector('#captureMessage').textContent.startsWith('已保存'));
    const saved = await seed.evaluate(async () => (await chrome.storage.local.get('appData')).appData);
    assert.equal(saved.spaces[1].groups.find(g => g.id === groupId).links[0].title, '<Saved & safe>');
    assert.equal(await page.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter(k => k.startsWith('simtab.capture.')).length), 0);
    await page.click('#captureCancel');
    assert.equal(await page.locator('.site-title').filter({ hasText: '<Saved & safe>' }).count(), 1);
    // The original tab still has an older snapshot and must not overwrite this save.
    const stale = await seed.evaluate(async () => {
      const s = await import('./js/storage.js');
      s.appData.groups[0].name = 'stale edit';
      return s.syncManager.saveData();
    });
    assert.equal(stale, false);
    assert.equal(await seed.evaluate(async () => (await chrome.storage.local.get('appData')).appData.groups[0].name), baseline.groups[0].name);
    await seed.reload();
    await seed.waitForFunction(() => !document.querySelector('.app-container').inert);
    page = await capture();
    await page.waitForSelector('#captureDialog[open]');
    await page.selectOption('#captureSpace', 'space-work');
    await page.click('#captureSave');
    await page.waitForFunction(() => document.querySelector('#captureMessage').textContent.includes('无需重复添加'));
    assert.equal(await seed.evaluate(async () => (await chrome.storage.local.get('appData')).appData.spaces[1].groups[0].links.length), 1);
    page = await capture('https://cancelled.example.test');
    await page.waitForSelector('#captureDialog[open]');
    await page.click('#captureCancel');
    assert.equal(await seed.evaluate(async () => JSON.stringify((await chrome.storage.local.get('appData')).appData).includes('cancelled.example.test')), false);
    page = await capture('chrome://settings');
    await page.waitForSelector('#captureDialog[open]');
    assert.match(await page.locator('#captureMessage').innerText(), /无法收藏/);
    assert.equal(await page.locator('#captureForm').isVisible(), false);
    await page.click('#captureCancel');
    // Real extension session storage must survive a page reload while a draft is open.
    page = await capture('https://refresh.example.test');
    await page.waitForSelector('#captureDialog[open]');
    await page.reload();
    await page.waitForSelector('#captureDialog[open]');
    assert.equal(await page.locator('#captureUrl').inputValue(), 'https://refresh.example.test/');
    await page.click('#captureCancel');
    // Simulate an already authenticated account without touching a real backend.
    remote.data = structuredClone(baseline);
    await seed.evaluate(() => localStorage.setItem('simtab.auth', JSON.stringify({
      access_token: 'mock-access', refresh_token: 'mock-refresh', expires_at: Date.now() / 1000 + 3600,
      user: { id: 'test-user', email: 'capture@example.test' }, needs_choice: true
    })));
    page = await capture('https://cloud.example.test');
    await page.waitForSelector('#accountChoice:not([hidden])');
    assert.equal(await page.locator('#captureDialog').evaluate(el => el.open), false);
    assert.equal(cloudWrites, 0);
    await page.click('#accountUseCloud');
    await page.waitForSelector('#accountDetails:not([hidden])');
    await page.click('#closeSettingsBtn');
    await page.waitForSelector('#captureDialog[open]');
    assert.match(await page.locator('#captureDestination').innerText(), /云端账户 capture@example.test/);
    await page.selectOption('#captureSpace', 'space-favorites');
    offlineWrite = true;
    await page.click('#captureSave');
    await page.waitForFunction(() => document.querySelector('#captureMessage').textContent.includes('保持页面打开'));
    assert.equal(cloudWrites, 0);
    assert.equal(JSON.stringify(remote.data).includes('cloud.example.test'), false);
    offlineWrite = false;
    await page.click('#captureSave');
    await page.waitForFunction(() => document.querySelector('#captureForm').hidden);
    assert.equal(remote.data.spaces[2].groups[0].links.filter(l => l.url === 'https://cloud.example.test/').length, 1);
    assert.equal(await page.evaluate(async () => JSON.stringify((await chrome.storage.local.get('appData')).appData).includes('cloud.example.test')), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/simtab-capture-success.png', animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('PASS: real unpacked MV3 extension, service worker, session drafts, cross-space save, duplicate/cancel/unsupported/reload, stale-tab protection, login choice, cloud failure retry, local/cloud isolation, mobile, no page errors.');
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
