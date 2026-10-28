import { cloud } from './cloud.js';
import { openSettingsModal, showToast } from './modals.js';

const emojiPattern = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*)$/u;
const emojiSegments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const presetEmojis = ['😊', '😎', '🥳', '🦊', '🐱', '🐼', '🌱', '🚀'];
const dialog = document.getElementById('onboardingDialog');

function firstEmoji(value) {
  return Array.from(emojiSegments.segment(value), part => part.segment)
    .find(segment => emojiPattern.test(segment)) || '';
}

function syncPresetSelection(value) {
  const presets = document.getElementById('profileEmojiPresets');
  if (!presets) return;
  presets.querySelectorAll('.profile-emoji-preset').forEach(btn => {
    const active = btn.dataset.emoji === value;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function setAvatar(profile) {
  const emoji = firstEmoji(profile?.avatar_emoji || '') || '😊';
  document.getElementById('profileAvatarInput').value = emoji;
  syncPresetSelection(emoji);
}

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
  const desc = document.getElementById('profileDescription');
  if (desc) desc.textContent = '选一个头像，再告诉我们怎么称呼你。';
  const closeBtn = document.getElementById('profileCloseBtn');
  if (closeBtn) closeBtn.hidden = true;
  dialog.dataset.voluntaryEdit = 'false';
  const profile = cloud.session.user.user_metadata;
  setAvatar(profile);
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
  const desc = document.getElementById('profileDescription');
  if (desc) desc.textContent = '更换头像或修改你的显示昵称。';
  const closeBtn = document.getElementById('profileCloseBtn');
  if (closeBtn) closeBtn.hidden = false;
  dialog.dataset.voluntaryEdit = 'true';
  const profile = cloud.session?.user?.user_metadata;
  setAvatar(profile);
  document.getElementById('profileNickname').value = profile?.nickname || '';
  document.getElementById('profileError').hidden = true;
  dialog.showModal();
  document.getElementById('profileNickname').focus();
}

function closeProfileEditor() {
  dialog.close();
  dialog.dataset.voluntaryEdit = 'false';
  const closeBtn = document.getElementById('profileCloseBtn');
  if (closeBtn) closeBtn.hidden = true;
  openSettingsModal('settingsAccount');
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
  const avatarInput = document.getElementById('profileAvatarInput');
  const presetsContainer = document.getElementById('profileEmojiPresets');
  if (presetsContainer) {
    presetsContainer.replaceChildren(...presetEmojis.map(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-emoji-preset';
      btn.dataset.emoji = emoji;
      btn.textContent = emoji;
      btn.setAttribute('aria-label', `选择 ${emoji} 作为头像`);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        if (saving) return;
        avatarInput.value = emoji;
        syncPresetSelection(emoji);
        document.getElementById('profileError').hidden = true;
      });
      return btn;
    }));
  }
  const normalizeAvatar = () => {
    avatarInput.value = firstEmoji(avatarInput.value);
    syncPresetSelection(avatarInput.value);
    document.getElementById('profileError').hidden = true;
  };
  avatarInput.addEventListener('focus', () => avatarInput.select());
  avatarInput.addEventListener('input', event => {
    if (!event.isComposing) normalizeAvatar();
  });
  avatarInput.addEventListener('compositionend', normalizeAvatar);
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
    const avatar = avatarInput.value;
    if (!emojiPattern.test(avatar)) {
      error.textContent = '请输入一个 Emoji 作为头像';
      error.hidden = false;
      avatarInput.focus();
      return;
    }
    saving = true;
    button.disabled = avatarInput.disabled = nickname.disabled = true;
    presetsContainer?.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    button.textContent = '正在保存…';
    try {
      await cloud.updateProfile(nickname.value.trim(), avatar);
      const isVoluntary = dialog.dataset.voluntaryEdit === 'true';
      dialog.close();
      dialog.dataset.voluntaryEdit = 'false';
      const closeBtn = document.getElementById('profileCloseBtn');
      if (closeBtn) closeBtn.hidden = true;
      document.dispatchEvent(new Event('simtab-sync'));
      if (isVoluntary) {
        openSettingsModal('settingsAccount');
        showToast('个人资料已更新');
      } else {
        document.getElementById('accountBtn').focus();
      }
    } catch (err) {
      error.textContent = err.message || '保存失败，请重试';
      error.hidden = false;
    } finally {
      saving = false;
      button.disabled = avatarInput.disabled = nickname.disabled = false;
      presetsContainer?.querySelectorAll('button').forEach(btn => { btn.disabled = false; });
      button.textContent = '确定';
    }
  });
  openOnboarding();
}
