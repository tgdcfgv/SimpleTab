const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1360,height:920}});await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.goto(process.env.SIMTAB_TEST_URL||'http://127.0.0.1:8091/newtab.html');await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
 const state=()=>page.evaluate(async()=>{const{appData}=await import('./js/storage.js');return JSON.parse(JSON.stringify({spaces:appData.spaces,active:appData.activeSpaceId}))});
 const before=await state();await page.click('#spaceEditBtn');await page.check('#bulkShowEmptySpaces');
 assert.equal(await page.locator('.bulk-space-section').count(),before.spaces.length);
 // Parent and child selection is deduplicated; undo preserves the full hierarchy.
 await page.check('[data-select-space="0"]');await page.check('[data-select-group="0"]');await page.locator('[data-key]').first().check();
 await page.click('#bulkDelete');assert.equal(await page.locator('.bulk-space-section').count(),before.spaces.length-1);
 assert.match(await page.locator('#bulkEditStatus').innerText(),/1 个空间、5 个分组、17 个网站/);
 await page.click('#bulkUndo');assert.equal(await page.locator('.bulk-space-section').count(),before.spaces.length);assert.deepEqual(await state(),before);
 // At least one space must remain to keep the application data valid.
 for(const checkbox of await page.locator('[data-select-space]').all())await checkbox.check();
 await page.click('#bulkDelete');assert.match(await page.locator('#bulkEditStatus').innerText(),/至少保留一个空间/);
 for(const checkbox of await page.locator('[data-select-space]').all())await checkbox.uncheck();
 async function create(kind,name,url){await page.click('#bulkAddGroup');await page.click(`[data-create-kind="${kind}"]`);await page.fill('#bulkCreateName',name);if(url)await page.fill('#bulkCreateUrl',url);await page.locator('#bulkCreateForm button[type="submit"]').click();}
 await create('space','项目空间');assert.equal(await page.locator('.bulk-space-section').count(),before.spaces.length+1);
 await page.check(`[data-select-space="${before.spaces.length}"]`);
 await create('group','项目资料');await page.uncheck(`[data-select-space="${before.spaces.length}"]`);
 const projectGroup=page.locator('[data-select-nav]').filter({hasText:'项目资料'});
 assert.equal(await projectGroup.count(),1);
 const projectIndex=await projectGroup.getAttribute('data-select-nav');
 // Website creation uses the current group and rejects unsafe URLs.
 await create('site','项目入口','javascript:alert(1)');assert.equal(await page.locator('#bulkCreateForm').isVisible(),true);
 assert.equal(await page.locator('#bulkCreateUrl').evaluate(el=>el.validity.customError),true);
 await page.fill('#bulkCreateUrl','example.org/project');await page.locator('#bulkCreateForm button[type="submit"]').click();
 assert.equal(await page.locator('.bulk-title-input').inputValue(),'项目入口');assert.equal(await page.locator('.bulk-url-input').inputValue(),'https://example.org/project');
 assert.deepEqual(await state(),before);
 // Group-level deletion and restoration include its website.
 await page.check(`[data-select-group="${projectIndex}"]`);await page.click('#bulkDelete');assert.equal(await page.locator('[data-select-nav]').filter({hasText:'项目资料'}).count(),0);
 await page.click('#bulkUndo');assert.equal(await page.locator('.bulk-title-input').inputValue(),'项目入口');
 // Deleting a newly created space also restores correctly.
 await page.check(`[data-select-space="${before.spaces.length}"]`);await page.click('#bulkDelete');assert.equal(await page.locator('[data-select-nav]').filter({hasText:'项目资料'}).count(),0);
 await page.click('#bulkUndo');assert.equal(await page.locator('.bulk-title-input').inputValue(),'项目入口');
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'/tmp/simpletab-object-actions-dark.png',animations:'disabled'});
 await page.click('#bulkSave');await page.waitForFunction(()=>!document.querySelector('#bulkEditorDialog').open);
 const saved=await state();assert.equal(saved.spaces.length,before.spaces.length+1);assert.equal(saved.spaces.at(-1).groups[0].links[0].url,'https://example.org/project');
 // Saving deletion of the active space chooses a valid remaining active space.
 await page.click('#spaceEditBtn');await page.check('[data-select-space="0"]');await page.click('#bulkDelete');await page.click('#bulkSave');await page.waitForFunction(()=>!document.querySelector('#bulkEditorDialog').open);
 let after=await state();assert(!after.spaces.some(s=>s.id===before.active));assert(after.spaces.some(s=>s.id===after.active));
 assert.equal(await page.evaluate(async()=>{const{appData}=await import('./js/storage.js');return appData.groups===appData.spaces.find(s=>s.id===appData.activeSpaceId).groups}),true);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('.app-container').inert);after=await state();assert(!after.spaces.some(s=>s.id===before.active));
 await page.setViewportSize({width:390,height:844});await page.click('#spaceEditBtn');await page.click('#bulkAddGroup');assert.equal(await page.locator('#bulkCreateMenu').isVisible(),true);
 await page.click('[data-create-kind="site"]');assert.equal(await page.locator('#bulkEditorDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#bulkEditorDialog').isVisible(),true);assert.equal(await page.locator('#bulkCreateForm').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: create space/group/site, parent contexts, safe URLs, typed selections, cascade deletion without double counting, undo, last-space guard, active-space fallback, persistence and mobile composer.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
