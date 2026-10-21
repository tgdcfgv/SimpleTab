import { cloud } from './cloud.js';
import { syncManager } from './storage.js';
import { applySettings, render } from './render.js';

let toastTimer = null;
let resendTimer = null;
let currentEmail = '';
let currentStep = 'email'; // 'email' | 'verification'
let isSubmitting = false;


export function showToast(message, duration = 3000) {
  let toast = document.getElementById('simtabToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'simtabToast';
    toast.className = 'simtab-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove('toast-exit');
  toast.classList.add('toast-enter');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove('toast-exit');
    }, 250);
  }, duration);
}

export function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name.charAt(0)}***@${domain}`;
  }
  const prefix = name.slice(0, 2);
  return `${prefix}***@${domain}`;
}

export function checkIfNewUser(user) {
  if (!user) return false;
  if (!user.last_sign_in_at || user.last_sign_in_at === user.created_at) return true;
  const createdAtTime = new Date(user.created_at).getTime();
  if (Date.now() - createdAtTime < 60000) return true;
  return false;
}

export function openAuthModal(initialEmail = '') {
  const modalOverlay = document.getElementById('modalOverlay');
  const authModal = document.getElementById('authModal');
  if (!modalOverlay || !authModal) return;

  const emailInput = document.getElementById('authEmailInput');
  if (initialEmail && emailInput) {
    emailInput.value = initialEmail;
  }

  // 默认进入 email 步骤
  switchStep('email');

  modalOverlay.classList.remove('hidden');
  authModal.classList.remove('hidden');

  setTimeout(() => {
    if (currentStep === 'email' && emailInput) {
      emailInput.focus();
      emailInput.select();
    }
  }, 50);
}

export function closeAuthModal(force = false) {
  if (isSubmitting && !force) return;
  const authModal = document.getElementById('authModal');
  if (!authModal || authModal.classList.contains('hidden')) return;

  authModal.classList.add('hidden');
  if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
  const anyOtherModalOpen = [...document.querySelectorAll('#modalOverlay .modal')]
    .some(modal => modal.id !== 'authModal' && !modal.classList.contains('hidden'));
  if (!anyOtherModalOpen) {
    document.getElementById('modalOverlay')?.classList.add('hidden');
  }

  clearErrors();
}

function switchStep(step) {
  currentStep = step;
  const stepEmail = document.getElementById('authStepEmail');
  const stepVerify = document.getElementById('authStepVerify');
  const backBtn = document.getElementById('authBackBtn');
  const emailInput = document.getElementById('authEmailInput');
  const maskedEmail = document.getElementById('authMaskedEmail');
  const manualInput = document.getElementById('authManualInput');

  clearErrors();

  if (step === 'email') {
    if (stepEmail) stepEmail.hidden = false;
    if (stepVerify) stepVerify.hidden = true;
    if (backBtn) backBtn.hidden = true;
    if (emailInput) {
      setTimeout(() => {
        emailInput.focus();
      }, 50);
    }
  } else if (step === 'verification') {
    if (stepEmail) stepEmail.hidden = true;
    if (stepVerify) stepVerify.hidden = false;
    if (backBtn) backBtn.hidden = false;
    if (maskedEmail) maskedEmail.textContent = maskEmail(currentEmail);
    if (manualInput) {
      manualInput.value = '';
      setTimeout(() => manualInput.focus(), 50);
    }

    startResendCountdown(60);
  }
}

function clearErrors() {
  const emailError = document.getElementById('authEmailError');
  const verifyError = document.getElementById('authVerifyError');
  if (emailError) {
    emailError.textContent = '';
    emailError.hidden = true;
  }
  if (verifyError) {
    verifyError.textContent = '';
    verifyError.hidden = true;
  }
}

function showEmailError(msg) {
  const emailError = document.getElementById('authEmailError');
  if (emailError) {
    emailError.textContent = msg;
    emailError.hidden = false;
  }
}

function showVerifyError(msg) {
  const verifyError = document.getElementById('authVerifyError');
  if (verifyError) {
    verifyError.textContent = msg;
    verifyError.hidden = false;
  }
}

function startResendCountdown(seconds = 60) {
  const resendBtn = document.getElementById('authResendBtn');
  if (!resendBtn) return;

  if (resendTimer) clearInterval(resendTimer);
  let remaining = seconds;
  resendBtn.disabled = true;
  resendBtn.textContent = `重新发送 (${remaining}s)`;

  resendTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;
      resendBtn.disabled = false;
      resendBtn.textContent = '重新发送';
    } else {
      resendBtn.textContent = `重新发送 (${remaining}s)`;
    }
  }, 1000);
}

async function handleEmailSubmit(event) {
  if (event) event.preventDefault();
  if (isSubmitting) return;

  clearErrors();
  const emailInput = document.getElementById('authEmailInput');
  const submitBtn = document.getElementById('authEmailSubmitBtn');
  const email = emailInput?.value.trim().toLowerCase() || '';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showEmailError('请输入有效的邮箱地址');
    emailInput?.focus();
    return;
  }

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '正在发送…';
  }

  try {
    await cloud.sendOtp(email);
    currentEmail = email;
    switchStep('verification');
  } catch (error) {
    showEmailError(error.message || '连接失败，请稍后重试');
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '发送验证码';
    }
  }
}

async function onLoginSuccess(session) {
  const isNewUser = checkIfNewUser(session?.user);
  isSubmitting = false;
  closeAuthModal(true);

  if (isNewUser) {
    showToast('账户已创建，Sim Tab 同步已开启');
  } else {
    showToast('登录成功');
  }

  if (syncManager) {
    try {
      await syncManager.loadCloud();
      applySettings();
      render();
    } catch (err) {
      syncManager.error = err.message || '登录成功，但读取云端内容失败，请重试。';
      syncManager.status = 'error';
      syncManager.updateStatusUI();
    }
  }
  document.dispatchEvent(new Event('simtab-sync'));
}

async function handleManualVerify(event) {
  if (event) event.preventDefault();
  if (isSubmitting) return;

  clearErrors();
  const manualInput = document.getElementById('authManualInput');
  const submitBtn = document.getElementById('authVerifySubmitBtn');
  const val = manualInput?.value.trim() || '';

  if (!/^\d{6,10}$/.test(val)) {
    showVerifyError('请输入邮件中的 6 至 10 位数字验证码');
    manualInput?.focus();
    return;
  }

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '正在验证…';
  }

  try {
    const session = await cloud.verifyOtp({ email: currentEmail, token: val, type: 'email' });

    await onLoginSuccess(session);
  } catch (error) {
    showVerifyError(error.message || '验证失败，请确认验证码有效');
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '验证并登录';
    }
  }
}

export function initAuthModal() {
  const authModal = document.getElementById('authModal');
  if (!authModal) return;

  if (cloud.authError) {
    openAuthModal();
    showEmailError(cloud.authError);
    cloud.authError = '';
  }

  const emailForm = document.getElementById('authEmailForm');
  const emailInput = document.getElementById('authEmailInput');
  const manualInput = document.getElementById('authManualInput');
  const backBtn = document.getElementById('authBackBtn');
  const closeBtn = document.getElementById('closeAuthBtn');
  const resendBtn = document.getElementById('authResendBtn');
  const changeEmailBtn = document.getElementById('authChangeEmailBtn');
  const termsLink = document.getElementById('authTermsLink');

  // 第一步表单提交
  emailForm?.addEventListener('submit', handleEmailSubmit);
  emailInput?.addEventListener('input', () => {
    clearErrors();
  });

  // 手动验证表单提交
  document.getElementById('authVerifyForm')?.addEventListener('submit', handleManualVerify);
  manualInput?.addEventListener('input', () => {
    clearErrors();
  });

  // 返回按钮
  backBtn?.addEventListener('click', () => {
    if (isSubmitting) return;
    switchStep('email');
  });

  // 更换邮箱
  changeEmailBtn?.addEventListener('click', () => {
    if (isSubmitting) return;
    switchStep('email');
  });

  // 重新发送
  resendBtn?.addEventListener('click', async () => {
    if (isSubmitting || resendBtn.disabled) return;
    clearErrors();
    isSubmitting = true;
    resendBtn.disabled = true;
    resendBtn.textContent = '正在发送…';
    try {
      await cloud.sendOtp(currentEmail);
      startResendCountdown(60);
      showToast('验证码已重新发送');
    } catch (err) {
      showVerifyError(err.message || '操作过于频繁，请稍后再试');
      resendBtn.disabled = false;
      resendBtn.textContent = '重新发送';
    } finally {
      isSubmitting = false;
    }
  });

  // 关闭按钮
  closeBtn?.addEventListener('click', () => {
    closeAuthModal();
  });

  // 服务条款点击
  termsLink?.addEventListener('click', e => {
    e.preventDefault();
    showToast('Sim Tab 致力于保护你的数据安全与隐私');
  });

  // ESC 键关闭
  authModal.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAuthModal();
    }
  });
}
