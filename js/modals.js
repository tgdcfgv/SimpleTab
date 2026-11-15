import { getLocale, loadLocale } from './i18n.js';
import { t } from './i18n.js';
import { saveWallpaper, clearWallpaper, getWallpaperUrl } from './wallpaper.js';
import { safeWebUrl, safeImageUrl, deriveSiteTitle } from './urls.js';
import { setSelectOpen, updateCustomSelectOptions, updateCustomSelectTrigger, initAllCustomSelects } from './custom-select.js';
import { appData, SEARCH_ENGINES, syncManager } from './storage.js';
import { generateId, getFaviconUrl } from './utils.js';
import { invalidateSiteIcon, refreshAllSiteIcons } from './site-icons.js';
import { applySettings, render } from './render.js';
import { searchInput, showResults } from './search.js';
import { appStoreModal, currentStoreGroupId, renderAppStoreCategory, renderStoreGroupSelection, renderStoreMenu, setStoreSelectionFromGroup } from './store.js';
import { openAuthModal, closeAuthModal, showToast } from './auth-modal.js';

export { openAuthModal, closeAuthModal, showToast, updateCustomSelectOptions, updateCustomSelectTrigger, initAllCustomSelects };

export const modalOverlay = document.getElementById('modalOverlay');
export const siteModal = document.getElementById('siteModal');
export const groupModal = document.getElementById('groupModal');
export const settingsModal = document.getElementById('settingsModal');
export const authModal = document.getElementById('authModal');

export const confirmModal = document.getElementById('confirmModal');
export let confirmCallback = null;

export function showConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  
  closeAllModals();
  modalOverlay.classList.remove('hidden');
  confirmModal.classList.remove('hidden');
}

document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
  closeAllModals();
});

document.getElementById('okConfirmBtn').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeAllModals();
});

export function closeAllModals(notify = true) {
  if (!settingsModal.classList.contains('hidden') && settingsModal.dataset.locked === 'true') return;
  document.querySelectorAll('.custom-select-container.open').forEach(container => setSelectOpen(container, false));
  const settingsWereOpen = !settingsModal.classList.contains('hidden');
  modalOverlay.classList.add('hidden');
  siteModal.classList.add('hidden');
  groupModal.classList.add('hidden');
  settingsModal.classList.add('hidden');
  if (appStoreModal) appStoreModal.classList.add('hidden');
  if (confirmModal) confirmModal.classList.add('hidden');
  const authModalEl = document.getElementById('authModal');
  if (authModalEl) authModalEl.classList.add('hidden');
  if (notify) creationContext?.onClose();
  if (settingsWereOpen && notify) document.dispatchEvent(new Event('simtab-settings-close'));
}

// A caller can stage creations while using the same homepage forms.
let creationContext = null;
export function setCreationContext(context) { creationContext = context; }
function creationGroups() { return creationContext?.groups() || appData.groups; }

// Group Modal
export let currentLinksPerRow = 'auto';
export let groupModalReturnContext = null;
export function updateLinksPerRowUI() {
  document.querySelectorAll('.group-count-option').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.count === String(currentLinksPerRow)));
  });
}

document.getElementById('groupLinksPerRowOptions').addEventListener('click', event => {
  const button = event.target.closest('.group-count-option');
  if (!button || button.disabled) return;
  currentLinksPerRow = button.dataset.count === 'auto' ? 'auto' : Number(button.dataset.count);
  updateLinksPerRowUI();
});

export function openGroupModal(groupId = null, returnContext = null) {
  const form = document.getElementById('groupForm');
  form.reset();
  groupModalReturnContext = groupId ? null : returnContext;
  
  const isIconOnly = appData.settings.cardDisplayMode === 'icon-only';
  const options = document.getElementById('groupLinksPerRowOptions');
  options.querySelectorAll('button').forEach(button => { button.disabled = isIconOnly; });
  options.title = isIconOnly ? t('纯图标状态下无法更改列数') : '';
  options.classList.toggle('is-disabled', isIconOnly);

  if (groupId) {
    const group = appData.groups.find(g => g.id === groupId);
    document.getElementById('groupId').value = group.id;
    document.getElementById('groupName').value = group.name;
    currentLinksPerRow = [2, 3, 4, 5, 6].includes(Number(group.linksPerRow)) ? Number(group.linksPerRow) : 'auto';
    document.getElementById('groupModalTitle').textContent = t('编辑分组');
  } else {
    document.getElementById('groupId').value = '';
    currentLinksPerRow = 'auto';
    document.getElementById('groupModalTitle').textContent = t('添加分组');
  }
  updateLinksPerRowUI();
  
  closeAllModals(!creationContext);
  modalOverlay.classList.remove('hidden');
  creationContext?.onOpen();
  groupModal.classList.remove('hidden');
  setTimeout(() => document.getElementById('groupName').focus(), 50);
}

