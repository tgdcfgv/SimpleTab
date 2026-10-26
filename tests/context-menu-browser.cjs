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
    // Capture overflow even during synchronous measurement, before the next paint.
    await page.evaluate(() => {
      window.menuMeasurements = [];
      window.sampleMenuOverflow = () => {
        const root = document.documentElement;
        window.menuMeasurements.push({ width: root.scrollWidth, height: root.scrollHeight,
          clientWidth: root.clientWidth, clientHeight: root.clientHeight, x: scrollX, y: scrollY });
      };
      const rect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (...args) {
        const result = rect.apply(this, args);
        if (this.id === 'contextMenu') window.sampleMenuOverflow();
        return result;
      };
      for (const name of ['offsetWidth', 'offsetHeight']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
        Object.defineProperty(HTMLElement.prototype, name, { ...descriptor, get() {
          const result = descriptor.get.call(this);
          if (this.id === 'contextMenu') window.sampleMenuOverflow();
          return result;
        } });
      }
    });
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 140 }]) {
      await page.setViewportSize(viewport);
      for (const scrollPage of [false, true]) {
        await page.evaluate(scrollPage => {
          document.querySelector('#contextMenu').classList.add('hidden');
          document.body.style.minHeight = scrollPage ? '200vh' : '';
          window.scrollTo(0, scrollPage ? 100 : 0);
        }, scrollPage);
        // Let responsive group layout transitions finish before taking a baseline.
        await page.waitForTimeout(500);
        for (const site of [false, true]) {
          for (const corner of ['bottom-right', 'top-left']) {
            const result = await page.evaluate(async ({ site, corner }) => {
              const menu = document.querySelector('#contextMenu');
              menu.classList.add('hidden');
              window.menuMeasurements = [];
              window.sampleMenuOverflow();
              const baseline = window.menuMeasurements[0];
              const root = document.documentElement;
              const x = corner === 'top-left' ? 1 : root.clientWidth - 1;
              const y = corner === 'top-left' ? 1 : root.clientHeight - 1;
              const target = site ? document.querySelector('.site-btn') : document.body;
              target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
              // Observe the full opening transition as well as immediate layout.
              const start = performance.now();
              do {
                await new Promise(requestAnimationFrame);
                window.sampleMenuOverflow();
              } while (performance.now() - start < 250);
              const rect = menu.getBoundingClientRect();
              return { baseline, samples: window.menuMeasurements, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
                width: root.clientWidth, height: root.clientHeight, visible: getComputedStyle(menu).visibility,
                editVisible: getComputedStyle(document.querySelector('#contextEditSite')).display !== 'none' };
            }, { site, corner });
            const label = JSON.stringify({ viewport, scrollPage, site, corner });
            for (const sample of result.samples) assert.deepEqual(sample, result.baseline, `Page overflow/scroll changed: ${label}`);
            assert(result.rect.left >= 9 && result.rect.top >= 9 && result.rect.right <= result.width - 9 && result.rect.bottom <= result.height - 9, `Menu exceeds viewport: ${label}`);
            assert.equal(result.visible, 'visible');
            assert.equal(result.editVisible, site);
          }
        }
      }
    }
    await page.evaluate(() => { document.body.style.minHeight = ''; document.querySelector('#contextMenu').classList.add('hidden'); });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('.app-container').click({ button: 'right', position: { x: 5, y: 5 } });
    await page.click('#contextSettings');
    assert.equal(await page.locator('#settingsModal').isVisible(), true);
    assert.equal(await page.locator('#contextMenu').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS: context menus cause no transient page overflow or scroll changes at viewport edges, on scrolled pages, site menus and short screens; settings action works.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
