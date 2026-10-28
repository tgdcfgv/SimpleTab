const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
const user = { id: 'cache-user', email: 'cache@example.test', user_metadata: { profile_completed: true } };
const data = name => ({ groups: [{ id: 'cached', name, links: [] }], settings: {} });
const cacheKey = `simtab.cloud-cache.${user.id}`;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const extension of [false, true]) {
      const context = await browser.newContext();
      await context.addInitScript(({ user, extension }) => {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem('simtab.auth', JSON.stringify({ user, access_token: 'token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600 }));
          localStorage.setItem('appData', JSON.stringify({ groups: [{ id: 'guest', name: 'Guest', links: [] }], settings: {} }));
        }
        if (extension) window.chrome.storage = { local: {
          get: async key => ({ [key]: JSON.parse(localStorage.getItem(`extension:${key}`) || 'null') }),
          set: async values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(`extension:${key}`, JSON.stringify(value)); },
          remove: async key => localStorage.removeItem(`extension:${key}`)
        } };
      }, { user, extension });
      let remote = { data: data('First cloud'), revision: 1 };
      let gate = null, readStarted = false, offline = false, unauthorized = false, userRequests = 0;
      await context.route('https://**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.hostname !== 'zyttspnlrdzjosnitijb.supabase.co') return route.abort();
        const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
        if (url.pathname.endsWith('/user')) { userRequests++; return reply(user); }
        if (url.pathname.endsWith('/logout')) return reply({});
        if (!url.pathname.endsWith('/account_data')) return reply({});
        if (req.method() === 'GET') {
          const snapshot = JSON.parse(JSON.stringify(remote));
          readStarted = true;
          if (gate) await gate.promise;
          if (offline) return route.abort();
          if (unauthorized) return reply({ message: 'Expired session' }, 401);
          return reply([snapshot]);
        }
        const body = req.postDataJSON();
        if (url.searchParams.get('revision') !== `eq.${remote.revision}`) return reply([]);
        remote = { data: body.data, revision: body.revision };
        return reply([remote]);
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const state = () => page.evaluate(async () => {
        const { appData, syncManager: s } = await import('./js/storage.js');
        return { name: appData.groups[0].name, ready: s.ready, mode: s.mode, status: s.status, conflict: s.conflict };
      });
      const settled = () => page.waitForFunction(async () => {
        const { syncManager: s } = await import('./js/storage.js');
        return s.ready && s.status !== 'syncing' && !s.refreshing && !s.saving && !document.querySelector('.app-container').inert;
      });
      const cache = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), `${extension ? 'extension:' : ''}${cacheKey}`);
      const block = () => { let release; const promise = new Promise(resolve => { release = resolve; }); gate = { promise, release }; readStarted = false; };
      const release = () => { gate.release(); gate = null; };

      await page.goto(APP_URL);
      await settled();
      await page.waitForFunction(key => localStorage.getItem(key) !== null, `${extension ? 'extension:' : ''}${cacheKey}`);
      assert.ok(await cache(), JSON.stringify({ state: await state(), errors, storage: await page.evaluate(() => ({ ...localStorage })) }));
      assert.equal((await cache()).revision, 1);
      assert.equal(userRequests, 0, 'startup must not request user before data');

      block();
      const start = Date.now();
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      assert.equal((await state()).name, 'First cloud', 'cached contents usable while data request is blocked');
      console.log(`${extension ? 'Extension' : 'Web'} cached page usable in ${Date.now() - start}ms with cloud response blocked`);
      await page.evaluate(() => { window.cachedNode = document.querySelector('.main-content')?.firstElementChild || document.querySelector('#spaceDock').firstElementChild; });
      release(); await settled();
      assert.equal(await page.evaluate(() => window.cachedNode.isConnected), true, 'unchanged revision must not redraw');

      remote = { data: data('Updated elsewhere'), revision: 2 };
      await page.reload(); await settled();
      assert.equal((await state()).name, 'Updated elsewhere');
      assert.equal((await cache()).revision, 2);

      block(); await page.reload();
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      // Wait until the background request captures revision 2 before making a new edit.
      while (!readStarted) await new Promise(resolve => setTimeout(resolve, 10));
      await page.evaluate(async () => {
        const { syncManager, appData } = await import('./js/storage.js');
        appData.groups[0].name = 'Edited during refresh';
        if (!await syncManager.saveData()) throw new Error('save failed');
      });
      release(); await settled();
      assert.equal((await state()).name, 'Edited during refresh');
      assert.equal((await cache()).revision, 3);

      // An edit from a stale cache must report a conflict instead of overwriting another device.
      remote = { data: data('Newer device'), revision: 4 };
      block(); await page.reload();
      await page.waitForFunction(() => !document.querySelector('.app-container').inert);
      await page.evaluate(async () => {
        const { syncManager, appData } = await import('./js/storage.js');
        appData.groups[0].name = 'Conflicting edit';
        await syncManager.saveData();
      });
      release(); await settled();
      assert.equal((await state()).name, 'Conflicting edit');
      assert.equal((await state()).conflict, true);
      assert.equal(remote.data.groups[0].name, 'Newer device');
      assert.equal((await cache()).revision, 3);

      offline = true;
      await page.reload(); await settled();
      assert.equal((await state()).name, 'Edited during refresh');
      assert.equal((await state()).mode, 'cloud');
      assert.equal((await state()).status, 'error');
      offline = false; unauthorized = true;
      await page.reload(); await settled();
      assert.equal((await state()).mode, 'local');
      assert.equal(await cache(), null, 'invalid session must clear its cache');
      assert.equal(await page.evaluate(() => localStorage.getItem('simtab.auth')), null);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('appData')).groups[0].name), 'Guest');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: web/extension cache startup, unchanged revision, background update, concurrent edit protection, stale-save conflict, offline fallback and invalid-session cleanup.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