document.getElementById('addGroupBtn').addEventListener('click', () => openGroupModal());
document.getElementById('cancelGroupBtn').addEventListener('click', () => {
  if (groupModalReturnContext) {
    returnToGroupSelectionParent();
  } else {
    closeAllModals();
  }
});

document.getElementById('groupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('groupId').value;
  const name = document.getElementById('groupName').value.trim();
  if (creationContext && !id) {
    const group = creationContext.addGroup(name, currentLinksPerRow);
    if (groupModalReturnContext) returnToGroupSelectionParent(group.id);
    else closeAllModals();
    return;
  }
  let savedGroupId = id;
  
  if (id) {
    const group = appData.groups.find(g => g.id === id);
    group.name = name;
    group.linksPerRow = currentLinksPerRow;
  } else {
    savedGroupId = generateId();
    appData.groups.push({
      id: savedGroupId,
      name,
      collapsed: false,
      links: [],
      column: appData.groups.length % (document.querySelectorAll('#groupsContainer > .group-col').length || 3),
      columnCount: document.querySelectorAll('#groupsContainer > .group-col').length || 3,
      linksPerRow: currentLinksPerRow
    });
  }
  
  syncManager.saveData();
  render();
  if (groupModalReturnContext) {
    returnToGroupSelectionParent(savedGroupId);
  } else {
    closeAllModals();
  }
});

export function showModal(modal) {
  closeAllModals(!creationContext);
  modalOverlay.classList.remove('hidden');
  modal.classList.remove('hidden');
}

export function returnToGroupSelectionParent(selectedGroupId = null) {
  const context = groupModalReturnContext;
  groupModalReturnContext = null;

  if (context?.source === 'site') {
    showModal(siteModal);
    renderGroupSelectionGrid(selectedGroupId || document.getElementById('siteGroup').value);
    return;
  }

  if (context?.source === 'store') {
    showModal(appStoreModal);
    renderStoreGroupSelection(selectedGroupId || currentStoreGroupId);
    setStoreSelectionFromGroup(selectedGroupId || currentStoreGroupId);
    renderStoreMenu();
    renderAppStoreCategory();
    return;
  }

  closeAllModals();
}

// Site Modal
export function renderGroupSelectionGrid(selectedId) {
  const container = document.getElementById('siteGroupSelection');
  const hiddenInput = document.getElementById('siteGroup');
  container.innerHTML = '';
  
  if (!selectedId && creationGroups().length > 0) {
    selectedId = creationGroups()[0].id;
  }
  hiddenInput.value = selectedId || '';

  creationGroups().forEach(g => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `group-select-btn ${g.id === selectedId ? 'active' : ''}`;
    btn.textContent = g.name;
    btn.title = g.name;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.group-select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      hiddenInput.value = g.id;
    });
    container.appendChild(btn);
  });

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'group-select-btn new-group';
  newBtn.textContent = t('+ 新建分组');
  newBtn.addEventListener('click', () => {
    openGroupModal(null, { source: 'site' });
  });
  container.appendChild(newBtn);
}

export function openSiteModal(siteId = null, groupId = null, draft = null) {
  const form = document.getElementById('siteForm');
  form.reset();
  
  if (siteId && groupId) {
    const group = creationGroups().find(g => g.id === groupId);
    const site = group.links.find(l => l.id === siteId);
    
    document.getElementById('siteId').value = site.id;
    document.getElementById('siteUrl').value = site.url;
    document.getElementById('siteTitle').value = site.title;
    document.getElementById('siteIconUrl').value = site.customIcon || '';
    renderGroupSelectionGrid(group.id);
    document.getElementById('siteModalTitle').textContent = t('编辑网站');
  } else {
    groupId ||= creationContext?.selectedGroupId();
    const preferredGroupId = groupId && creationGroups().some(g => g.id === groupId)
      ? groupId
      : (creationGroups().length > 0 ? creationGroups()[0].id : null);
    document.getElementById('siteId').value = '';
    document.getElementById('siteUrl').value = draft?.url || '';
    document.getElementById('siteTitle').value = draft?.title || '';
    document.getElementById('siteIconUrl').value = draft?.customIcon || '';
    renderGroupSelectionGrid(preferredGroupId);
    document.getElementById('siteModalTitle').textContent = t('添加网站');
  }
  
  closeAllModals(!creationContext);
  creationContext?.onOpen();
  modalOverlay.classList.remove('hidden');
  siteModal.classList.remove('hidden');
  setTimeout(() => {
    if (!siteId && draft?.url) {
      const titleInput = document.getElementById('siteTitle');
      titleInput.focus();
      titleInput.select();
    } else {
      document.getElementById('siteUrl').focus();
    }
  }, 50);
}

