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
  const state = () => page.evaluate(async () => {
   const { appData } = await import('./js/storage.js');
   return JSON.parse(JSON.stringify({ spaces: appData.spaces, active: appData.activeSpaceId }));
  });
  const original = await state();
  await page.click('#spaceEditBtn');
  for (const width of [1360, 768, 390]) {
   await page.setViewportSize({ width, height: 844 });
   await page.click('#bulkAddGroup');
   assert(await page.locator('#contextMenu').evaluate(menu => {
    const r = menu.getBoundingClientRect(), d = document.querySelector('#bulkEditorDialog').getBoundingClientRect();
    return r.left >= d.left && r.right <= d.right && r.top >= d.top && r.bottom <= d.bottom;
   }), `menu inside dialog at ${width}`);
   assert(await page.locator('#contextAddSpace').isVisible());
   if (width === 1360) await page.screenshot({ path: '/tmp/simpletab-create-menu-inside.png', animations: 'disabled' });
   await page.keyboard.press('Escape');
  }
  await page.click('#bulkAddGroup'); await page.click('#contextAddSpace');
  await page.fill('#bulkNewSpaceName', '取消测试'); await page.click('#bulkSpaceCreateCancel');
  assert(await page.locator('#bulkSave').isDisabled()); assert.deepEqual(await state(), original);
  async function createSpace(name) {
   await page.click('#bulkAddGroup'); await page.click('#contextAddSpace');
   await page.fill('#bulkNewSpaceName', name); await page.locator('#bulkSpaceCreateForm [type="submit"]').click();
  }
  await createSpace('   ');
  assert(await page.locator('#bulkSpaceCreateDialog').isVisible());
  await page.fill('#bulkNewSpaceName', '项目空间'); await page.locator('#bulkSpaceCreateForm [type="submit"]').click();
  assert(await page.locator('#bulkSpaceCreateDialog').isHidden());
  assert.equal(await page.locator('.bulk-space-name').last().innerText(), '项目空间');
  assert.match(await page.locator('#bulkCurrentGroup').innerText(), /项目空间/);
  assert.deepEqual(await state(), original);
  await page.click('#bulkAddGroup'); await page.click('#contextAddGroup');
  await page.fill('#groupName', '项目资料'); await page.locator('#groupForm [type="submit"]').click();
  await page.click('#bulkAddGroup'); await page.click('#contextAddSite');
  await page.fill('#siteUrl', 'https://example.org/project'); await page.locator('#siteTitle').focus(); await page.fill('#siteTitle', '项目入口');
  await page.locator('#siteForm [type="submit"]').click();
  assert.match(await page.locator('#bulkCurrentGroup').innerText(), /项目空间 \/ 项目资料/);
  assert.deepEqual(await state(), original);
  await page.setViewportSize({ width: 1360, height: 920 });
  await page.click('#bulkSave'); await page.waitForFunction(() => !document.querySelector('#bulkEditorDialog').open);
  const saved = await state();
  assert.equal(saved.spaces.length, original.spaces.length + 1);
  assert.equal(saved.active, original.active);
  assert.equal(saved.spaces.at(-1).groups.find(g => g.name === '项目资料').links[0].title, '项目入口');
  await page.reload(); await page.waitForFunction(() => !document.querySelector('.app-container').inert);
  assert.deepEqual(await state(), saved);
  await page.click('#spaceEditBtn'); await createSpace('放弃空间');
  await page.click('#bulkClose'); await page.click('#bulkDiscard'); assert.deepEqual(await state(), saved);
  await page.locator('.app-container').click({ button: 'right', position: { x: 5, y: 5 } });
  assert(await page.locator('#contextAddSpace').isHidden());
  assert(await page.locator('#contextSettings').isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS: menu inside dialog at desktop/tablet/mobile widths, space cancel/validation, draft space/group/site creation, persistence, active-space preservation, discard and homepage menu restoration.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
