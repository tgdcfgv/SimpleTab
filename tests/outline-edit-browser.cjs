const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const context=await browser.newContext({viewport:{width:1360,height:920}});
  await context.route('https://**/*',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SIMTAB_TEST_URL||'http://127.0.0.1:8091/newtab.html');
  await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  const groups=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('./js/storage.js')).appData.groups)));
  const original=await groups();
  const nav=i=>page.locator(`[data-select-nav="${i}"]`);
  const navRow=i=>page.locator(`[data-nav-group="${i}"]`);
  const count=i=>navRow(i).locator('.bulk-group-count').innerText().then(Number);
  await page.click('#spaceEditBtn');
  assert.equal(await page.locator('#bulkGroupList [data-nav-group]').count(),original.length);
  assert.equal(await page.locator('.bulk-sidebar').evaluate(el=>el.offsetWidth),210);
  assert.equal(await page.locator('.bulk-group-select svg').count(),0);
  const homeColumns=await page.locator('#groupsContainer > .group-col').count();
  assert.equal(await page.locator('.bulk-nav-column').count(),homeColumns);
  assert.equal(await page.locator('.bulk-column-label').first().innerText(),'第一列');
  assert.equal(await page.locator('#bulkSiteList').evaluate(el=>getComputedStyle(el).display),'block');
  const homepageColumnGroups=await page.locator('#groupsContainer > .group-col').evaluateAll(cols=>cols.map(col=>[...col.querySelectorAll('.group-card')].map(card=>card.dataset.id)));
  for(let column=0;column<homeColumns;column++){
    const indices=await page.locator('.bulk-nav-column').nth(column).locator('[data-nav-group]').evaluateAll(rows=>rows.map(row=>Number(row.dataset.navGroup)));
    assert.deepEqual(indices.map(index=>original[index].id),homepageColumnGroups[column]);
  }
  assert.equal(await page.locator('#bulkDelete').getAttribute('aria-label'),'删除所选');
  assert.equal(await page.locator('#bulkDelete').innerText(),'');
  assert.equal(await page.locator('#bulkDelete svg').count(),1);
  // Icon-only folding controls stay named for keyboard and assistive technology.
  assert.equal(await page.locator('#bulkExpandAll').getAttribute('aria-label'),'全部展开');
  assert.equal(await page.locator('#bulkExpandAll').innerText(),'');
  await page.click('#bulkCollapseAll');assert.equal(await page.locator('.bulk-site-rows:visible').count(),0);
  await page.click('#bulkExpandAll');
  await nav(0).click();
  await page.locator('.bulk-title-input').first().fill('全局编辑标题');
  await page.locator('.bulk-url-input').first().fill('example.org/edited');
  await page.locator('[data-key]').nth(0).check();await page.locator('[data-key]').nth(1).check();
  await nav(1).click();assert.equal(await page.locator('.bulk-title-input').count(),original[1].links.length);
  assert.match(await page.locator('#bulkSelectionCount').innerText(),/已选 2 个/);
  await page.fill('#bulkSearch','全局编辑标题');
  assert.equal(await page.locator('.bulk-title-input').count(),1);
  assert.equal(await page.locator('.bulk-title-input').inputValue(),'全局编辑标题');
  assert.equal(await page.locator('.bulk-url-input').inputValue(),'https://example.org/edited');
  await nav(0).click();assert.equal(await page.locator('[data-key]:checked').count(),2);
  // Drag a checked site to the left: the entire selected batch moves.
  await page.locator('[data-drag-site]').first().dragTo(navRow(2));
  assert.equal(await count(2),original[2].links.length+2);
  assert.equal(await count(0),original[0].links.length-2);
  assert.match(await page.locator('#bulkEditStatus').innerText(),/已移动 2 个网站/);
  assert.deepEqual(await groups(),original);
  await page.click('#bulkDelete');assert.equal(await count(2),original[2].links.length);
  assert.equal(await page.locator('#bulkEditStatus').innerText(),'已删除 2 个网站');
  await page.click('#bulkUndo');assert.equal(await count(2),original[2].links.length+2);
  await nav(2).dblclick();const name=navRow(2).locator('[data-edit-group]');
  await name.fill('研究资料');await nav(1).click();
  assert.equal(await nav(2).locator('.bulk-nav-name').innerText(),'研究资料');
  assert.match(await page.locator('#bulkCurrentGroup').innerText(),new RegExp(original[1].name));
  // New group is inserted and focused without an extra dialog.
  await page.click('#bulkAddGroup');
  await page.click('[data-create-kind="group"]');
  await page.fill('#bulkCreateName','新建收藏');
  await page.locator('#bulkCreateForm button[type="submit"]').click();
  await page.locator(`[data-select-nav="${original.length}"]`).dblclick();
  const newName=page.locator(`[data-edit-group="${original.length}"]`);assert.equal(await newName.evaluate(el=>el===document.activeElement),true);
  await newName.fill('新建收藏');await nav(1).click();
  assert.equal(await page.locator('.bulk-title-input').first().inputValue(),original[1].links[0].title);
  // An unchecked dragged site moves alone, then sort the remaining group.
  await page.locator('[data-drag-site]').first().dragTo(navRow(original.length));
  assert.equal(await count(original.length),1);
  const first=await page.locator('.bulk-title-input').first().inputValue();
  await page.locator('[data-drag-site]').first().dragTo(page.locator('.bulk-site-row').nth(1),{targetPosition:{x:100,y:31}});
  assert.equal(await page.locator('.bulk-title-input').nth(1).inputValue(),first);
  // Group sorting does not change the active group or corrupt row edits.
  await page.locator('[data-drag-group="1"]').dragTo(navRow(0),{targetPosition:{x:70,y:2}});
  assert.equal(await nav(0).locator('.bulk-nav-name').innerText(),original[1].name);
  assert.match(await page.locator('#bulkCurrentGroup').innerText(),new RegExp(original[1].name));
  await page.locator('[data-drag-site]').first().focus();await page.keyboard.press('Alt+ArrowDown');
  await page.locator('.bulk-url-input').first().fill('javascript:alert(1)');
  await nav(1).click();await page.click('#bulkSave');
  assert.match(await page.locator('#bulkEditStatus').innerText(),/网址无效/);
  assert.equal(await page.locator('[aria-invalid="true"]').count(),1);
  assert.equal(await page.locator('[aria-invalid="true"]').evaluate(el=>el===document.activeElement),true);
  await page.locator('[aria-invalid="true"]').fill('https://example.org/valid');
  await page.locator('#bulkSearch').focus();assert.deepEqual(await groups(),original);
  for(const theme of ['light','dark']){
   await page.emulateMedia({colorScheme:theme});await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
   await page.waitForTimeout(150);await page.screenshot({path:`/tmp/simtab-master-${theme}.png`,animations:'disabled'});
   for(const id of ['bulkDelete','bulkMove']) assert.equal(await page.locator(`#${id}`).evaluate(el=>getComputedStyle(el).opacity),'1');
  }
  await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  for(const width of [390,640,768]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.locator('#bulkEditorDialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,`overflow ${width}`);
   assert.equal(await page.locator('.bulk-master-detail').evaluate(el=>getComputedStyle(el).flexDirection),width<=640?'column':'row');
  }
  await page.evaluate(async()=>{ const {syncManager}=await import('./js/storage.js');window.actualSave=syncManager.saveData.bind(syncManager);syncManager.saveData=async()=>false; });
  await page.click('#bulkSave');
  await page.waitForFunction(()=>document.querySelector('#bulkEditStatus').textContent.includes('保存失败'));
  assert.equal(await page.locator('#bulkSave').isEnabled(),true);
  const appliedSnapshot=await groups();
  await page.locator('.bulk-title-input').first().fill('重试保存');
  assert.deepEqual(await groups(),appliedSnapshot);
  await page.evaluate(async()=>{(await import('./js/storage.js')).syncManager.saveData=window.actualSave;});
  await page.click('#bulkSave');await page.waitForFunction(()=>!document.querySelector('#bulkEditorDialog').open);
  const after=await groups();assert.equal(after.length,original.length+1);assert.equal(after[0].name,original[1].name);
  assert.equal(after[2].name,'研究资料');assert(after[2].links.some(l=>l.title==='全局编辑标题'&&l.url==='https://example.org/edited'));
  await page.reload();await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.deepEqual(await groups(),after);assert.deepEqual(errors,[]);
  console.log('PASS: master-detail, global search, preserved edits/selections, multi-site navigation drop, undo, inline group rename/new group, native sorting, URL validation, persistence, icon tools, light/dark and mobile.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