document.getElementById('addSiteBtn').addEventListener('click', () => openSiteModal());
document.getElementById('cancelSiteBtn').addEventListener('click', closeAllModals);

document.getElementById('refetchIconBtn').addEventListener('click', async () => {
  const value = document.getElementById('siteUrl').value.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !value) throw new Error();
    await invalidateSiteIcon(url.href);
    // Use the browser favicon API in extensions; no page scraping or proxy.
    document.getElementById('siteIconUrl').value = globalThis.chrome?.runtime?.id
      ? '' : getFaviconUrl(url.href);
  } catch {
    alert(t('请先输入有效的 HTTP 或 HTTPS 网址。'));
  }
});

document.getElementById('siteUrl').addEventListener('blur', (e) => {
  const titleInput = document.getElementById('siteTitle');
  if (e.target.value && !titleInput.value) {
    const fallbackTitle = deriveSiteTitle(e.target.value);
    if (fallbackTitle) titleInput.value = fallbackTitle;
  }
});

document.getElementById('siteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('siteId').value;
  let url = document.getElementById('siteUrl').value.trim();
  let title = document.getElementById('siteTitle').value.trim();
  const targetGroupId = document.getElementById('siteGroup').value;
  const customIcon = document.getElementById('siteIconUrl').value.trim();
  
  if (!targetGroupId) {
    alert(t("请选择一个分组"));
    return;
  }

  url = safeWebUrl(url, { allowBare: true });
  if (!url) return alert(t('请输入有效的 HTTP 或 HTTPS 网址。'));
  if (customIcon && !safeImageUrl(customIcon)) return alert(t('请输入有效的 HTTP/HTTPS 图片地址或图片数据。'));
  if (!title) {
    try {
      title = new URL(url).hostname.replace('www.', '');
    } catch(e) { title = 'New Site'; }
  }

  if (creationContext && !id) {
    creationContext.addSite(targetGroupId, { id: generateId(), title, url, ...(customIcon ? { customIcon } : {}) });
    closeAllModals();
    return;
  }
  if (id) {
    let oldLink = null;
    let oldGroup = null;
    let oldIndex = -1;
    for (const g of appData.groups) {
      const index = g.links.findIndex(l => l.id === id);
      if (index !== -1) {
        oldLink = g.links[index];
        oldGroup = g;
        oldIndex = index;
        break;
      }
    }
    const newGroup = appData.groups.find(g => g.id === targetGroupId);
    if (newGroup && oldLink) {
      oldLink.url = url;
      oldLink.title = title;
      if (customIcon) oldLink.customIcon = customIcon;
      else delete oldLink.customIcon;
      delete oldLink.favicon; // 不再持久化存储 favicon
      if (oldGroup.id !== targetGroupId) {
        oldGroup.links.splice(oldIndex, 1);
        newGroup.links.push(oldLink);
      }
    }
  } else {
    const newGroup = appData.groups.find(g => g.id === targetGroupId);
    if (newGroup) {
      newGroup.links.push({
        id: generateId(),
        title,
        url,
        ...(customIcon ? {customIcon} : {})
      });
    }
  }
  
  syncManager.saveData();
  render();
  closeAllModals();
});

document.getElementById('themeSelect').addEventListener('change', (e) => {
  appData.settings.theme = e.target.value;
  syncManager.saveData();
  applySettings();
});

function updateCardDisplayControl() {
  const mode = appData.settings.cardDisplayMode || 'icon-text';
  document.querySelectorAll('button[data-card-mode]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.cardMode === mode));
  });
  document.getElementById('iconSizeSetting').hidden = mode !== 'icon-only';
}

document.querySelectorAll('button[data-card-mode]').forEach(button => {
  button.addEventListener('click', () => {
    appData.settings.cardDisplayMode = button.dataset.cardMode;
    updateCardDisplayControl();
    syncManager.saveData();
    applySettings();
  });
});

