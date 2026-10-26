const { chromium } = require('playwright');
const assert = require('node:assert/strict');
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
    await page.click('[data-settings-panel="settingsAppearance"]');
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (let repeat = 0; repeat < 3; repeat++) {
        const samples = await page.evaluate(async () => {
          const container = document.querySelector('#themeSelect').nextElementSibling;
          const trigger = container.querySelector('button');
          const list = container.querySelector('.custom-select-options-content');
          const sample = () => ({ height: list.clientHeight, scrollHeight: list.scrollHeight, width: list.clientWidth });
          const samples = [];
          trigger.click();
          samples.push(sample());
          const start = performance.now();
          do {
            await new Promise(requestAnimationFrame);
            samples.push(sample());
          } while (performance.now() - start < 400);
          return samples;
        });
        for (const sample of samples) {
          assert(sample.height > 0);
          assert(sample.scrollHeight <= sample.height + 1, 'Short dropdown must never acquire a temporary scrollbar');
          assert.deepEqual(sample, samples[0], 'Dropdown scroll area must stay the same size throughout opening');
        }
        await page.locator('#themeSelect + .custom-select-container .custom-select-trigger-global').press('Escape');
        assert.equal(await page.locator('#themeSelect + .custom-select-container .custom-select-options-global').isVisible(), false);
      }
    }
    // Long lists still need a real scroll area and must allow selecting the last option.
    await page.evaluate(async () => {
      const select = document.createElement('select');
      select.id = 'longDropdown';
      select.innerHTML = Array.from({ length: 20 }, (_, i) => `<option value="${i}">选项 ${i + 1}</option>`).join('');
      document.querySelector('#settingsAppearance .setting-control').appendChild(select);
      (await import('./js/modals.js')).updateCustomSelectOptions(select);
    });
    const long = page.locator('#longDropdown + .custom-select-container');
    await long.locator('.custom-select-trigger-global').click();
    assert.equal(await long.locator('.custom-select-options-content').evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight <= 212), true);
    await long.locator('.custom-option-global').last().click();
    assert.equal(await page.locator('#longDropdown').inputValue(), '19');
    assert.equal(await long.locator('.custom-select-options-global').isVisible(), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await long.locator('.custom-select-trigger-global').click();
    assert.equal(await long.locator('.custom-select-options-global').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.deepEqual(errors, []);
    console.log('PASS: dropdown scroll area stays stable throughout repeated desktop/mobile opening; short menus never overflow, long menus scroll and select, Escape closes, reduced motion works.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
