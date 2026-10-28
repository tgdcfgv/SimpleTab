const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const failure of ['refresh', 'data']) {
      const context = await browser.newContext();
      const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com',
        user_metadata: { nickname: '测试', avatar_emoji: '😊', profile_completed: true } };
      await context.addInitScript(({ user, expired }) => {
        if (localStorage.getItem('simtab.auth')) return;
        localStorage.setItem('appData', JSON.stringify({ groups: [{ id: 'local', name: 'Local group', links: [] }], settings: {} }));
        localStorage.setItem('simtab.auth', JSON.stringify({ access_token: 'mock-token', refresh_token: 'mock-refresh',
          expires_at: Date.now() / 1000 + (expired ? -100 : 3600), needs_choice: false, user }));
      }, { user, expired: failure === 'refresh' });
      let offline = true;
      let writes = 0;
      await context.route('https://**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.hostname !== 'zyttspnlrdzjosnitijb.supabase.co') return route.abort();
        if (offline && ((failure === 'refresh' && url.pathname.endsWith('/token')) ||
            (failure === 'data' && url.pathname.endsWith('/account_data')))) return route.abort();
        const reply = json => route.fulfill({ contentType: 'application/json', body: JSON.stringify(json) });
        if (url.pathname.endsWith('/token')) return reply({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600, user });
        if (url.pathname.endsWith('/user')) return reply(user);
        if (url.pathname.endsWith('/account_data')) {
          if (req.method() !== 'GET') writes++;
          return reply([{ data: { groups: [{ id: 'cloud', name: 'Cloud group', links: [] }], settings: {} }, revision: 1 }]);
        }
        return reply({});
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(APP_URL);
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      const state = () => page.evaluate(async () => {
        const { syncManager: sync, appData } = await import('./js/storage.js');
        return { mode: sync.mode, ready: sync.ready, name: appData.groups[0].name };
      });
      assert.deepEqual(await state(), { mode: 'local', ready: true, name: 'Local group' }, failure);
      assert.equal(await page.locator('#settingsModal').isVisible(), false);
      await page.click('#settingsBtn');
      await page.click('[data-settings-panel="settingsAccount"]');
      assert.equal(await page.locator('#accountMigrate').isDisabled(), true);
      assert.match(await page.locator('#accountDisclaimerText').innerText(), /本地内容/);
      await page.click('#accountSync');
      await page.waitForFunction(() => !document.querySelector('#closeSettingsBtn').disabled);
      await page.click('#closeSettingsBtn');
      assert.equal(await page.locator('#settingsModal').isVisible(), false);
      // Saving during an outage must remain usable and must never upload local content.
      await page.evaluate(async () => {
        const { syncManager, appData } = await import('./js/storage.js');
        appData.groups[0].name = 'Offline edit';
        if (!await syncManager.saveData()) throw new Error('Local save failed');
      });
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      assert.deepEqual(await state(), { mode: 'local', ready: true, name: 'Offline edit' });
      offline = false;
      // Focus and online events must not silently replace local edits with account data.
      await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); });
      assert.equal((await state()).mode, 'local');
      await page.click('#syncStatus');
      await page.waitForFunction(() => document.querySelector('#syncStatus .status-text').textContent === '云端已保存' && !document.querySelector('#closeSettingsBtn').disabled);
      assert.deepEqual(await state(), { mode: 'cloud', ready: true, name: 'Cloud group' }, failure);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('appData')).groups[0].name), 'Offline edit');
      assert.equal(writes, 0);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: refresh and cloud-read outages without a cache allow local use, settings dismissal, safe local saves and explicit cloud retry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