document.getElementById('openModeSelect').addEventListener('change', (e) => {
  appData.settings.openLinksInNewTab = e.target.value === 'new-tab';
  syncManager.saveData();
  render();
});

document.getElementById('dockPositionSelect').addEventListener('change', (e) => {
  appData.settings.dockPosition = e.target.value;
  syncManager.saveData();
  applySettings();
});

export const iconSizeSlider = document.getElementById('iconSizeSlider');
if (iconSizeSlider) {
  iconSizeSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('iconSizeValue').textContent = val + 'px';
    appData.settings.iconSize = parseInt(val, 10);
    applySettings();
  });
  iconSizeSlider.addEventListener('change', () => {
    syncManager.saveData();
  });
}

function renderSearchEngineSettings() {
  const container = document.getElementById('searchEngineSettings');
  const enabled = new Set(appData.settings.enabledSearchEngines || ['google', 'bing']);
  container.innerHTML = '';

  SEARCH_ENGINES.forEach(engine => {
    const row = document.createElement('div');
    row.className = 'search-engine-option';

    const identity = document.createElement('div');
    identity.className = 'search-engine-identity';
    identity.innerHTML = `<img src="${getFaviconUrl(engine.homeUrl)}" width="18" height="18" alt=""><span>${engine.name}</span>`;

    const toggle = document.createElement('div');
    toggle.className = 'toggle-switch engine-toggle-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `engineToggle-${engine.id}`;
    input.className = 'toggle-input';
    input.checked = enabled.has(engine.id);
    const label = document.createElement('label');
    label.className = 'toggle-label';
    label.htmlFor = input.id;

    input.addEventListener('change', () => {
      const nextEnabled = Array.from(
        container.querySelectorAll('.toggle-input:checked'),
        item => item.id.replace('engineToggle-', '')
      );
      if (nextEnabled.length === 0) {
        input.checked = true;
        return;
      }
      appData.settings.enabledSearchEngines = nextEnabled;
      if (!nextEnabled.includes(appData.settings.searchEngine)) {
        appData.settings.searchEngine = nextEnabled[0];
      }
      syncManager.saveData();
      applySettings();
      updateDefaultSearchEngine();
    });

    toggle.appendChild(input);
    toggle.appendChild(label);
    row.appendChild(identity);
    row.appendChild(toggle);
    container.appendChild(row);
  });
  updateDefaultSearchEngine();
}

function updateDefaultSearchEngine() {
  const select = document.getElementById('defaultSearchEngineSelect');
  const enabled = appData.settings.enabledSearchEngines || ['bing', 'baidu'];
  select.replaceChildren(...SEARCH_ENGINES.filter(engine => enabled.includes(engine.id)).map(engine => new Option(engine.name, engine.id)));
  select.value = appData.settings.searchEngine;
  updateCustomSelectOptions(select);
}

document.getElementById('defaultSearchEngineSelect').addEventListener('change', event => {
  appData.settings.searchEngine = event.target.value;
  syncManager.saveData(); applySettings();
});

function updateDockSettings() {
  const enabled = appData.settings.dockEnabled !== false;
  document.getElementById('dockEnabledToggle').checked = enabled;
  const select = document.getElementById('dockPositionSelect');
  select.disabled = !enabled;
  document.getElementById('dockPositionSetting').classList.toggle('setting-disabled', !enabled);
  const trigger = select.nextElementSibling?.querySelector('.custom-select-trigger-global');
  if (trigger) trigger.disabled = !enabled;
  if (trigger) setSelectOpen(select.nextElementSibling, false);
  document.querySelectorAll('[data-dock-setting]').forEach(input => {
    input.checked = appData.settings[input.dataset.dockSetting] !== false;
  });
  document.getElementById('dockStoreToggle').checked = appData.settings.showDockStoreButton === true;
  const container = document.getElementById('dockSpaceSettings');
  container.replaceChildren(...appData.spaces.map(space => {
    const row = document.createElement('div');
    row.className = 'setting-item';
    const label = document.createElement('label');
    label.textContent = space.name;
    label.htmlFor = `dock-space-${space.id}`;
    const copy = document.createElement('div');
    copy.className = 'setting-copy';
    copy.append(label);
    const control = document.createElement('div');
    control.className = 'setting-control';
    const toggle = document.createElement('div');
    toggle.className = 'toggle-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = label.htmlFor;
    input.className = 'toggle-input';
    input.checked = !(appData.settings.hiddenDockSpaces || []).includes(space.id);
    const switchLabel = document.createElement('label');
    switchLabel.className = 'toggle-label';
    switchLabel.htmlFor = input.id;
    input.addEventListener('change', () => {
      const hidden = new Set(appData.settings.hiddenDockSpaces || []);
      if (input.checked) hidden.delete(space.id); else hidden.add(space.id);
      appData.settings.hiddenDockSpaces = [...hidden];
      syncManager.saveData(); applySettings();
    });
    toggle.append(input, switchLabel); control.append(toggle); row.append(copy, control);
    return row;
  }));
}

