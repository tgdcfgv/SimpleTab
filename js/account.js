import { openSettingsModal, settingsModal, openAuthModal, showToast } from './modals.js';
import { initAuthModal } from './auth-modal.js';
import { initOnboarding } from './onboarding.js';
import { cloud } from './cloud.js';
import { appData, normalizeAppData, setAppData, syncManager } from './storage.js';
import { applySettings, render } from './render.js';

const panel = document.getElementById('accountPanel');
const form = document.getElementById('accountForm');
const message = document.getElementById('accountMessage');
const loginFields = document.getElementById('accountLoginFields');
const loggedOutCard = document.getElementById('accountLoggedOutCard');
const accountDetails = document.getElementById('accountDetails');
let busy = false;
let choiceData = null;
const choice = document.getElementById('accountChoice');

function update() {
  const loggedIn = Boolean(cloud.session);
  const choosing = loggedIn && Boolean(cloud.session?.needs_choice);
  const accountButton = document.getElementById('accountBtn');
  accountButton.title = loggedIn ? '账户与同步' : '登录或创建账户';
  accountButton.setAttribute('aria-label', accountButton.title);
  accountButton.dataset.signedIn = String(loggedIn);
  const profile = cloud.session?.user?.user_metadata;
  const avatar = loggedIn && typeof profile?.avatar_emoji === 'string' ? profile.avatar_emoji : '';
  let dockAvatar = accountButton.querySelector('.dock-avatar');
  if (!dockAvatar) {
    dockAvatar = document.createElement('span');
    dockAvatar.className = 'dock-avatar';
    dockAvatar.setAttribute('aria-hidden', 'true');
    accountButton.appendChild(dockAvatar);
  }
  dockAvatar.textContent = avatar;
  dockAvatar.hidden = !avatar;
  accountButton.querySelector('svg').style.display = avatar ? 'none' : '';
  const accountAvatar = document.getElementById('accountAvatar');
  accountAvatar.textContent = avatar || '😊';
  const secondaryEmail = document.getElementById('accountEmailSecondary');
  secondaryEmail.textContent = cloud.session?.user?.email || '';
  secondaryEmail.hidden = !profile?.nickname;
  if (profile?.nickname) {
    accountButton.title = `${profile.nickname} · 账户与同步`;
    accountButton.setAttribute('aria-label', accountButton.title);
  }
  document.getElementById('accountTitle').textContent = choosing ? '选择同步内容' : '账户与同步';
  if (choice) choice.hidden = !choosing;
  document.getElementById('accountEmailLabel').textContent = profile?.nickname || cloud.session?.user?.email || '';
  if (loggedOutCard) loggedOutCard.hidden = loggedIn || choosing;
  if (loginFields) loginFields.hidden = loggedIn || choosing;
  if (accountDetails) accountDetails.hidden = !loggedIn || choosing;
  const locked = !syncManager.ready || choosing;
  settingsModal.dataset.locked = String(locked || busy);
  document.getElementById('closeSettingsBtn').disabled = locked || busy;
  document.querySelectorAll('.settings-nav-btn').forEach(button => {
    button.disabled = locked && button.dataset.settingsPanel !== 'settingsData';
  });
  document.getElementById('importFileNew').disabled = locked;
  document.getElementById('bookmarkFile').disabled = locked;
  const status = document.getElementById('accountSyncStatus');
  const source = document.getElementById('syncStatus');
  if (status && source) {
    status.querySelector('.status-dot').className = source.querySelector('.status-dot').className;
    const textEl = status.querySelector('.status-text');
    if (textEl) {
      if (syncManager.status === 'saved') {
        textEl.textContent = '已同步';
      } else if (syncManager.status === 'syncing') {
        textEl.textContent = '正在同步…';
      } else {
        textEl.textContent = source.querySelector('.status-text').textContent || '已同步';
      }
    }
  }
  const intro = document.getElementById('accountIntro');
  if (intro) {
    intro.textContent = choosing ? '已登录。请选择使用云端内容，或将当前页面保存到云端。' : syncManager.mode === 'local'
      ? '快捷方式、布局和偏好设置可以在你的设备之间同步。'
      : '当前使用账户的云端内容。退出登录后恢复此浏览器的本地内容。';
  }
  if (!busy) message.textContent = syncManager.error || '';
  const reloadBtn = document.getElementById('accountReload');
  if (reloadBtn) reloadBtn.hidden = !syncManager.conflict;
  document.querySelector('.app-container').inert = !syncManager.ready;
  if (locked && syncManager.status !== 'syncing' && !document.getElementById('onboardingDialog').open && document.getElementById('authModal').classList.contains('hidden') && (settingsModal.classList.contains('hidden') || !document.getElementById('settingsData').classList.contains('active'))) openSettingsModal('settingsData');
}

