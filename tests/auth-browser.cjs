const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext();
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' };
    const session = { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 3600, user };
    let remote = null, failRead = false, otpCount = 0;
    const verified = [], errors = [];
    await context.route('https://**/*', route => route.abort());
    await context.route('https://zyttspnlrdzjosnitijb.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname.endsWith('/otp')) {
        otpCount++;
        assert.equal(url.searchParams.get('redirect_to'), APP_URL);
        assert.deepEqual(request.postDataJSON(), { email: user.email, create_user: true });
        return reply({});
      }
      if (url.pathname.endsWith('/verify')) { verified.push(request.postDataJSON()); return reply(session); }
      if (url.pathname.endsWith('/user')) return reply(user);
      if (url.pathname.endsWith('/logout')) return reply({});
      if (url.pathname.endsWith('/account_data')) {
        if (failRead) return reply({ message: '同步暂时不可用' }, 503);
        if (request.method() === 'GET') return reply(remote ? [remote] : []);
        remote = { data: request.postDataJSON().data, revision: 1 }; return reply([remote]);
      }
      return reply({}, 400);
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP_URL);
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    const local = await page.evaluate(() => localStorage.getItem('appData'));
    async function emailStep() {
      await page.click('#accountBtn');
      await page.fill('#authEmailInput', user.email);
      await page.click('#authEmailSubmitBtn');
      await page.waitForSelector('#authStepVerify:not([hidden])');
    }
    async function assertSignedIn() {
      await page.waitForFunction(() => document.querySelector('#accountBtn').dataset.signedIn === 'true' && !document.querySelector('.app-container').inert);
      assert.equal(await page.locator('#authModal').isVisible(), false);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('simtab.auth')).user.email), user.email);
      assert.equal(await page.evaluate(() => localStorage.getItem('appData')), local);
    }
    async function logout() {
      if (!await page.locator('#settingsModal').isVisible()) await page.click('#accountBtn');
      await page.click('#accountLogout');
      await page.waitForFunction(() => localStorage.getItem('simtab.auth') === null);
      await page.click('#closeSettingsBtn');
    }
    // New user: enter the email code, initialize cloud, keep local copy.
    await emailStep();
    await page.screenshot({ path: '/tmp/simtab-otp-login.png' });
    await page.fill('#authManualInput', '123');
    await page.click('#authVerifySubmitBtn');
    assert.equal(verified.length, 0);
    assert.match(await page.locator('#authVerifyError').innerText(), /数字验证码/);
    await page.fill('#authManualInput', '123456');
    await page.click('#authVerifySubmitBtn');
    await assertSignedIn();
    assert.deepEqual(verified.pop(), { email: user.email, token: '123456', type: 'email' });
    assert(remote?.data?.spaces?.length);
    await logout();
    // Existing user: eight-digit codes must use email+token.
    await emailStep();
    await page.fill('#authManualInput', '12345678'); await page.click('#authVerifySubmitBtn');
    await assertSignedIn();
    assert.deepEqual(verified.pop(), { email: user.email, token: '12345678', type: 'email' });
    await logout();
    // A callback in a second tab restores the original tab through the storage listener.
    await emailStep();
    const callback = await context.newPage();
    callback.on('pageerror', error => errors.push(error.message));
    await callback.goto(APP_URL + '#access_token=mock-token&refresh_token=mock-refresh&expires_in=3600');
    await assertSignedIn();
    await callback.waitForFunction(() => !location.hash && !document.querySelector('.app-container').inert);
    await callback.close();
    await logout();
    // Login remains recoverable if the initial cloud read fails.
    await emailStep();
    await page.fill('#authManualInput', '123456');
    failRead = true;
    await page.click('#authVerifySubmitBtn');
    await page.waitForFunction(() => document.querySelector('#accountMessage').textContent.includes('同步暂时不可用'));
    assert.equal(await page.locator('#settingsData').isVisible(), true);
    failRead = false;
    await page.click('#accountSync');
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#closeSettingsBtn');
    await assertSignedIn();
    await logout();
    // Callback failures remain visible and credentials disappear from the address bar.
    await page.goto(APP_URL + '#error=access_denied&error_description=expired');
    await page.reload();
    await page.waitForSelector('#authEmailError:not([hidden])');
    assert.match(await page.locator('#authEmailError').innerText(), /过期/);
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(otpCount, 4);
    assert.deepEqual(errors, []);
    console.log('PASS: signup code, OTP request redirect, eight-digit login, legacy cross-tab callback, cloud failure/retry, local data isolation, expired link errors, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