let wallpaperPreviewRequest = 0;
async function updateWallpaperPreview() {
  const request = ++wallpaperPreviewRequest;
  try {
    const url = await getWallpaperUrl();
    if (request !== wallpaperPreviewRequest) return;
    const button = document.getElementById('wallpaperChooseBtn');
    const image = document.getElementById('wallpaperThumbnail');
    if (url) image.src = url; else image.removeAttribute('src');
    image.hidden = !url;
    button.querySelector('.wallpaper-empty').hidden = Boolean(url);
    button.querySelector('.wallpaper-replace').hidden = !url;
    button.classList.toggle('has-wallpaper', Boolean(url));
    button.setAttribute('aria-label', url ? t('重新上传壁纸图片') : t('选择壁纸图片'));
    document.getElementById('clearWallpaperBtn').hidden = !url;
  } catch (error) { showToast(t`无法读取壁纸：${error.message}`); }
}

const GRADIENT_ANGLES = [
  { angle: 135, label: '135° ↘' },
  { angle: 90, label: '90° →' },
  { angle: 180, label: '180° ↓' },
  { angle: 45, label: '45° ↗' }
];
let stagedAccentCount = 1;
let stagedGradientAngle = 135;

function getStagedAccentColors() {
  const inputs = [
    document.getElementById('accentColorInput'),
    document.getElementById('accentColorInput2'),
    document.getElementById('accentColorInput3')
  ];
  return inputs.slice(0, stagedAccentCount).map(input => input?.value || '#6366f1');
}

function updateAccentGradientUI() {
  const input2 = document.getElementById('accentColorInput2');
  const input3 = document.getElementById('accentColorInput3');
  const addBtn = document.getElementById('addAccentColorBtn');
  const removeBtn = document.getElementById('removeAccentColorBtn');
  const angleBtn = document.getElementById('accentGradientAngleBtn');
  const preview = document.getElementById('accentGradientPreview');
  if (!input2 || !input3 || !addBtn || !removeBtn || !angleBtn || !preview) return;

  input2.hidden = stagedAccentCount < 2;
  input3.hidden = stagedAccentCount < 3;
  addBtn.hidden = stagedAccentCount >= 3;
  removeBtn.hidden = stagedAccentCount <= 1;
  angleBtn.hidden = stagedAccentCount <= 1;

  const angleInfo = GRADIENT_ANGLES.find(item => item.angle === stagedGradientAngle) || GRADIENT_ANGLES[0];
  angleBtn.textContent = angleInfo.label;

  const colors = getStagedAccentColors();
  preview.hidden = stagedAccentCount <= 1;
  preview.style.background = stagedAccentCount > 1
    ? `linear-gradient(${stagedGradientAngle}deg, ${colors.join(', ')})`
    : colors[0];
}

function syncAccentControlsFromSettings() {
  const rawColors = Array.isArray(appData.settings.accentColors) && appData.settings.accentColors.length
    ? appData.settings.accentColors.slice(0, 3)
    : [appData.settings.accentColor || '#6366f1'];
  stagedAccentCount = Math.min(3, Math.max(1, rawColors.length));
  stagedGradientAngle = [45, 90, 135, 180].includes(Number(appData.settings.accentGradientAngle))
    ? Number(appData.settings.accentGradientAngle)
    : 135;
  const defaults = ['#6366f1', '#8b5cf6', '#ec4899'];
  ['accentColorInput', 'accentColorInput2', 'accentColorInput3'].forEach((id, index) => {
    const input = document.getElementById(id);
    if (input) input.value = rawColors[index] || defaults[index];
  });
  updateAccentGradientUI();
}