export function initAccount() {
  initAuthModal();
  initOnboarding();
  document.getElementById('accountBtn').addEventListener('click', () => {
    if (!cloud.session) {
      openAuthModal();
    } else {
      update();
      openSettingsModal('settingsData');
    }
  });
  document.getElementById('openAuthModalBtn')?.addEventListener('click', () => {
    openAuthModal();
  });
  document.addEventListener('simtab-sync', update);
  document.getElementById('accountUseCloud')?.addEventListener('click', () => run(() => finishChoice(false)));
  document.getElementById('accountKeepPage')?.addEventListener('click', () => run(() => finishChoice(true)));
  document.getElementById('accountChoiceCancel')?.addEventListener('click', () => run(leaveAccount));
  document.getElementById('syncStatus').addEventListener('click', () => {
    if (!cloud.session) {
      openAuthModal();
    } else if (syncManager.conflict) {
      update();
      openSettingsModal('settingsData');
    } else {
      run(() => syncManager.syncNow());
    }
  });
  document.getElementById('accountSync').addEventListener('click', () => run(async () => {
    if (!syncManager.ready) { await syncManager.loadCloud(); applySettings(); render(); }
    else await syncManager.syncNow();
  }));
  document.getElementById('accountReload')?.addEventListener('click', () => run(async () => {
    if (!await askConfirm('读取云端版本', '将放弃当前页面未保存的更改。请先导出需要保留的数据。')) return;
    await syncManager.loadCloud(); applySettings(); render();
  }));
  document.getElementById('accountLogout').addEventListener('click', () => run(leaveAccount));
  document.getElementById('accountMigrate')?.addEventListener('click', () => run(migrateLegacy));
  document.getElementById('accountVerify')?.addEventListener('click', () => run(async () => {
    await preserveLocal();
    const value = document.getElementById('accountCode')?.value?.trim() || '';
    const email = document.getElementById('accountEmail')?.value?.trim() || '';
    let body;
    if (/^https:\/\//.test(value)) {
      const url = new URL(value);
      body = { token_hash: url.searchParams.get('token') || url.searchParams.get('token_hash'), type: url.searchParams.get('type') || 'signup' };
    } else body = { email, token: value, type: 'signup' };
    cloud.storeSession({ ...await cloud.request('/auth/v1/verify', { method: 'POST', body }), needs_choice: false });
    await enterAccount();
  }));
  form?.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      await preserveLocal();
      const email = document.getElementById('accountEmail').value.trim();
      const password = document.getElementById('accountPassword').value;
      if (event.submitter?.value === 'signup') {
        if (password.length < 8) throw new Error('注册密码至少需要 8 位。');
        const signedIn = await cloud.signup(email, password);
        if (!signedIn) {
          const verifySection = document.getElementById('accountVerification');
          if (verifySection) verifySection.hidden = false;
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
        form?.querySelectorAll('button').forEach(button => { button.disabled = true; });
      } else {
        // Reload routes to local data after logout, or to the newly signed-in account.
        location.reload();
      }
    }
  });
  window.addEventListener('online', () => { if (syncManager.ready && !syncManager.conflict) syncManager.syncNow(); });
  window.addEventListener('focus', () => { if (syncManager.ready && settingsModal.classList.contains('hidden') && !syncManager.conflict) syncManager.syncNow(); });
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
  const pwInput = document.getElementById('accountPassword');
  if (pwInput) pwInput.value = '';
  const codeInput = document.getElementById('accountCode');
  if (codeInput) codeInput.value = '';
  message.textContent = '';
  update();
}

async function finishChoice(keepPage) {
  const snapshot = choiceData || JSON.parse(JSON.stringify(appData));
  await syncManager.loadCloud(keepPage ? snapshot : null);
  cloud.storeSession({ ...cloud.session, needs_choice: false });
  choiceData = null;
  applySettings(); render(); update(); openSettingsModal('settingsData');
}

async function leaveAccount() {
  if (syncManager.saving) await syncManager.saving;
  if (syncManager.pending && !await askConfirm('退出登录', '还有未保存的更改，退出会丢失这些更改。是否继续？')) return;
  syncManager.pending = null;
  try { await cloud.logout(); }
  finally {
    choiceData = null;
    await syncManager.loadLocal(); applySettings(); render(); update(); openSettingsModal('settingsData');
    showToast('已退出登录');
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
  settingsModal.dataset.locked = 'true';
  document.getElementById('closeSettingsBtn').disabled = true;
  const buttons = [...panel.querySelectorAll('button')];
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
