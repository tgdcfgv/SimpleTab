import { cloud } from './cloud.js';
import { openSettingsModal, showToast } from './modals.js';

const emojis = ['😊', '😎', '🥳', '🤓', '🤗', '😺', '🐱', '🐶', '🐼', '🦊', '🐻', '🐨', '🐯', '🐰', '🐸', '🐧', '🦉', '🦋', '🐳', '🐙', '🌱', '🌻', '🍀', '🌵', '🌈', '☀️', '🌙', '⭐', '🍊', '🍑', '🥑', '🍉', '☕', '🎨', '🎮', '🎧', '🚀', '🛸', '💎', '🔥'];
const dialog = document.getElementById('onboardingDialog');
let selectedAvatar = emojis[0];
let saving = false;

export function needsProfile() {
  const profile = cloud.session?.user?.user_metadata;
  return Boolean(cloud.session && (!profile?.profile_completed || !profile?.nickname?.trim() || !profile?.avatar_emoji));
}

export function openOnboarding() {
  if (!needsProfile() || dialog.open) return;
  // Present onboarding above the home page, including when login began in settings.
  document.getElementById('settingsModal').classList.add('hidden');
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('welcomeStep').hidden = false;
  document.getElementById('profileStep').hidden = true;
  dialog.setAttribute('aria-labelledby', 'onboardingTitle');
  document.getElementById('profileTitle').textContent = '让这里更像你';
  const closeBtn = document.getElementById('profileCloseBtn');
  if (closeBtn) closeBtn.hidden = true;
  dialog.dataset.voluntaryEdit = 'false';
  const profile = cloud.session.user.user_metadata;
  selectedAvatar = emojis.includes(profile?.avatar_emoji) ? profile.avatar_emoji : emojis[0];
  document.getElementById('profileAvatarPreview').textContent = selectedAvatar;
  document.getElementById('profileNickname').value = profile?.nickname || '';
  document.getElementById('profileError').hidden = true;
  dialog.showModal();
  document.getElementById('welcomeConfirmBtn').focus();
}

export function openProfileEditor() {
  if (!cloud.session || dialog.open) return;
  document.getElementById('settingsModal').classList.add('hidden');
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('welcomeStep').hidden = true;
  document.getElementById('profileStep').hidden = false;
  dialog.setAttribute('aria-labelledby', 'profileTitle');
  document.getElementById('profileTitle').textContent = '编辑个人资料';
  const closeBtn = document.getElementById('profileCloseBtn');
  if (closeBtn) closeBtn.hidden = false;
  dialog.dataset.voluntaryEdit = 'true';
  const profile = cloud.session?.user?.user_metadata;
  selectedAvatar = emojis.includes(profile?.avatar_emoji) ? profile.avatar_emoji : emojis[0];
  document.getElementById('profileAvatarPreview').textContent = selectedAvatar;
  document.getElementById('profileNickname').value = profile?.nickname || '';
  document.getElementById('profileError').hidden = true;
  const grid = document.getElementById('profileEmojiGrid');
  if (grid) grid.hidden = true;
  const picker = document.getElementById('profileAvatarBtn');
  if (picker) picker.setAttribute('aria-expanded', 'false');
  dialog.showModal();
  document.getElementById('profileNickname').focus();
}

function closeProfileEditor() {
  dialog.close();
  dialog.dataset.voluntaryEdit = 'false';
  const closeBtn = document.getElementById('profileCloseBtn');
  if (closeBtn) closeBtn.hidden = true;
  openSettingsModal('settingsData');
}

export function initOnboarding() {
  dialog.addEventListener('cancel', event => {
    if (dialog.dataset.voluntaryEdit === 'true') {
      event.preventDefault();
      closeProfileEditor();
    } else {
      event.preventDefault();
    }
  });
  document.getElementById('profileCloseBtn')?.addEventListener('click', () => {
    closeProfileEditor();
  });
  document.getElementById('welcomeConfirmBtn').addEventListener('click', () => {
    document.getElementById('welcomeStep').hidden = true;
    document.getElementById('profileStep').hidden = false;
    dialog.setAttribute('aria-labelledby', 'profileTitle');
    document.getElementById('profileNickname').focus();
  });
  const grid = document.getElementById('profileEmojiGrid');
  const picker = document.getElementById('profileAvatarBtn');
  picker.addEventListener('click', () => {
    grid.hidden = !grid.hidden;
    picker.setAttribute('aria-expanded', String(!grid.hidden));
    grid.replaceChildren(...emojis.map(emoji => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = emoji;
      button.setAttribute('aria-label', `使用 ${emoji} 作为头像`);
      button.setAttribute('aria-pressed', String(emoji === selectedAvatar));
      button.addEventListener('click', () => {
        selectedAvatar = emoji;
        document.getElementById('profileAvatarPreview').textContent = emoji;
        grid.hidden = true;
        picker.setAttribute('aria-expanded', 'false');
        picker.focus();
      });
      return button;
    }));
    if (!grid.hidden) grid.querySelector('[aria-pressed="true"]').focus();
  });
  document.getElementById('profileNickname').addEventListener('input', () => {
    document.getElementById('profileError').hidden = true;
  });
  document.getElementById('profileForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const nickname = document.getElementById('profileNickname');
    const error = document.getElementById('profileError');
    const button = document.getElementById('profileConfirmBtn');
    error.hidden = true;
    if (!nickname.value.trim()) {
      error.textContent = '请输入昵称';
      error.hidden = false;
      nickname.focus();
      return;
    }
    saving = true;
    button.disabled = picker.disabled = nickname.disabled = true;
    grid.hidden = true;
    picker.setAttribute('aria-expanded', 'false');
    button.textContent = '正在保存…';
    try {
      await cloud.updateProfile(nickname.value.trim(), selectedAvatar);
      const isVoluntary = dialog.dataset.voluntaryEdit === 'true';
      dialog.close();
      dialog.dataset.voluntaryEdit = 'false';
      const closeBtn = document.getElementById('profileCloseBtn');
      if (closeBtn) closeBtn.hidden = true;
      document.dispatchEvent(new Event('simtab-sync'));
      if (isVoluntary) {
        openSettingsModal('settingsData');
        showToast('个人资料已更新');
      } else {
        document.getElementById('accountBtn').focus();
      }
    } catch (err) {
      error.textContent = err.message || '保存失败，请重试';
      error.hidden = false;
    } finally {
      saving = false;
      button.disabled = picker.disabled = nickname.disabled = false;
      button.textContent = '确定';
    }
  });
  openOnboarding();
}