// Settings Modal
export function openSettingsModal(panelId) {
  document.getElementById('languageSelect').value = getLocale();
  const wasHidden = settingsModal.classList.contains('hidden');
  if (typeof panelId === 'string') selectSettingsPanel(panelId);
  else if (wasHidden) selectSettingsPanel(settingsModal.dataset.locked === 'true' ? 'settingsAccount' : 'settingsGeneral');
  document.getElementById('compactModeToggle').checked = appData.settings.compactMode;
  updateDockSettings();
  updateWallpaperPreview();
  renderSearchEngineSettings();

  syncAccentControlsFromSettings();

  const settingSelectValues = {
    languageSelect: getLocale(),
    openModeSelect: appData.settings.openLinksInNewTab ? 'new-tab' : 'current-tab',
    themeSelect: appData.settings.theme || 'system',
    groupColumnsSelect: String(appData.settings.groupColumns || 'auto'),
    collapsedIconCountSelect: String(appData.settings.collapsedIconCount ?? 6),
    dockPositionSelect: appData.settings.dockPosition || 'bottom'
  };
  Object.entries(settingSelectValues).forEach(([id, value]) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.value = value;
    updateCustomSelectTrigger(select);
  });
  
  updateCardDisplayControl();

  const iconSizeSlider = document.getElementById('iconSizeSlider');
  if (iconSizeSlider) {
    iconSizeSlider.value = appData.settings.iconSize || 24;
    document.getElementById('iconSizeValue').textContent = (appData.settings.iconSize || 24) + 'px';
  }
  
  closeAllModals(false);
  modalOverlay.classList.remove('hidden');
  settingsModal.classList.remove('hidden');
  if (wasHidden) settingsModal.focus();
}

settingsModal.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (settingsModal.dataset.locked !== 'true') {
      closeAllModals();
      document.getElementById(document.getElementById('settingsBtn').hidden || document.getElementById('spaceDock').hidden ? 'settingsFallbackBtn' : 'settingsBtn').focus();
    }
  }
  if (event.key !== 'Tab') return;
  const controls = [...settingsModal.querySelectorAll('button, input, select, a, summary, [tabindex="0"]')]
    .filter(element => !element.disabled && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === settingsModal)) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === settingsModal)) {
    event.preventDefault(); first.focus();
  }
});

document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
document.getElementById('settingsFallbackBtn').addEventListener('click', openSettingsModal);

function selectSettingsPanel(panelId) {
  const nextPanel = document.getElementById(panelId);
  if (!nextPanel?.classList.contains('settings-section')) return;
  const changed = !nextPanel.classList.contains('active');
  document.querySelectorAll('.settings-nav-btn').forEach(button => {
    const active = button.dataset.settingsPanel === panelId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelectorAll('.settings-section').forEach(panel => {
    panel.classList.toggle('active', panel.id === panelId);
  });
  if (changed) settingsModal.querySelector('.settings-content').scrollTop = 0;
}

document.querySelectorAll('.settings-nav-btn').forEach(button => {
  button.addEventListener('click', () => selectSettingsPanel(button.dataset.settingsPanel));
});

document.getElementById('dockEnabledToggle').addEventListener('change', event => {
  appData.settings.dockEnabled = event.target.checked;
  updateDockSettings(); syncManager.saveData(); applySettings();
});
document.querySelectorAll('[data-dock-setting]').forEach(input => {
  input.addEventListener('change', () => {
    appData.settings[input.dataset.dockSetting] = input.checked;
    syncManager.saveData(); applySettings();
  });
});

['accentColorInput', 'accentColorInput2', 'accentColorInput3'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateAccentGradientUI);
});

document.getElementById('addAccentColorBtn')?.addEventListener('click', () => {
  if (stagedAccentCount < 3) {
    stagedAccentCount += 1;
    updateAccentGradientUI();
  }
});

document.getElementById('removeAccentColorBtn')?.addEventListener('click', () => {
  if (stagedAccentCount > 1) {
    stagedAccentCount -= 1;
    updateAccentGradientUI();
  }
});

document.getElementById('accentGradientAngleBtn')?.addEventListener('click', () => {
  const idx = GRADIENT_ANGLES.findIndex(item => item.angle === stagedGradientAngle);
  stagedGradientAngle = GRADIENT_ANGLES[(idx + 1) % GRADIENT_ANGLES.length].angle;
  updateAccentGradientUI();
});

document.getElementById('applyAccentColorBtn').addEventListener('click', () => {
  const colors = getStagedAccentColors();
  appData.settings.accentColors = colors;
  appData.settings.accentColor = colors[0];
  appData.settings.accentGradientAngle = stagedGradientAngle;
  syncManager.saveData();
  applySettings();
});

