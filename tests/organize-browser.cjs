const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SIMTAB_TEST_URL||'http://127.0.0.1:8091/newtab.html');
  await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  const groups=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('./js/storage.js')).appData.groups)));
  const original=await groups();
  await page.click('#settingsBtn');await page.click('[data-settings-panel="settingsData"]');
  for(const browser of ['edge','chrome','safari']){
   await page.click(`[data-guide="${browser}"]`);assert.equal(await page.locator(`[data-guide="${browser}"]`).getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#migrationGuide').innerText(),/HTML/);
  }
  await page.setInputFiles('#bookmarkFile',{name:'bookmarks.html',mimeType:'text/html',buffer:Buffer.from('<DL><A HREF="https://example.org/import">迁移书签</A></DL>')});
  await page.waitForFunction(()=>document.querySelector('#bulkEditorDialog').open);
  assert.equal(await page.locator('.bulk-title-input').inputValue(),'迁移书签');assert.deepEqual(await groups(),original);
  await page.click('#bulkSave');await page.waitForFunction(()=>document.querySelector('#guideImportStatus').textContent.includes('已导入并保存'));
  assert.equal((await groups()).length,original.length+1);
  await page.click('[data-settings-panel="settingsLayout"]');await page.selectOption('#groupColumnsSelect','2',{force:true});
  await page.reload();await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.equal(await page.locator('#groupsContainer > .group-col').count(),2);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelectorAll('#groupsContainer > .group-col').length===1);
  await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>document.querySelectorAll('#groupsContainer > .group-col').length===2);
  await page.click('#spaceEditBtn');
  const activeSpace=await page.evaluate(async()=>(await import('./js/storage.js')).appData.activeSpaceId);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.activeSpaceId),activeSpace);
  const beforeImport=await groups(),fixture='<DL><DT><H3>书签栏</H3><DL><DT><H3>设计</H3><DL><DT><A HREF="https://example.org/design">设计工具</A><DT><A HREF="javascript:alert(1)">unsafe</A></DL></DL></DL>';
  const chooserReady=page.waitForEvent('filechooser');await page.click('#bulkImportBookmarks');await (await chooserReady).setFiles({name:'folders.html',mimeType:'text/html',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>document.querySelector('#bulkEditStatus').textContent.includes('folders.html'));
  assert.match(await page.locator('#bulkCurrentGroup').innerText(),/书签栏 \/ 设计/);
  assert.equal(await page.locator('.bulk-title-input').count(),1);assert.deepEqual(await groups(),beforeImport);
  await page.click('#bulkClose');assert.deepEqual(await groups(),beforeImport);
  await page.click('#settingsBtn');await page.click('[data-settings-panel="settingsData"]');assert.match(await page.locator('#guideImportStatus').innerText(),/已取消导入/);
  assert.deepEqual(errors,[]);
  console.log('PASS: browser guides, import preview/save/cancel, folder preservation, layout settings persistence, responsive columns and native-dialog keyboard focus.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
