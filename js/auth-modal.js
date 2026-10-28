import { cloud } from './cloud.js';
import { needsProfile, openOnboarding } from './onboarding.js';
import { syncManager } from './storage.js';
import { applySettings, render } from './render.js';

let toastTimer = null;
let resendTimer = null;
let currentEmail = '';
let currentStep = 'email'; // 'email' | 'verification'
let isSubmitting = false;


export function showToast(message, duration = 3000, { host = document.body, action } = {}) {
  let toast = document.getElementById('simtabToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'simtabToast';
    toast.className = 'simtab-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }
  if (toast.matches(':popover-open')) toast.hidePopover();
  host.appendChild(toast);
  const revision = Symbol();
  toast.revision = revision;
  toast.replaceChildren(document.createTextNode(message));
  toast.classList.toggle('has-action', Boolean(action));
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    if (action.id) button.id = action.id;
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    toast.appendChild(button);
  }
  toast.hidden = false;
  toast.classList.remove('toast-exit');
  toast.classList.add('toast-enter');
  // Keep the shared toast visible and interactive above native modal dialogs.
  if (typeof toast.showPopover === 'function') {
    toast.setAttribute('popover', 'manual');
    toast.showPopover();
  }
  const dismiss = () => {
    if (toast.revision !== revision) return;
    clearTimeout(toastTimer);
    if (toast.contains(document.activeElement)) host.querySelector('#bulkSearch')?.focus();
    toast.hidden = true;
    if (toast.matches(':popover-open')) toast.hidePopover();
    toast.classList.remove('toast-enter', 'toast-exit');
  };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toast.revision !== revision) return;
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(dismiss, 250);
  }, duration);
  return dismiss;
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

export function updateOtpDisplay() {
  const container = document.getElementById('authOtpContainer');
  const manualInput = document.getElementById('authManualInput');
  if (!container || !manualInput) return;

  const slots = container.querySelectorAll('.auth-otp-slot');
  const val = manualInput.value || '';
  const isFocused = document.activeElement === manualInput;
  const selStart = manualInput.selectionStart ?? val.length;
  const selEnd = manualInput.selectionEnd ?? val.length;
  const hasSelection = selStart !== selEnd;

  let activeIndex = -1;
  if (isFocused) {
    if (hasSelection) {
      activeIndex = selStart;
    } else if (val.length < 8) {
      activeIndex = Math.min(selStart, val.length);
    } else {
      activeIndex = Math.min(Math.max(0, selStart > 0 ? selStart - 1 : 0), 7);
    }
  }

  slots.forEach((slot, idx) => {
    const char = val[idx] || '';
    slot.textContent = char;
    slot.classList.toggle('is-filled', !!char);
    const isActive = isFocused && idx === activeIndex;
    slot.classList.toggle('is-active', isActive);

    if (isFocused && !hasSelection && idx === activeIndex && (!char || selStart === idx)) {
      const caret = document.createElement('span');
      caret.className = 'auth-otp-caret';
      caret.setAttribute('aria-hidden', 'true');
      slot.appendChild(caret);
    }
  });
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
      updateOtpDisplay();
      setTimeout(() => {
        manualInput.focus();
        updateOtpDisplay();
      }, 50);
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
  const container = document.getElementById('authOtpContainer');
  if (container) {
    container.classList.remove('has-error');
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
  const container = document.getElementById('authOtpContainer');
  if (container) {
    container.classList.remove('has-error');
    void container.offsetWidth;
    container.classList.add('has-error');
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

  if (needsProfile()) {
    openOnboarding();
  } else if (isNewUser) {
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
      await syncManager.useLocalAfterCloudFailure(err);
      applySettings();
      render();
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
    showVerifyError('请输入邮件中的 8 位数字验证码');
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

function initOtpInput() {
  const container = document.getElementById('authOtpContainer');
  const manualInput = document.getElementById('authManualInput');
  if (!container || !manualInput) return;

  manualInput.addEventListener('input', () => {
    const raw = manualInput.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (raw !== digits) {
      manualInput.value = digits;
    }
    clearErrors();
    updateOtpDisplay();
  });

  manualInput.addEventListener('focus', () => {
    updateOtpDisplay();
  });

  manualInput.addEventListener('blur', () => {
    updateOtpDisplay();
  });

  manualInput.addEventListener('keyup', () => {
    updateOtpDisplay();
  });

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === manualInput) {
      updateOtpDisplay();
    }
  });

  manualInput.addEventListener('keydown', e => {
    if (e.key >= '0' && e.key <= '9') {
      const start = manualInput.selectionStart;
      const end = manualInput.selectionEnd;
      const val = manualInput.value;
      if (start === end && start < val.length) {
        e.preventDefault();
        manualInput.value = val.slice(0, start) + e.key + val.slice(start + 1);
        const nextPos = Math.min(start + 1, 8);
        manualInput.setSelectionRange(nextPos, nextPos);
        clearErrors();
        updateOtpDisplay();
      }
    }
  });

  manualInput.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits) {
      manualInput.value = digits;
      manualInput.setSelectionRange(digits.length, digits.length);
      clearErrors();
      updateOtpDisplay();
    }
  });

  container.addEventListener('click', e => {
    const slots = container.querySelectorAll('.auth-otp-slot');
    const val = manualInput.value || '';
    let targetIndex = -1;

    for (let i = 0; i < slots.length; i++) {
      const rect = slots[i].getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        targetIndex = i;
        break;
      }
    }

    manualInput.focus();
    if (targetIndex !== -1) {
      if (targetIndex < val.length) {
        manualInput.setSelectionRange(targetIndex, targetIndex + 1);
      } else {
        manualInput.setSelectionRange(val.length, val.length);
      }
    } else {
      manualInput.setSelectionRange(val.length, val.length);
    }
    updateOtpDisplay();
  });

  updateOtpDisplay();
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

  // 初始化 8 位 OTP 验证码输入
  initOtpInput();

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
