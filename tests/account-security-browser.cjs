const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext();
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.test', user_metadata: { nickname: '测试账户', avatar_emoji: '🌱', profile_completed: true } };
    const session = { user, access_token: 'mock', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600 };
    let failDelete = true, deletions = 0, sends = 0;
    await context.route('https://**/*', route => new URL(route.request().url()).origin === new URL(APP_URL).origin ? route.continue() : route.abort());
    await context.route('https://zyttspnlrdzjosnitijb.supabase.co/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (path.endsWith('/otp')) { sends++; assert.equal(request.postDataJSON().create_user, false); return reply({}); }
      if (path.endsWith('/user')) return reply(user);
      if (path.endsWith('/delete-account')) { if (request.postDataJSON().code !== '12345678') return reply({ message: '验证码已过期，请重新获取' }, 400); deletions++; return reply({ message: failDelete ? '注销暂时不可用，请重试' : '已注销' }, failDelete ? 503 : 200); }
      if (path.endsWith('/account_data')) return reply(request.method() === 'GET' ? [] : [{ revision: 1 }]);
      return reply({});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP_URL);
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#settingsBtn');
    await page.click('[data-settings-panel="settingsAccount"]');
    assert.equal(await page.locator('#accountChangePassword, #securityPassword, #securityPasswordConfirm').count(), 0);
    const local = await page.evaluate(() => localStorage.getItem('appData'));
    await page.evaluate(session => localStorage.setItem('simtab.auth', JSON.stringify(session)), session);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#accountBtn');
    await page.screenshot({ path: '/tmp/simpletab-account-security.png' });
    await page.click('#accountDelete');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'securityCancel');
    await page.click('#securityCancel');
    assert.equal(deletions, 0);
    await page.click('#accountDelete');
    await page.click('#securitySendCode');
    await page.waitForFunction(() => document.querySelector('#accountSecurityMessage').textContent.includes('已发送'));
    assert.equal(sends, 1);
    assert.equal(await page.locator('#securitySendCode').isDisabled(), true);
    await page.fill('#securityCode', '00000000');
    await page.click('#securitySubmit');
    await page.waitForFunction(() => document.querySelector('#accountSecurityMessage').textContent.includes('已过期'));
    assert.equal(deletions, 0);
    await page.fill('#securityCode', '12345678');
    await page.click('#securitySubmit');
    await page.waitForFunction(() => document.querySelector('#accountSecurityMessage').textContent.includes('暂时不可用'));
    assert.equal(await page.evaluate(() => !!localStorage.getItem('simtab.auth')), true);
    await page.setViewportSize({ width: 390, height: 700 });
    const dialogBox = await page.locator('#accountSecurityDialog').boundingBox();
    assert.ok(dialogBox.x >= 15 && dialogBox.x + dialogBox.width <= 375, 'Dialog has mobile side margins');
    assert.ok(dialogBox.y >= 15, 'Dialog is vertically centered');
    await page.screenshot({ path: '/tmp/simpletab-delete-mobile.png' });
    assert.equal(await page.locator('#accountSecurityDialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.screenshot({ path: '/tmp/simpletab-delete-dark.png' });
    failDelete = false;
    await page.click('#securitySubmit');
    await page.waitForFunction(() => !document.querySelector('#accountSecurityDialog').open);
    assert.equal(await page.evaluate(() => localStorage.getItem('simtab.auth')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('appData')), local);
    assert.equal(await page.locator('#accountChangePassword, #securityPassword, #securityPasswordConfirm').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: no password controls, OTP cooldown, expired OTP, deletion cancel/failure/success, local preservation, narrow/dark layouts, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
