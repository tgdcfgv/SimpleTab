const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1360, height: 920 }, hasTouch: true });
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html');
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#spaceEditBtn');
    await page.click('#bulkAddGroup');
    // The menu must be at its button and receive pointer hits, including in a modal.
    assert(await page.locator('#contextMenu').evaluate(menu => {
      const rect = menu.getBoundingClientRect(), button = document.querySelector('#bulkAddGroup').getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight &&
        Math.abs(rect.top - button.bottom - 6) < 2 && menu.contains(document.elementFromPoint(rect.left + 20, rect.top + 20));
    }));
    await page.keyboard.press('Escape');
    assert(await page.locator('#bulkEditorDialog').isVisible());
    assert.equal(await page.locator('#bulkAddGroup').getAttribute('aria-expanded'), 'false');
    await page.click('[data-select-nav="0"]');
    const row = page.locator('.bulk-site-row').first();
    const box = await row.boundingBox();
    await page.mouse.move(box.x + 35, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(400);
    assert(await row.evaluate(el => el.classList.contains('is-dragging')));
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(await page.locator('.is-dragging').count(), 0);
    assert(await page.locator('#bulkEditorDialog').isVisible());
    // A touch held on the row can reorder without a separate drag handle.
    const cdp = await context.newCDPSession(page);
    const titles = await page.locator('.bulk-title-input').evaluateAll(inputs => inputs.map(input => input.value));
    const second = await page.locator('.bulk-site-row').nth(1).boundingBox();
    const point = { x: box.x + 35, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.is-dragging').count(), 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: second.y + second.height - 3 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('.bulk-title-input').nth(1).inputValue(), titles[0]);
    await page.locator('[data-delete-site]').first().click();
    assert(await page.locator('#bulkUndo').isVisible());
    assert(await page.locator('#simtabToast').evaluate(toast => {
      const rect = toast.getBoundingClientRect();
      return rect.top < 60 && toast.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: '/tmp/simpletab-bulk-interactions.png', animations: 'disabled' });
    await page.click('#bulkUndo');
    assert.equal(await page.locator('.bulk-title-input').count(), titles.length);
    await page.click('#bulkClose');
    await page.click('#bulkDiscard');
    assert(await page.locator('#simtabToast').isHidden());
    assert.deepEqual(errors, []);
    console.log('PASS: menu position/hit testing, Escape cancellation, touch long-press sorting, top-layer undo and close cleanup.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
