import { cloud } from './cloud.js';
import { appData, normalizeAppData, setAppData, syncManager } from './storage.js';
import { applySettings, render } from './render.js';

const dialog = document.getElementById('accountDialog');
const form = document.getElementById('accountForm');
const message = document.getElementById('accountMessage');
const loginFields = document.getElementById('accountLoginFields');
const accountDetails = document.getElementById('accountDetails');
const close = document.getElementById('accountClose');
let busy = false;
let choiceData = null;
const choice = document.getElementById('accountChoice');

function update() {
  const loggedIn = Boolean(cloud.session);
  const choosing = loggedIn && Boolean(cloud.session.needs_choice);
  const accountButton = document.getElementById('accountBtn');
  accountButton.title = loggedIn ? '我的账户' : '登录 / 注册';
  accountButton.setAttribute('aria-label', accountButton.title);
  accountButton.dataset.signedIn = String(loggedIn);
  document.getElementById('accountTitle').textContent = choosing ? '选择同步内容' : '账户与云同步';
  choice.hidden = !choosing;
  document.getElementById('accountEmailLabel').textContent = cloud.session?.user?.email || '';
  loginFields.hidden = loggedIn;
  accountDetails.hidden = !loggedIn || choosing;
  close.hidden = !syncManager.ready || choosing;
  document.getElementById('accountIntro').textContent = choosing ? '已登录。请选择使用云端内容，或将当前页面保存到云端。' : syncManager.mode === 'local'
    ? '当前使用浏览器本地内容。登录后显示账户的云端内容，本地内容会继续保留。'
    : '当前使用账户的云端内容。退出登录后恢复此浏览器的本地内容。';
  if (!busy) message.textContent = syncManager.error || '';
  document.getElementById('accountReload').hidden = !syncManager.conflict;
  document.querySelector('.app-container').inert = !syncManager.ready;
  document.getElementById('dataOverviewNote').textContent = syncManager.mode === 'local'
    ? '占比按空间、分组和网站项目总数计算，当前内容保存在此浏览器中。'
    : '占比按空间、分组和网站项目总数计算，当前内容保存在账户的云端数据库中。';
  if ((!syncManager.ready || choosing) && !dialog.open) dialog.showModal();
}