document.getElementById('compactModeToggle').addEventListener('change', event => {
  appData.settings.compactMode = event.target.checked;
  syncManager.saveData();
  applySettings();
});

document.getElementById('closeSettingsBtn').addEventListener('click', closeAllModals);

document.getElementById('searchEngineSelect').addEventListener('change', (e) => {
  if (appData.settings.searchEngine === e.target.value) return;
  appData.settings.searchEngine = e.target.value;
  syncManager.saveData();
  // Pointer selection retains input focus, so update suggestion URLs explicitly.
  if (document.activeElement === searchInput) showResults();
});

document.getElementById('wallpaperChooseBtn').addEventListener('click', () => document.getElementById('wallpaperUpload').click());
document.getElementById('wallpaperUpload').addEventListener('change', async (e) => {
  const input = e.target;
  const file = input.files[0];
  input.disabled = true;
  document.getElementById('wallpaperChooseBtn').disabled = true;
  document.getElementById('clearWallpaperBtn').disabled = true;
  try {
    if (!file) return;
    await saveWallpaper(file);
    appData.settings.wallpaper = null;
    applySettings();
    await updateWallpaperPreview();
  } catch (error) {
    showToast(t`壁纸保存失败：${error.message}`);
  } finally {
    input.value = ''; input.disabled = false;
    document.getElementById('wallpaperChooseBtn').disabled = false;
    document.getElementById('clearWallpaperBtn').disabled = false;
  }
});

document.getElementById('clearWallpaperBtn').addEventListener('click', async () => {
  try {
    await clearWallpaper();
    appData.settings.wallpaper = null;
    applySettings();
    await updateWallpaperPreview();
  } catch (error) { showToast(t`移除壁纸失败：${error.message}`); }
});

async function handleRefreshIcons() {
  const buttons = document.querySelectorAll('[data-refresh-icons]');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.textContent = t('正在刷新…');
  });
  try {
    await refreshAllSiteIcons();
    render();
    showToast(t('图标已刷新'));
  } catch (error) {
    showToast(t`图标刷新失败：${error.message}`);
  } finally {
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.textContent = t('刷新图标');
    });
  }
}

document.querySelectorAll('[data-refresh-icons]').forEach(button => {
  button.addEventListener('click', handleRefreshIcons);
});

document.getElementById('exportBtnNew').addEventListener('click', async () => {
  try { await syncManager.exportData(); }
  catch (error) { showToast(t`导出失败：${error.message}`); }
});
document.getElementById('importFileNew').addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    syncManager.importData(e.target.files[0]);
    e.target.value = ''; // reset file input
    closeAllModals();
  }
});

// Close modals on overlay click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeAllModals();
  }
});

export let currentContextMenuSiteId = null;
export let currentContextMenuGroupId = null;

export function openContextMenu(x, y, { siteBtn = null, host = document.body, creationOnly = false } = {}) {
  const menu = document.getElementById('contextMenu');

  host.appendChild(menu);
  // A top-layer menu uses viewport coordinates even inside an animated dialog.
  if (typeof menu.showPopover === 'function') menu.setAttribute('popover', 'manual');
  document.getElementById('contextBulkEditor').style.display = (creationOnly || siteBtn) ? 'none' : '';
  document.getElementById('contextSettings').style.display = creationOnly ? 'none' : '';
  document.getElementById('contextAddSpace').style.display = creationOnly ? 'flex' : 'none';
  const contextAddSite = document.getElementById('contextAddSite');
  const contextAddGroup = document.getElementById('contextAddGroup');
  const contextEditSite = document.getElementById('contextEditSite');
  const contextDeleteSite = document.getElementById('contextDeleteSite');
  const contextDivider = document.getElementById('contextDivider');
  if (siteBtn) {
    contextAddSite.style.display = 'none';
    contextAddGroup.style.display = 'none';
    if (contextEditSite) contextEditSite.style.display = 'flex';
    if (contextDeleteSite) contextDeleteSite.style.display = 'flex';
    if (contextDivider) contextDivider.style.display = 'none';

    currentContextMenuSiteId = siteBtn.dataset.id;
    currentContextMenuGroupId = siteBtn.closest('.sites-grid').dataset.groupId;
  } else {
    contextAddSite.style.display = 'flex';
    contextAddGroup.style.display = 'flex';
    if (contextEditSite) contextEditSite.style.display = 'none';
    if (contextDeleteSite) contextDeleteSite.style.display = 'none';
    if (contextDivider) contextDivider.style.display = 'none';

    currentContextMenuSiteId = null;
    currentContextMenuGroupId = null;
  }

  // Measure inside the viewport before revealing the menu. Measuring at the
  // pointer first can temporarily expand the page and flash its scrollbars.
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.classList.remove('hidden');
  if (menu.hasAttribute('popover') && !menu.matches(':popover-open')) menu.showPopover();
  const margin = 10;
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  // Layout sizes are unaffected by the menu's scale transition.
  const bounds = creationOnly ? host.getBoundingClientRect() : { left: 0, top: 0, right: width, bottom: height };
  const left = Math.max(bounds.left + margin, Math.min(x, bounds.right - menu.offsetWidth - margin));
  const top = Math.max(bounds.top + margin, Math.min(y, bounds.bottom - menu.offsetHeight - margin));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
}

