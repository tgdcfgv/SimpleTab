import { t } from './i18n.js';
import { cloud } from './cloud.js';
import { syncManager } from './storage.js';
import { applySettings, render } from './render.js';
import { openSettingsModal, showToast } from './modals.js';

export function initAccountSecurity() {
  const dialog = document.getElementById('accountSecurityDialog');
  const form = document.getElementById('accountSecurityForm');
  const fields = document.getElementById('accountSecurityFields');
  const message = document.getElementById('accountSecurityMessage');
  const code = document.getElementById('securityCode');
  const submit = document.getElementById('securitySubmit');
  const cancel = document.getElementById('securityCancel');
  const send = document.getElementById('securitySendCode');
  let busy = false, timer = null, remaining = 0, userId = null;

  function open() {
    if (!cloud.session || dialog.open) return;
    userId = cloud.session.user.id;
    form.reset();
    message.textContent = '';
    message.dataset.state = '';
    document.getElementById('securityEmail').value = cloud.session.user.email;
    dialog.showModal();
    cancel.focus();
  }
  function close() { if (!busy) dialog.close(); }
  function setBusy(value) {
    busy = value;
    fields.disabled = value;
    cancel.disabled = submit.disabled = value;
    send.disabled = value || remaining > 0;
  }
  function errorMessage(error) {
    message.dataset.state = 'error';
    message.textContent = error.message || t('操作失败，请稍后重试。');
  }
  document.getElementById('accountDelete').addEventListener('click', open);
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    form.reset();
  });
  // A change in another tab must never apply an operation to a different account.
  window.addEventListener('storage', event => {
    if (dialog.open && (event.key === 'simtab.auth' || event.key === null)) {
      let next = null;
      try { next = JSON.parse(event.newValue || 'null'); } catch {}
      if (next?.user?.id !== userId) dialog.close();
    }
  });
  send.addEventListener('click', async () => {
    if (busy || remaining) return;
    setBusy(true);
    try {
      if (cloud.session?.user?.id !== userId) throw new Error(t('账户已更改，请重新打开此窗口。'));
      await cloud.sendSecurityCode();
      message.dataset.state = 'success';
      message.textContent = t('验证码已发送，请查收邮箱。请勿向他人透露验证码。');
      remaining = 60;
      send.textContent = t`${remaining} 秒后重发`;
      timer = setInterval(() => {
        remaining--;
        send.textContent = remaining ? t`${remaining} 秒后重发` : t('重新获取');
        if (!remaining) { clearInterval(timer); timer = null; send.disabled = busy; }
      }, 1000);
      code.focus();
    } catch (error) { errorMessage(error); }
    finally { setBusy(false); code.focus(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (cloud.session?.user?.id !== userId) { errorMessage(new Error(t('账户已更改，请重新打开此窗口。'))); return; }
    setBusy(true);
    message.dataset.state = '';
    message.textContent = t('正在注销账户…');
    try {
      if (syncManager.saving) await syncManager.saving;
      await cloud.deleteAccount(code.value.trim());
      await syncManager.loadLocal();
      applySettings(); render();
      openSettingsModal('settingsAccount');
      dialog.close();
      showToast(t('账户已注销，已恢复此浏览器的本地内容'));
    } catch (error) {
      errorMessage(error);
    }
    finally { setBusy(false); }
  });
}