export function initAccount() {
  document.getElementById('accountBtn').addEventListener('click', () => { update(); dialog.showModal(); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (!syncManager.ready || busy || cloud.session?.needs_choice) event.preventDefault(); });
  document.addEventListener('simtab-sync', update);
  document.getElementById('accountUseCloud').addEventListener('click', () => run(() => finishChoice(false)));
  document.getElementById('accountKeepPage').addEventListener('click', () => run(() => finishChoice(true)));
  document.getElementById('accountChoiceCancel').addEventListener('click', () => run(leaveAccount));
  document.getElementById('syncStatus').addEventListener('click', () => {
    if (syncManager.conflict) { update(); dialog.showModal(); }
    else run(() => syncManager.syncNow());
  });
  document.getElementById('accountSync').addEventListener('click', () => run(async () => {
    if (!syncManager.ready) { await syncManager.loadCloud(); applySettings(); render(); }
    else await syncManager.syncNow();
  }));
  document.getElementById('accountExport').addEventListener('click', () => syncManager.exportData());
  document.getElementById('accountReload').addEventListener('click', () => run(async () => {
    if (!await askConfirm('读取云端版本', '将放弃当前页面未保存的更改。请先导出需要保留的数据。')) return;
    await syncManager.loadCloud(); applySettings(); render();
  }));
  document.getElementById('accountLogout').addEventListener('click', () => run(leaveAccount));
  document.getElementById('accountMigrate').addEventListener('click', () => run(migrateLegacy));
  document.getElementById('accountVerify').addEventListener('click', () => run(async () => {
    await preserveLocal();
    const value = document.getElementById('accountCode').value.trim();
    const email = document.getElementById('accountEmail').value.trim();
    let body;
    if (/^https:\/\//.test(value)) {
      const url = new URL(value);
      if (url.origin !== 'https://zyttspnlrdzjosnitijb.supabase.co' || url.searchParams.get('type') !== 'signup') {
        throw new Error('请粘贴本应用注册邮件中的完整验证链接。');
      }
      body = { token_hash: url.searchParams.get('token') || url.searchParams.get('token_hash'), type: 'signup' };
    } else body = { email, token: value, type: 'signup' };
    cloud.storeSession({ ...await cloud.request('/auth/v1/verify', { method: 'POST', body }), needs_choice: true });
    await enterAccount();
  }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      await preserveLocal();
      const email = document.getElementById('accountEmail').value.trim();
      const password = document.getElementById('accountPassword').value;
      if (event.submitter?.value === 'signup') {
        if (password.length < 8) throw new Error('注册密码至少需要 8 位。');
        const signedIn = await cloud.signup(email, password);
        if (!signedIn) {
          document.getElementById('accountVerification').hidden = false;
          message.textContent = '验证邮件已发送。可将邮件中的验证链接粘贴到下方完成验证，也可在邮件中验证后返回登录。';
          return;
        }
      } else await cloud.login(email, password);
      await enterAccount();
    });
  });
  window.addEventListener('beforeunload', event => {
    if (syncManager.pending || syncManager.saving) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('storage', event => {
    if (event.key !== 'simtab.auth' && event.key !== null) return;
    let next;
    try { next = JSON.parse(event.newValue || 'null'); } catch { next = null; }
    if (next?.user?.id !== cloud.session?.user?.id || Boolean(next?.needs_choice) !== Boolean(cloud.session?.needs_choice)) {
      if (syncManager.pending || syncManager.saving) {
        syncManager.generation++;
        syncManager.ready = false;
        cloud.session = null;
        update();
        message.textContent = '账户已在其他标签页更改。请先导出未保存的内容，再刷新页面。';
        form.querySelectorAll('button').forEach(button => { button.disabled = true; });
      } else {
        // Reload routes to local data after logout, or to the newly signed-in account.
        location.reload();
      }
    }
  });
  window.addEventListener('online', () => { if (syncManager.ready && !syncManager.conflict) syncManager.syncNow(); });
  window.addEventListener('focus', () => { if (syncManager.ready && !dialog.open && !syncManager.conflict) syncManager.syncNow(); });
  update();
}

async function preserveLocal() {
  if (syncManager.mode === 'local' && (syncManager.pending || syncManager.saving)) {
    if (!await syncManager.saveData()) throw new Error('本地内容尚未保存，请先导出备份或重试，再登录。');
  }
}

async function enterAccount() {
  if (syncManager.saving) await syncManager.saving;
  // Keep the page untouched until the user explicitly chooses a sync direction.
  choiceData = JSON.parse(JSON.stringify(appData));
  document.getElementById('accountPassword').value = '';
  document.getElementById('accountCode').value = '';
  message.textContent = '';
  update();
}

async function finishChoice(keepPage) {
  const snapshot = choiceData || JSON.parse(JSON.stringify(appData));
  await syncManager.loadCloud(keepPage ? snapshot : null);
  cloud.storeSession({ ...cloud.session, needs_choice: false });
  choiceData = null;
  applySettings(); render(); update(); dialog.close();
}

async function leaveAccount() {
  if (syncManager.saving) await syncManager.saving;
  if (syncManager.pending && !await askConfirm('退出账户', '还有未保存的更改，退出会丢失这些更改。是否继续？')) return;
  syncManager.pending = null;
  try { await cloud.logout(); }
  finally {
    choiceData = null;
    await syncManager.loadLocal(); applySettings(); render(); update(); dialog.close();
  }
}

function askConfirm(title, text) {
  const confirmDialog = document.getElementById('accountConfirmDialog');
  document.getElementById('accountConfirmTitle').textContent = title;
  document.getElementById('accountConfirmMessage').textContent = text;
  confirmDialog.returnValue = 'cancel';
  document.getElementById('accountConfirmCancel').onclick = () => confirmDialog.close('cancel');
  document.getElementById('accountConfirmOk').onclick = () => confirmDialog.close('confirm');
  return new Promise(resolve => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'confirm'), { once: true });
    confirmDialog.showModal();
  });
}

async function run(action) {
  if (busy) return;
  busy = true;
  const buttons = [...dialog.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  message.textContent = '处理中…';
  try { await action(); }
  catch (error) { message.textContent = error.message || '操作失败，请重试。'; }
  finally {
    busy = false;
    buttons.forEach(button => { button.disabled = false; });
    // Preserve action messages while refreshing account visibility.
    const text = message.textContent;
    update();
    message.textContent = text === '处理中…' ? (syncManager.error || '') : text;
  }
}

async function migrateLegacy() {
  if (!syncManager.ready || syncManager.pending || syncManager.saving) throw new Error('请先完成当前云端同步。');
  const legacy = await syncManager.readLocal();
  if (!legacy) throw new Error('此浏览器没有本地数据。你也可以在设置中导入 JSON 备份。');
  if (!await askConfirm('将本地内容复制到云端', '将用此浏览器本地内容替换当前账户的云端内容，本地副本仍会保留。是否继续？')) return;
  setAppData(normalizeAppData(legacy));
  if (!await syncManager.saveData()) {
    // Keep the imported content available for export/retry after a failed save.
    applySettings(); render();
    throw new Error(syncManager.error || '上传失败，旧版本地数据仍然保留。');
  }
  applySettings(); render();
  message.textContent = '本地内容已复制到云端，浏览器中的本地内容仍然保留。';
}
