const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1360, height: 920 } });
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html');
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    await page.click('#spaceEditBtn');
    await page.click('#bulkAddGroup');
    // The menu must be at its button and receive pointer hits, including in a modal.
    assert(await page.locator('#contextMenu').evaluate(menu => {
      const rect = menu.getBoundingClientRect(), button = document.querySelector('#bulkAddGroup').getBoundingClientRect(), dialog = document.querySelector('#bulkEditorDialog').getBoundingClientRect();
      return rect.left >= dialog.left && rect.right <= dialog.right && rect.top >= dialog.top && rect.bottom <= dialog.bottom &&
        Math.abs(rect.top - button.bottom - 6) < 2 && menu.contains(document.elementFromPoint(rect.left + 20, rect.top + 20));
    }));
    await page.keyboard.press('Escape');
    assert(await page.locator('#bulkEditorDialog').isVisible());
    assert.equal(await page.locator('#bulkAddGroup').getAttribute('aria-expanded'), 'false');
    const opacity = selector => page.locator(selector).first().evaluate(el => getComputedStyle(el).opacity);
    await page.locator('#bulkSearch').hover();
    await page.waitForTimeout(160);
    assert.equal(await opacity('[data-key]'), '0');
    assert.equal(await opacity('[data-select-group]'), '0');
    await page.screenshot({ path: '/tmp/simpletab-bulk-idle.png', animations: 'disabled' });
    await page.locator('.bulk-site-row').first().hover();
    await page.waitForTimeout(160);
    assert.equal(await opacity('[data-key]'), '1');
    assert.equal(await page.locator('[data-key]').nth(1).evaluate(el => getComputedStyle(el).opacity), '0');
    assert.deepEqual(await page.locator('[data-edit-site]').first().evaluate(el => [el.offsetWidth, el.offsetHeight]), [26, 28]);
    assert.equal(await page.locator('[data-edit-site] svg').first().evaluate(el => el.getBoundingClientRect().width), 15);
    await page.screenshot({ path: '/tmp/simpletab-bulk-hover.png', animations: 'disabled' });
    const centerX = selector => page.locator(selector).first().evaluate(el => { const r = el.getBoundingClientRect(); return r.x + r.width / 2; });
    assert(Math.abs(await centerX('.bulk-detail-heading > svg') - await centerX('[data-key]')) < 1);
    assert(Math.abs(await centerX('.bulk-space-toggle > svg') - await centerX('[data-select-group]')) < 1);
    const defaultBackground = await page.locator('.bulk-site-row').first().evaluate(el => getComputedStyle(el).backgroundColor);
    await page.locator('[data-key]').first().check();
    await page.locator('#bulkSearch').hover();
    await page.waitForTimeout(160);
    assert(await page.locator('[data-key], [data-select-group], [data-select-space]').evaluateAll(inputs => inputs.every(el => getComputedStyle(el).opacity === '1')));
    assert.notEqual(await page.locator('.bulk-site-row').first().evaluate(el => getComputedStyle(el).backgroundColor), defaultBackground);
    await page.locator('[data-key]').first().uncheck();
    await page.locator('#bulkSearch').hover();
    await page.waitForTimeout(160);
    assert.equal(await opacity('[data-key]'), '0');
    assert.equal(await page.locator('.bulk-site-actions').first().evaluate(el => getComputedStyle(el).opacity), '0', 'checkbox focus must not keep row actions visible after deselection');
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      await page.locator('[data-key]').first().check();
      await page.locator('#bulkSearch').hover();
      const colors = await page.locator('.bulk-site-row').evaluateAll(rows => rows.slice(0, 2).map(row => getComputedStyle(row).backgroundColor));
      assert.notEqual(colors[0], colors[1], `selection background in ${colorScheme}`);
      await page.locator('[data-key]').first().uncheck();
      await page.locator('#bulkSearch').hover();
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.click('[data-select-nav="0"]');
    const beforeNative = await page.locator('.bulk-title-input').evaluateAll(inputs => inputs.map(input => input.value));
    await page.evaluate(() => {
      window.nativeStarts = 0;
      document.querySelector('#bulkEditorDialog').addEventListener('dragstart', event => { if (event.isTrusted) window.nativeStarts++; });
    });
    // Drag over the text region, which previously intercepted browser-native drags.
    await page.locator('.bulk-site-copy').first().dragTo(page.locator('.bulk-site-row').nth(1), { targetPosition: { x: 110, y: 31 } });
    assert.equal(await page.locator('.bulk-title-input').nth(1).inputValue(), beforeNative[0]);
    assert.equal(await page.evaluate(() => window.nativeStarts), 1);
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await page.locator('.bulk-site-row').first().dispatchEvent('dragstart', { dataTransfer: transfer });
    const markerY = async (index, after) => {
      const target = page.locator('.bulk-site-row').nth(index), bounds = await target.boundingBox();
      await target.dispatchEvent('dragover', { dataTransfer: transfer, clientY: bounds.y + (after ? bounds.height - 2 : 2) });
      assert.equal(await page.locator('.bulk-insertion-line:not([hidden])').count(), 1);
      assert.equal(await page.locator('.bulk-drop-before, .bulk-drop-after, .drop-target').count(), 0);
      return page.locator('.bulk-insertion-line').evaluate(el => el.getBoundingClientRect().top);
    };
    assert(Math.abs(await markerY(1, true) - await markerY(2, false)) < 1, 'adjacent row edges share one insertion line');
    await page.screenshot({ path: '/tmp/simpletab-single-drop-line.png', animations: 'disabled' });
    await page.locator('.bulk-site-row').first().dispatchEvent('dragend');
    assert.equal(await page.locator('.bulk-insertion-line:not([hidden])').count(), 0);
    const url = page.locator('.bulk-url-input').first();
    const urlBox = await url.boundingBox();
    await page.mouse.dblclick(urlBox.x + 30, urlBox.y + urlBox.height / 2);
    assert(await url.evaluate(el => el === document.activeElement));
    await page.locator('#bulkSearch').focus();
    await page.click('#bulkClose'); await page.click('#bulkDiscard');
    await context.close();
    const touchContext = await browser.newContext({ viewport: { width: 1360, height: 920 }, hasTouch: true });
    await touchContext.route('https://**/*', route => route.abort());
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.goto(process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html');
    await touchPage.waitForFunction(() => !document.querySelector('.app-container').inert);
    await touchPage.click('#spaceEditBtn'); await touchPage.click('[data-select-nav="0"]');
    const row = touchPage.locator('.bulk-site-row').first(), box = await row.boundingBox();
    // A touch held on the row can reorder without a separate drag handle.
    const cdp = await touchContext.newCDPSession(touchPage);
    const titles = await touchPage.locator('.bulk-title-input').evaluateAll(inputs => inputs.map(input => input.value));
    const second = await touchPage.locator('.bulk-site-row').nth(1).boundingBox();
    const point = { x: box.x + 35, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touchPage.waitForTimeout(400);
    assert.equal(await touchPage.locator('.is-dragging').count(), 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: second.y + second.height - 3 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await touchPage.locator('.bulk-title-input').nth(1).inputValue(), titles[0]);
    await touchPage.locator('[data-delete-site]').first().click();
    assert(await touchPage.locator('#bulkUndo').isVisible());
    assert(await touchPage.locator('#simtabToast').evaluate(toast => {
      const rect = toast.getBoundingClientRect();
      return rect.top < 60 && toast.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }));
    await touchPage.emulateMedia({ colorScheme: 'dark' });
    await touchPage.screenshot({ path: '/tmp/simpletab-bulk-interactions.png', animations: 'disabled' });
    await touchPage.click('#bulkUndo');
    assert.equal(await touchPage.locator('.bulk-title-input').count(), titles.length);
    await touchPage.click('#bulkClose');
    await touchPage.click('#bulkDiscard');
    assert(await touchPage.locator('#simtabToast').isHidden());
    assert.deepEqual(errors, []);
    console.log('PASS: hover/global checkbox visibility, aligned selection columns, trusted native desktop drag over text, double-click URL editing, single insertion line, selected backgrounds, deselection action cleanup, touch long-press sorting and top-layer undo.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
