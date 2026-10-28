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
    const snapshot = () => page.evaluate(async () => JSON.stringify((await import('./js/storage.js')).appData.spaces));
    const original = await snapshot();
    await page.click('#spaceEditBtn');
    assert(await page.locator('#bulkSave').isDisabled());
    assert.equal(await page.locator('#bulkSelectAllLabel').innerText(), '全选当前视图');
    assert.equal(await page.locator('#bulkSelectionCount').innerText(), '已选 0 个网站');
    assert.equal(await page.locator('.bulk-heading #bulkImportBookmarks').count(), 1);
    assert.equal(await page.locator('#bulkShowEmptySpaces').getAttribute('role'), 'switch');
    await page.click('[data-select-nav="0"]');
    const groupCount = await page.locator('[data-key]').count();
    await page.check('[data-select-group="0"]');
    assert.equal(await page.locator('[data-key]:checked').count(), groupCount);
    assert(await page.locator('#bulkSave').isDisabled(), 'selection is not a data change');
    await page.locator('[data-key]').first().uncheck();
    assert(await page.locator('[data-select-group="0"]').evaluate(el => el.indeterminate));
    assert(await page.locator('[data-select-space="0"]').evaluate(el => el.indeterminate));
    // Clearing a filtered selection leaves the hidden selection intact.
    const title = await page.locator('.bulk-title-input').first().inputValue();
    await page.fill('#bulkSearch', title);
    assert.equal(await page.locator('#bulkSelectAllLabel').innerText(), '全选当前筛选结果');
    assert.match(await page.locator('#bulkSelectionCount').innerText(), /匹配/);
    await page.click('#bulkClearSearch');
    assert.equal(await page.locator('#bulkSearch').inputValue(), '');
    assert(await page.locator('#bulkClearSearch').isHidden());
    // Editing and reverting returns to a clean draft.
    await page.locator('.bulk-title-input').first().fill('临时名称');
    assert(await page.locator('#bulkSave').isEnabled());
    assert(await page.locator('#bulkDirtyHint').isVisible());
    await page.locator('.bulk-title-input').first().fill(title);
    assert(await page.locator('#bulkSave').isDisabled());
    await page.locator('.bulk-site-row').first().hover();
    await page.locator('[data-delete-site]').first().click();
    assert.equal(await page.locator('[data-key]').count(), groupCount - 1);
    await page.click('#bulkUndo');
    assert.equal(await page.locator('[data-key]').count(), groupCount);
    assert(await page.locator('#bulkSave').isDisabled());
    // Row navigation doesn't enter rename; explicit edit does.
    await page.locator('[data-nav-group="0"]').click({ position: { x: 90, y: 3 } });
    assert(await page.locator('[data-edit-group="0"]').isHidden());
    await page.locator('[data-nav-group="0"]').hover();
    await page.click('[data-rename-group="0"]');
    await page.fill('[data-edit-group="0"]', '临时分组');
    await page.locator('#bulkSearch').focus();
    // Every close path opens the same confirmation; cancelling preserves drafts.
    for (const close of [() => page.click('#bulkCancel'), () => page.click('#bulkClose'), () => page.keyboard.press('Escape'), () => page.mouse.click(2, 2)]) {
      await close();
      assert(await page.locator('#bulkDiscardDialog').isVisible());
      await page.click('#bulkKeepEditing');
      assert(await page.locator('#bulkEditorDialog').isVisible());
      assert.equal(await page.locator('[data-select-nav="0"] .bulk-nav-name').innerText(), '临时分组');
    }
    assert.equal(await snapshot(), original);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/simpletab-bulk-ux-dark.png', animations: 'disabled' });
    for (const width of [390, 640, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.locator('#bulkEditorDialog').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `overflow at ${width}`);
    }
    // The create-from-move path must also finish the move without an arrow.
    await page.selectOption('#bulkMoveTarget', 'new');
    await page.fill('#bulkCreateName', '移动目标');
    await page.locator('#bulkCreateForm button[type="submit"]').click();
    assert.equal(await page.locator('[data-key]').count(), groupCount - 1);
    assert.equal(await page.locator('#bulkMoveTarget').inputValue(), '');
    const heightBeforeCreate = await page.locator('#bulkEditorDialog').evaluate(el => el.offsetHeight);
    await page.click('#bulkAddGroup');
    await page.click('[data-create-kind="group"]');
    assert(await page.locator('#bulkCreateDialog').isVisible());
    assert.equal(await page.locator('#bulkEditorDialog').evaluate(el => el.offsetHeight), heightBeforeCreate, 'create dialog does not increase bulk editor height');
    await page.keyboard.press('Escape');
    assert(await page.locator('#bulkCreateDialog').isHidden());
    await page.keyboard.press('Escape');
    assert(await page.locator('#bulkDiscardDialog').isVisible());
    await page.click('#bulkKeepEditing');
    await page.click('#bulkClose');
    await page.click('#bulkDiscard');
    assert(await page.locator('#bulkEditorDialog').isHidden());
    assert.equal(await snapshot(), original);
    assert.deepEqual(errors, []);
    console.log('PASS: parent/partial selection, search clear/context, dirty/revert/undo, explicit rename, all four close guards, draft isolation, dark appearance and responsive layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
