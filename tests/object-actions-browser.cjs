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
 async function create(kind,name,url){
   await page.click('#bulkAddGroup');
   assert.equal(await page.locator('#contextMenu').count(),1);
   assert.equal(await page.locator('#bulkCreateMenu, #bulkCreateForm').count(),0);
   await page.click(kind==='site'?'#contextAddSite':'#contextAddGroup');
   await page.fill(kind==='site'?'#siteTitle':'#groupName',name);
   if(url)await page.fill('#siteUrl',url);
   await page.locator(kind==='site'?'#siteForm button[type="submit"]':'#groupForm button[type="submit"]').click();
 }
 const projectSpaceIndex=before.spaces.length-1;
 await page.check(`[data-select-space="${projectSpaceIndex}"]`);
 await create('group','项目资料');await page.uncheck(`[data-select-space="${projectSpaceIndex}"]`);
 const projectGroup=page.locator('[data-select-nav]').filter({hasText:'项目资料'});
 assert.equal(await projectGroup.count(),1);
 const projectIndex=await projectGroup.getAttribute('data-select-nav');await projectGroup.click();
 // Website creation uses the current group and rejects unsafe URLs.
 let invalidUrlRejected=false; page.once('dialog',async dialog=>{invalidUrlRejected=true;await dialog.dismiss()});
 await create('site','项目入口','javascript:alert(1)');assert.equal(await page.locator('#siteModal').isVisible(),true);assert(invalidUrlRejected);
 await page.fill('#siteUrl','https://example.org/project');await page.locator('#siteForm button[type="submit"]').click();
 assert.equal(await page.locator('.bulk-title-input').inputValue(),'项目入口');assert.equal(await page.locator('.bulk-url-input').inputValue(),'https://example.org/project');
 assert.deepEqual(await state(),before);
 // Group-level deletion and restoration include its website.
 await page.check(`[data-select-group="${projectIndex}"]`);await page.click('#bulkDelete');assert.equal(await page.locator('[data-select-nav]').filter({hasText:'项目资料'}).count(),0);
 await page.click('#bulkUndo');assert.equal(await page.locator('.bulk-title-input').inputValue(),'项目入口');
 // Deleting the destination space also restores correctly.
 await page.check(`[data-select-space="${projectSpaceIndex}"]`);await page.click('#bulkDelete');assert.equal(await page.locator('[data-select-nav]').filter({hasText:'项目资料'}).count(),0);
 await page.click('#bulkUndo');assert.equal(await page.locator('.bulk-title-input').inputValue(),'项目入口');
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'/tmp/simpletab-object-actions-dark.png',animations:'disabled'});
 await page.click('#bulkSave');await page.waitForFunction(()=>!document.querySelector('#bulkEditorDialog').open);
 const saved=await state();assert.equal(saved.spaces.length,before.spaces.length);assert.equal(saved.spaces.at(-1).groups.at(-1).links[0].url,'https://example.org/project');
 // Saving deletion of the active space chooses a valid remaining active space.
 await page.click('#spaceEditBtn');await page.check('[data-select-space="0"]');await page.click('#bulkDelete');await page.click('#bulkSave');await page.waitForFunction(()=>!document.querySelector('#bulkEditorDialog').open);
 let after=await state();assert(!after.spaces.some(s=>s.id===before.active));assert(after.spaces.some(s=>s.id===after.active));
 assert.equal(await page.evaluate(async()=>{const{appData}=await import('./js/storage.js');return appData.groups===appData.spaces.find(s=>s.id===appData.activeSpaceId).groups}),true);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('.app-container').inert);after=await state();assert(!after.spaces.some(s=>s.id===before.active));
 await page.setViewportSize({width:390,height:844});await page.click('#spaceEditBtn');await page.click('#bulkAddGroup');assert.equal(await page.locator('#contextMenu').isVisible(),true);
 await page.click('#contextAddSite');assert.equal(await page.locator('#bulkEditorDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#bulkEditorDialog').isVisible(),true);assert.equal(await page.locator('#siteModal').isVisible(),false);
 // The site's inline group creation also uses the shared form and keeps its fields.
 await page.click('#bulkAddGroup');await page.click('#contextAddSite');
 await page.fill('#siteUrl','https://example.net/nested');await page.locator('#siteTitle').focus();await page.fill('#siteTitle','嵌套创建');
 await page.click('#siteGroupSelection .new-group');await page.fill('#groupName','嵌套分组');
 await page.locator('#groupForm button[type="submit"]').click();
 assert(await page.locator('#siteModal').isVisible());assert.equal(await page.inputValue('#siteTitle'),'嵌套创建');
 await page.locator('#siteForm button[type="submit"]').click();
 assert.equal(await page.locator('.bulk-title-input').inputValue(),'嵌套创建');
 await page.click('#bulkClose');await page.click('#bulkDiscard');assert.deepEqual(await state(),after);
 // Returning to the homepage restores its complete menu and normal save behavior.
 await page.locator('.app-container').click({button:'right',position:{x:5,y:5}});
 assert(await page.locator('#contextSettings').isVisible());assert(await page.locator('#contextBulkEditor').isVisible());
 await page.click('#contextAddGroup');await page.fill('#groupName','主页新增');
 await page.locator('#groupForm button[type="submit"]').click();
 assert((await state()).spaces.find(space=>space.id===after.active).groups.some(group=>group.name==='主页新增'));
 assert.deepEqual(errors,[]);console.log('PASS: shared homepage group/site creation, parent contexts, safe URLs, typed selections, cascade deletion without double counting, undo, last-space guard, active-space fallback, persistence and mobile composer.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