new MutationObserver(() => {
  const menu = document.getElementById('contextMenu');
  if (menu.classList.contains('hidden') && menu.matches(':popover-open')) menu.hidePopover();
}).observe(document.getElementById('contextMenu'), { attributes: true, attributeFilter: ['class'] });

document.addEventListener('contextmenu', (e) => {
  const isBlankSpace = e.target === document.body ||
                       e.target.classList.contains('app-container') ||
                       e.target.classList.contains('groups-container') ||
                       e.target.classList.contains('group-col') ||
                       e.target.classList.contains('sites-grid-wrapper') ||
                       e.target.classList.contains('sites-grid') ||
                       e.target.classList.contains('group-card');

  const siteBtn = e.target.closest('.site-btn');

  if (isBlankSpace || siteBtn) {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, { siteBtn });
  } else {
    const menu = document.getElementById('contextMenu');
    if(menu) menu.classList.add('hidden');
  }
});

document.addEventListener('click', (e) => {
  const menu = document.getElementById('contextMenu');
  if (menu && !menu.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

document.getElementById('contextAddSite').addEventListener('click', () => {
  document.getElementById('contextMenu').classList.add('hidden');
  openSiteModal();
});
document.getElementById('contextAddGroup').addEventListener('click', () => {
  document.getElementById('contextMenu').classList.add('hidden');
  openGroupModal();
});

document.getElementById('contextSettings').addEventListener('click', () => {
  document.getElementById('contextMenu').classList.add('hidden');
  openSettingsModal();
});

document.getElementById('contextEditSite').addEventListener('click', () => {
  document.getElementById('contextMenu').classList.add('hidden');
  if (currentContextMenuSiteId && currentContextMenuGroupId) {
    openSiteModal(currentContextMenuSiteId, currentContextMenuGroupId);
  }
});

document.getElementById('contextDeleteSite').addEventListener('click', () => {
  document.getElementById('contextMenu').classList.add('hidden');
  if (currentContextMenuSiteId && currentContextMenuGroupId) {
    const group = appData.groups.find(g => g.id === currentContextMenuGroupId);
    const link = group.links.find(l => l.id === currentContextMenuSiteId);
    showConfirm(t('删除网站'), t`确定删除网站 "${link.title}" 吗？`, () => {
      group.links = group.links.filter(l => l.id !== currentContextMenuSiteId);
      syncManager.saveData();
      render();
    });
  }
});

document.getElementById('groupColumnsSelect').addEventListener('change', event => {
  appData.settings.groupColumns = event.target.value === 'auto' ? 'auto' : Number(event.target.value);
  syncManager.saveData(); render();
});

document.getElementById('collapsedIconCountSelect')?.addEventListener('change', event => {
  appData.settings.collapsedIconCount = Number(event.target.value);
  syncManager.saveData(); render();
});

// Save before reloading so every module starts in the selected language.
document.getElementById('languageSelect').addEventListener('change', async event => {
  const select = event.target;
  const trigger = select.nextElementSibling?.querySelector('.custom-select-trigger-global');
  const previous = getLocale();
  select.disabled = true;
  if (trigger) trigger.disabled = true;
  try {
    await loadLocale(select.value);
    appData.settings.language = select.value;
    if (!await syncManager.saveData()) throw new Error(t('更改尚未保存，请重试同步'));
    if (globalThis.chrome?.storage?.local) await chrome.storage.local.set({ 'simtab-language': select.value });
    window.location.reload();
  } catch (error) {
    appData.settings.language = previous;
    await loadLocale(previous);
    select.value = previous;
    updateCustomSelectTrigger(select);
    showToast(error.message);
  } finally {
    select.disabled = false;
    if (trigger) trigger.disabled = false;
  }
});
