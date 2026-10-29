import { t } from './i18n.js';
import { cloud } from './cloud.js';
import { openSettingsModal, showToast } from './modals.js';

const emojiPattern = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*)$/u;
const emojiSegments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const dialog = document.getElementById('onboardingDialog');
let currentAvatar = '😊';

function extractEmoji(value, previousEmoji = '') {
  const emojis = Array.from(emojiSegments.segment(value), part => part.segment)
    .filter(segment => emojiPattern.test(segment));
  if (!emojis.length) return '';
  if (emojis.length > 1 && previousEmoji) {
    const idx = emojis.indexOf(previousEmoji);
    if (idx !== -1) emojis.splice(idx, 1);
  }
  return emojis[0];
}

function setAvatar(profile) {
  const emoji = extractEmoji(profile?.avatar_emoji || '') || '😊';
  currentAvatar = emoji;
  document.getElementById('profileAvatarInput').value = emoji;
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
  document.getElementById('profileTitle').textContent = t('让这里更像你');
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
  document.getElementById('profileTitle').textContent = t('编辑个人资料');
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
  const normalizeAvatar = () => {
    const next = extractEmoji(avatarInput.value, currentAvatar);
    avatarInput.value = next;
    currentAvatar = next;
    document.getElementById('profileError').hidden = true;
  };
  avatarInput.addEventListener('focus', () => {
    requestAnimationFrame(() => avatarInput.select());
  });
  avatarInput.addEventListener('mouseup', event => {
    if (document.activeElement === avatarInput && !avatarInput.classList.contains('is-composing')) {
      event.preventDefault();
      avatarInput.select();
    }
  });
  avatarInput.addEventListener('compositionstart', () => {
    avatarInput.classList.add('is-composing');
  });
  avatarInput.addEventListener('input', event => {
    if (!event.isComposing) {
      avatarInput.classList.remove('is-composing');
      normalizeAvatar();
    }
  });
  avatarInput.addEventListener('compositionend', () => {
    avatarInput.classList.remove('is-composing');
    normalizeAvatar();
  });
  avatarInput.addEventListener('blur', () => {
    avatarInput.classList.remove('is-composing');
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
      error.textContent = t('请输入昵称');
      error.hidden = false;
      nickname.focus();
      return;
    }
    const avatar = avatarInput.value;
    if (!emojiPattern.test(avatar)) {
      error.textContent = t('请输入一个 Emoji 作为头像');
      error.hidden = false;
      avatarInput.focus();
      return;
    }
    saving = true;
    button.disabled = avatarInput.disabled = nickname.disabled = true;
    button.textContent = t('正在保存…');
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
        showToast(t('个人资料已更新'));
      } else {
        document.getElementById('accountBtn').focus();
      }
    } catch (err) {
      error.textContent = err.message || t('保存失败，请重试');
      error.hidden = false;
    } finally {
      saving = false;
      button.disabled = avatarInput.disabled = nickname.disabled = false;
      button.textContent = t('确定');
    }
  });
  openOnboarding();
}
