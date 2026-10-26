const APP_URL = process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html';
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
  async function openAccount() {
    if (await page.locator('#settingsModal').isVisible()) await page.click('#closeSettingsBtn');
    await page.click('#accountBtn');
  }
  await page.goto(APP_URL);
  await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.equal(await page.locator('#accountDialog').count(),0);
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
  assert.equal(await page.locator('#accountBtn').evaluate(el=>el.nextElementSibling.id),'settingsBtn');
  assert.equal(await page.locator('#accountBtn svg').count(),1);
  await openAccount();
  await page.fill('#accountEmail','test@example.com'); await page.fill('#accountPassword','test-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForSelector('#accountChoice:not([hidden])');
  assert.equal(remote,null);
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Local group');
  await page.reload(); await page.waitForSelector('#accountChoice:not([hidden])');
  assert.equal(remote,null);
  await page.screenshot({path:'/tmp/simtab-choice-desktop.png',animations:'disabled'});
  await page.click('#accountUseCloud');
  await page.waitForSelector('#accountDetails:not([hidden])');
  assert(remote?.data?.spaces?.length);
  assert.notEqual(remote.data.groups[0].name,'Local group');
  await page.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Cloud saved group'; await s.syncManager.saveData();});
  assert.equal(remote.data.groups[0].name,'Cloud saved group');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Local group');
  await page.reload(); await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
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
  await openAccount();
  assert.equal(await page.locator('#accountReload').isVisible(),true);
  await page.click('#accountReload');
  await page.click('#accountConfirmOk');
  await page.waitForFunction(()=>document.querySelector('#accountMessage').textContent!=='处理中…');
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Offline group');
  // Local content is copied only on request, and is preserved after the copy.
  await page.evaluate(()=>{localStorage.setItem('appData',JSON.stringify({groups:[{id:'legacy',name:'Legacy group',links:[]}],settings:{}}));});
  await page.click('#accountMigrate');
  await page.click('#accountConfirmOk');
  await page.waitForFunction(()=>document.querySelector('#accountMessage').textContent.includes('已复制'));
  assert.equal(remote.data.groups[0].name,'Legacy group');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Legacy group');
  const beforeTab = await page.evaluate(async()=>(await import('./js/storage.js')).appData.activeSpaceId);
  await page.locator('#closeSettingsBtn').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.activeSpaceId),beforeTab);
  await page.screenshot({path:'/tmp/simtab-account-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/simtab-account-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await page.click('#accountLogout');
  await page.waitForFunction(()=>localStorage.getItem('simtab.auth')===null && !document.querySelector('.app-container').inert);
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Legacy group');
  assert.equal(await page.locator('#accountDialog').count(),0);
  await openAccount();
  await page.screenshot({path:'/tmp/simtab-login-mobile.png'});
  // Signing back in selects cloud content, including after reload, without touching local data.
  remote.data.groups[0].name='Cloud distinct';
  await page.fill('#accountEmail','test@example.com'); await page.fill('#accountPassword','test-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForSelector('#accountChoice:not([hidden])');
  assert.equal(remote.data.groups[0].name,'Cloud distinct');
  await page.screenshot({path:'/tmp/simtab-choice-mobile.png',animations:'disabled'});
  // A failed choice must leave both copies untouched and allow retry.
  offline=true; await page.reload(); await page.waitForSelector('#accountChoice:not([hidden])');
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Legacy group');
  await page.click('#accountKeepPage');
  await page.waitForFunction(()=>document.querySelector('#accountKeepPage').disabled===false);
  assert.equal(remote.data.groups[0].name,'Cloud distinct');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Legacy group');
  offline=false; await page.click('#accountKeepPage');
  await page.waitForSelector('#accountDetails:not([hidden])');
  assert.equal(remote.data.groups[0].name,'Legacy group');
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Legacy group');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('appData')).groups[0].name),'Legacy group');
  // Cloud outage must not overwrite local content; explicit logout remains available.
  offline=true; await page.reload();
  await page.waitForFunction(()=>!document.querySelector('.app-container').inert);
  await openAccount();
  await page.click('#accountLogout');
  await page.waitForFunction(()=>localStorage.getItem('simtab.auth')===null && !document.querySelector('.app-container').inert);
  assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Legacy group');
  const dockButtons=await page.locator('#spaceDock').evaluate(el=>[...el.querySelectorAll('button')].map(button=>({id:button.id,rect:button.getBoundingClientRect().toJSON()})).filter(item=>item.rect.width));
  for(const button of dockButtons) assert(button.rect.x>=0 && button.rect.right<=390,`Mobile dock button is offscreen: ${button.id}`);
  for(let a=0;a<dockButtons.length;a++) for(let b=a+1;b<dockButtons.length;b++) {
    const x=dockButtons[a].rect,y=dockButtons[b].rect;
    assert(!(x.left<y.right && y.left<x.right && x.top<y.bottom && y.top<x.bottom),'Mobile dock buttons overlap');
  }
  await page.screenshot({path:'/tmp/simtab-dock-mobile.png',animations:'disabled'});
  // Cancelling after login leaves both the current page and cloud record unchanged.
  offline=false;
  const remoteBeforeCancel=JSON.stringify(remote);
  await openAccount(); await page.fill('#accountEmail','test@example.com'); await page.fill('#accountPassword','test-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForSelector('#accountChoice:not([hidden])');
  await page.click('#accountChoiceCancel');
  await page.waitForFunction(()=>localStorage.getItem('simtab.auth')===null);
  assert.equal(JSON.stringify(remote),remoteBeforeCancel);
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
  await extensionPage.goto(APP_URL);
  await extensionPage.waitForFunction(()=>!document.querySelector('.app-container').inert);
  await extensionPage.evaluate(async()=>{const s=await import('./js/storage.js');s.appData.groups[0].name='Extension local';await s.syncManager.saveData();});
  assert.equal(await extensionPage.evaluate(()=>localStorage.getItem('appData')),null);
  await extensionPage.reload(); await extensionPage.waitForFunction(()=>!document.querySelector('.app-container').inert);
  assert.equal(await extensionPage.evaluate(async()=>(await import('./js/storage.js')).appData.groups[0].name),'Extension local');
  console.log('PASS: dock avatar placement, guest storage, login direction choice, no writes before choice, choice survives reload, use cloud, keep page, failed choice retry, cancel preserves both copies, conflict and native confirmation, local/cloud isolation, logout, extension storage, mobile, no JS errors.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
