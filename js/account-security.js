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
  const password = document.getElementById('securityPassword');
  const confirm = document.getElementById('securityPasswordConfirm');
  const submit = document.getElementById('securitySubmit');
  const cancel = document.getElementById('securityCancel');
  const send = document.getElementById('securitySendCode');
  let deleting = false, busy = false, timer = null, remaining = 0, userId = null;

  function open(remove) {
    if (!cloud.session || dialog.open) return;
    deleting = remove;
    userId = cloud.session.user.id;
    form.reset();
    message.textContent = '';
    message.dataset.state = '';
    confirm.setCustomValidity('');
    document.getElementById('securityEmail').value = cloud.session.user.email;
    document.getElementById('accountSecurityTitle').textContent = remove ? '注销账户' : '修改密码';
    document.getElementById('accountSecurityDescription').textContent = remove
      ? '注销后，账户、个人资料及云端的快捷方式和设置将永久删除，无法恢复。此浏览器原有的本地内容会保留。如需保留云端内容，请先到「数据」导出备份。验证邮箱后确认注销。'
      : '为保障账户安全，请先验证邮箱，再设置新密码。尚未设置过密码的账户也可使用此功能。';
    document.getElementById('securityPasswordFields').hidden = remove;
    password.disabled = confirm.disabled = remove;
    submit.textContent = remove ? '永久注销账户' : '保存新密码';
    submit.className = `btn ${remove ? 'danger' : 'primary'}`;
    dialog.showModal();
    (remove ? cancel : code).focus();
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
    message.textContent = error.message || '操作失败，请稍后重试。';
  }
  document.getElementById('accountChangePassword').addEventListener('click', () => open(false));
  document.getElementById('accountDelete').addEventListener('click', () => open(true));
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    form.reset();
    confirm.setCustomValidity('');
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
      if (cloud.session?.user?.id !== userId) throw new Error('账户已更改，请重新打开此窗口。');
      await cloud.sendSecurityCode();
      message.dataset.state = 'success';
      message.textContent = '验证码已发送，请查收邮箱。请勿向他人透露验证码。';
      remaining = 60;
      send.textContent = `${remaining} 秒后重发`;
      timer = setInterval(() => {
        remaining--;
        send.textContent = remaining ? `${remaining} 秒后重发` : '重新获取';
        if (!remaining) { clearInterval(timer); timer = null; send.disabled = busy; }
      }, 1000);
      code.focus();
    } catch (error) { errorMessage(error); }
    finally { setBusy(false); code.focus(); }
  });
  for (const input of [password, confirm]) input.addEventListener('input', () => confirm.setCustomValidity(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!deleting && password.value !== confirm.value) {
      confirm.setCustomValidity('两次输入的密码不一致。');
      confirm.reportValidity();
      return;
    }
    if (cloud.session?.user?.id !== userId) { errorMessage(new Error('账户已更改，请重新打开此窗口。')); return; }
    setBusy(true);
    message.dataset.state = '';
    message.textContent = deleting ? '正在注销账户…' : '正在保存新密码…';
    try {
      if (deleting) {
        if (syncManager.saving) await syncManager.saving;
        await cloud.deleteAccount(code.value.trim());
        await syncManager.loadLocal();
        applySettings(); render();
        openSettingsModal('settingsAccount');
      } else {
        await cloud.changePassword(password.value, code.value.trim());
      }
      dialog.close();
      showToast(deleting ? '账户已注销，已恢复此浏览器的本地内容' : '密码已修改');
    } catch (error) {
      if (error.codeUsed) code.value = '';
      errorMessage(error);
    }
    finally { setBusy(false); }
  });
}
