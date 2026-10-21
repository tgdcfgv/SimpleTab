const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let remote = null, offline = false;
  await context.route('https://zyttspnlrdzjosnitijb.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (offline) return route.abort();
    const body = request.postDataJSON();
    const reply = (json, status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)});
    if (url.pathname.endsWith('/token')) return reply({access_token:'mock-token',refresh_token:'mock-refresh',expires_in:3600,user:{id:'00000000-0000-4000-8000-000000000001',email:'test@example.com'}});
    if (url.pathname.endsWith('/user')) return reply({id:'00000000-0000-4000-8000-000000000001',email:'test@example.com'});
    if (url.pathname.endsWith('/logout')) return reply({});
    if (url.pathname.endsWith('/account_data')) {
      if (request.method()==='GET') return reply(remote ? [remote] : []);
      if (request.method()==='POST') { if (remote) return reply({},409); remote={data:body.data,revision:1}; return reply([remote]); }
      if (request.method()==='PATCH') {
        if (url.searchParams.get('revision') !== `eq.${remote.revision}`) return reply([]);
        remote={data:body.data,revision:body.revision}; return reply([remote]);
      }
    }
    return reply({},400);
  });
  await page.goto('http://127.0.0.1:8091/newtab.html');
  await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.equal(await page.locator('#accountDialog').evaluate(el=>el.open),false);
  await page.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Local group';await s.syncManager.saveData();});
  // Rapid edits must persist the newest local snapshot, including concurrent saves.
  await page.evaluate(async()=>{
    const s=await import('./js/storage.js');
    s.appData.groups[0].name='First local edit'; const first=s.syncManager.saveData();
    s.appData.groups[0].name='Local group'; const second=s.syncManager.saveData();
    await Promise.all([first,second]);
  });
  assert.equal(remote,null);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Local group');
  await page.reload();
  await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Local group');
  await page.click('#accountBtn');
  await page.fill('#accountEmail','test@example.com'); await page.fill('#accountPassword','test-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForSelector('#accountDialog:not([open])',{state:'attached'});
  assert(remote?.data?.spaces?.length);
  assert.notEqual(remote.data.groups[0].name,'Local group');
  await page.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Cloud saved group'; await s.syncManager.saveData();});
  assert.equal(remote.data.groups[0].name,'Cloud saved group');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Local group');
  await page.reload(); await page.waitForSelector('#accountDialog:not([open])',{state:'attached'});
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Cloud saved group');
  offline=true;
  await page.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Offline group';return s.syncManager.saveData();});
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).syncManager.status),'error');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Local group');
  offline=false;
  await page.evaluate(async()=>{await (await import('./js/storage.js')).syncManager.syncNow();});
  assert.equal(remote.data.groups[0].name,'Offline group');
  remote.revision++;
  await page.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Conflict group';await s.syncManager.saveData();});
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).syncManager.conflict),true);
  assert.equal(remote.data.groups[0].name,'Offline group');
  await page.click('#accountBtn');
  assert.equal(await page.locator('#accountReload').isVisible(),true);
  page.once('dialog',dialog=>dialog.accept());
  await page.click('#accountReload');
  await page.waitForFunction(()=>document.querySelector('#accountMessage').textContent!=='处理中…');
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Offline group');
  // Local content is copied only on request, and is preserved after the copy.
  await page.evaluate(()=>{localStorage.setItem('appData',JSON.stringify({groups:[{id:'legacy',name:'Legacy group',links:[]}],settings:{}}));});
  page.once('dialog',dialog=>dialog.accept());
  await page.click('#accountMigrate');
  await page.waitForFunction(()=>document.querySelector('#accountMessage').textContent.includes('已复制'));
  assert.equal(remote.data.groups[0].name,'Legacy group');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Legacy group');
  const beforeTab = await page.evaluate(async()=>(await import('./js/storage.js')).appData.activeSpaceId);
  await page.locator('#accountClose').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.activeSpaceId),beforeTab);
  await page.screenshot({path:'/tmp/simtab-account-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/simtab-account-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await page.click('#accountLogout');
  await page.waitForFunction(()=>localStorage.getItem('simtab.auth')===null && !document.querySelector('.app-container').inert);
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Legacy group');
  assert.equal(await page.locator('#accountDialog').evaluate(el=>el.open),false);
  await page.click('#accountBtn');
  await page.screenshot({path:'/tmp/simtab-login-mobile.png'});
  // Signing back in selects cloud content, including after reload, without touching local data.
  remote.data.groups[0].name='Cloud distinct';
  await page.fill('#accountEmail','test@example.com'); await page.fill('#accountPassword','test-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForSelector('#accountDialog:not([open])',{state:'attached'});
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Cloud distinct');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Legacy group');
  // Cloud outage must not overwrite local content; explicit logout remains available.
  offline=true; await page.reload(); await page.waitForSelector('#accountDialog[open]');
  await page.click('#accountLogout');
  await page.waitForFunction(()=>localStorage.getItem('simtab.auth')===null && !document.querySelector('.app-container').inert);
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Legacy group');
  assert.deepEqual(errors,[]);
  // Extension local storage uses chrome.storage.local rather than web appData.
  const extensionContext=await browser.newContext();
  await extensionContext.addInitScript(()=>{
    window.chrome.storage={local:{
      get:async()=>({appData:JSON.parse(localStorage.getItem('mockExtension')||'null')}),
      set:async value=>localStorage.setItem('mockExtension',JSON.stringify(value.appData))
    }};
  });
  const extensionPage=await extensionContext.newPage();
  await extensionPage.goto('http://127.0.0.1:8091/newtab.html');
  await extensionPage.waitForFunction(()=>!document.querySelector('.app-container').inert);
  await extensionPage.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Extension local';await s.syncManager.saveData();});
  assert.equal(await extensionPage.evaluate(()=>localStorage.getItem('appData')),null);
  await extensionPage.reload(); await extensionPage.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.equal(await extensionPage.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Extension local');
  console.log('PASS: guest local save/reload, cloud login isolation, offline retry, revision conflict, explicit copy preserves local, logout restores local, re-login selects cloud, offline startup fallback, extension local storage, mobile width, no JS errors.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
