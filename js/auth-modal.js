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

  // 如果传入了初始邮箱且非空，填入
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
  // 检查是否还有其他 modal 打开，如果没有才隐藏 overlay
  const anyOtherModalOpen = [...document.querySelectorAll('#modalOverlay .modal')]
    .some(modal => modal.id !== 'authModal' && !modal.classList.contains('hidden'));
  if (!anyOtherModalOpen) {
    document.getElementById('modalOverlay')?.classList.add('hidden');
  }

  // 清除错误信息
  clearErrors();
}

function switchStep(step) {
  currentStep = step;
  const stepEmail = document.getElementById('authStepEmail');
  const stepVerify = document.getElementById('authStepVerify');
  const backBtn = document.getElementById('authBackBtn');
  const emailInput = document.getElementById('authEmailInput');
  const maskedEmail = document.getElementById('authMaskedEmail');

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

    // 清空验证码输入框
    const digitInputs = [...document.querySelectorAll('.auth-code-digit')];
    digitInputs.forEach(input => {
      input.value = '';
      input.disabled = false;
    });

    startResendCountdown(45);

    setTimeout(() => {
      digitInputs[0]?.focus();
    }, 50);
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

function startResendCountdown(seconds = 45) {
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
      submitBtn.textContent = '继续';
    }
  }
}

async function handleVerifySubmit(event) {
  if (event) event.preventDefault();
  if (isSubmitting) return;

  clearErrors();
  const digitInputs = [...document.querySelectorAll('.auth-code-digit')];
  const submitBtn = document.getElementById('authVerifySubmitBtn');
  const code = digitInputs.map(i => i.value).join('');

  if (code.length < 6) {
    showVerifyError('请输入完整的 6 位验证码');
    const firstEmpty = digitInputs.find(i => !i.value) || digitInputs[0];
    firstEmpty?.focus();
    return;
  }

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '正在验证…';
  }
  digitInputs.forEach(i => { i.disabled = true; });

  try {
    const session = await cloud.verifyOtp({ email: currentEmail, token: code });
    const isNewUser = checkIfNewUser(session?.user);

    isSubmitting = false;
    closeAuthModal(true);

    if (isNewUser) {
      showToast('账户已创建，Sim Tab 同步已开启');
    } else {
      showToast('登录成功');
    }

    // 立即执行同步
    if (syncManager) {
      try {
        await syncManager.loadCloud();
        applySettings();
        render();
      } catch (err) {
        console.error('Initial sync error:', err);
      }
    }
    document.dispatchEvent(new Event('simtab-sync'));
  } catch (error) {
    showVerifyError(error.message || '验证码不正确，请重新输入');
    digitInputs.forEach(i => {
      i.disabled = false;
      i.value = '';
    });
    digitInputs[0]?.focus();
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '验证并登录';
    }
    digitInputs.forEach(i => { i.disabled = false; });
  }
}

export function initAuthModal() {
  const authModal = document.getElementById('authModal');
  if (!authModal) return;

  const emailForm = document.getElementById('authEmailForm');
  const emailInput = document.getElementById('authEmailInput');
  const verifyForm = document.getElementById('authVerifyForm');
  const digitInputs = [...document.querySelectorAll('.auth-code-digit')];
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

  // 第二步验证码表单提交
  verifyForm?.addEventListener('submit', handleVerifySubmit);

  // 6 位数字验证码格子事件
  digitInputs.forEach((input, index) => {
    // 处理粘贴
    input.addEventListener('paste', e => {
      e.preventDefault();
      clearErrors();
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';

      // 支持提取数字
      const digits = pasted.replace(/\D/g, '').slice(0, 6);
      if (digits.length > 0) {
        for (let i = 0; i < 6; i++) {
          digitInputs[i].value = digits[i] || '';
        }
        if (digits.length === 6) {
          digitInputs[5]?.focus();
          handleVerifySubmit();
        } else {
          digitInputs[digits.length]?.focus();
        }
        return;
      }

      // 如果粘贴的是 URL 链接
      if (/^https?:\/\//.test(pasted.trim())) {
        try {
          const url = new URL(pasted.trim());
          const token = url.searchParams.get('token') || url.searchParams.get('token_hash');
          const type = url.searchParams.get('type') || 'email';
          if (token) {
            isSubmitting = true;
            cloud.verifyOtp({ token_hash: token, type }).then(session => {
              const isNewUser = checkIfNewUser(session?.user);
              isSubmitting = false;
              closeAuthModal(true);
              showToast(isNewUser ? '账户已创建，Sim Tab 同步已开启' : '登录成功');
              syncManager?.loadCloud().then(() => {
                applySettings();
                render();
              });
              document.dispatchEvent(new Event('simtab-sync'));
            }).catch(err => {
              showVerifyError(err.message || '验证链接无效或已过期');
            }).finally(() => {
              isSubmitting = false;
            });
          }
        } catch {}
      }
    });

    // 处理输入
    input.addEventListener('input', e => {
      clearErrors();
      const val = input.value;
      // 保证只填一位数字
      const clean = val.replace(/\D/g, '');
      input.value = clean ? clean.slice(-1) : '';

      if (input.value) {
        if (index < 5) {
          digitInputs[index + 1]?.focus();
        } else {
          // 填满最后一位，检查全部是否满6位，自动提交
          const full = digitInputs.every(i => i.value !== '');
          if (full) {
            handleVerifySubmit();
          }
        }
      }
    });

    // 处理键盘事件
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (!input.value && index > 0) {
          e.preventDefault();
          digitInputs[index - 1].value = '';
          digitInputs[index - 1].focus();
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        digitInputs[index - 1].focus();
      } else if (e.key === 'ArrowRight' && index < 5) {
        e.preventDefault();
        digitInputs[index + 1].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleVerifySubmit();
      }
    });
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
    resendBtn.disabled = true;
    resendBtn.textContent = '正在发送…';
    try {
      await cloud.sendOtp(currentEmail);
      startResendCountdown(45);
      showToast('验证码已重新发送');
      digitInputs.forEach(i => { i.value = ''; });
      digitInputs[0]?.focus();
    } catch (err) {
      showVerifyError(err.message || '操作过于频繁，请稍后再试');
      resendBtn.disabled = false;
      resendBtn.textContent = '重新发送';
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
