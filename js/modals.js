import { saveWallpaper, clearWallpaper, getWallpaperUrl } from './wallpaper.js';
import { safeWebUrl, safeImageUrl } from './urls.js';
import { icon } from './icons.js';
import { appData, SEARCH_ENGINES, syncManager } from './storage.js';
import { generateId, getFaviconUrl } from './utils.js';
import { applySettings, render } from './render.js';
import { searchInput } from './search.js';
import { appStoreModal, currentStoreGroupId, renderAppStoreCategory, renderStoreGroupSelection, renderStoreMenu, setStoreSelectionFromGroup } from './store.js';
import { openAuthModal, closeAuthModal, showToast } from './auth-modal.js';

export { openAuthModal, closeAuthModal, showToast };

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
  if (settingsWereOpen && notify) document.dispatchEvent(new Event('simtab-settings-close'));
}

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
  options.title = isIconOnly ? '纯图标状态下无法更改列数' : '';
  options.classList.toggle('is-disabled', isIconOnly);

  if (groupId) {
    const group = appData.groups.find(g => g.id === groupId);
    document.getElementById('groupId').value = group.id;
    document.getElementById('groupName').value = group.name;
    currentLinksPerRow = [2, 3, 4, 5, 6].includes(Number(group.linksPerRow)) ? Number(group.linksPerRow) : 'auto';
    document.getElementById('groupModalTitle').textContent = '编辑分组';
  } else {
    document.getElementById('groupId').value = '';
    currentLinksPerRow = 'auto';
    document.getElementById('groupModalTitle').textContent = '添加分组';
  }
  updateLinksPerRowUI();
  
  closeAllModals();
  modalOverlay.classList.remove('hidden');
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
  closeAllModals();
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
  
  if (!selectedId && appData.groups.length > 0) {
    selectedId = appData.groups[0].id;
  }
  hiddenInput.value = selectedId || '';

  appData.groups.forEach(g => {
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
  newBtn.textContent = '+ 新建分组';
  newBtn.addEventListener('click', () => {
    openGroupModal(null, { source: 'site' });
  });
  container.appendChild(newBtn);
}

export function openSiteModal(siteId = null, groupId = null) {
  const form = document.getElementById('siteForm');
  form.reset();
  
  if (siteId && groupId) {
    const group = appData.groups.find(g => g.id === groupId);
    const site = group.links.find(l => l.id === siteId);
    
    document.getElementById('siteId').value = site.id;
    document.getElementById('siteUrl').value = site.url;
    document.getElementById('siteTitle').value = site.title;
    document.getElementById('siteIconUrl').value = site.customIcon || '';
    renderGroupSelectionGrid(group.id);
    document.getElementById('siteModalTitle').textContent = '编辑网站';
  } else {
    document.getElementById('siteId').value = '';
    document.getElementById('siteIconUrl').value = '';
    renderGroupSelectionGrid(appData.groups.length > 0 ? appData.groups[0].id : null);
    document.getElementById('siteModalTitle').textContent = '添加网站';
  }
  
  closeAllModals();
  modalOverlay.classList.remove('hidden');
  siteModal.classList.remove('hidden');
  setTimeout(() => document.getElementById('siteUrl').focus(), 50);
}

document.getElementById('addSiteBtn').addEventListener('click', () => openSiteModal());
document.getElementById('cancelSiteBtn').addEventListener('click', closeAllModals);

document.getElementById('refetchIconBtn').addEventListener('click', () => {
  const value = document.getElementById('siteUrl').value.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !value) throw new Error();
    // Use the browser favicon API in extensions; no page scraping or proxy.
    document.getElementById('siteIconUrl').value = globalThis.chrome?.runtime?.id
      ? '' : getFaviconUrl(url.href);
  } catch {
    alert('请先输入有效的 HTTP 或 HTTPS 网址。');
  }
});

document.getElementById('siteUrl').addEventListener('blur', (e) => {
  const titleInput = document.getElementById('siteTitle');
  if (e.target.value && !titleInput.value) {
    try {
      let urlStr = e.target.value;
      if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
      const url = new URL(urlStr);
      let hostname = url.hostname.replace('www.', '');
      hostname = hostname.split('.')[0];
      titleInput.value = hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch(err) {}
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
    alert("请选择一个分组");
    return;
  }

  url = safeWebUrl(url, { allowBare: true });
  if (!url) return alert('请输入有效的 HTTP 或 HTTPS 网址。');
  if (customIcon && !safeImageUrl(customIcon)) return alert('请输入有效的 HTTP/HTTPS 图片地址或图片数据。');
  if (!title) {
    try {
      title = new URL(url).hostname.replace('www.', '');
    } catch(e) { title = 'New Site'; }
  }

  if (id) {
    let oldLink;
    for (const g of appData.groups) {
      const index = g.links.findIndex(l => l.id === id);
      if (index !== -1) {
        oldLink = g.links[index];
        g.links.splice(index, 1);
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
      newGroup.links.push(oldLink);
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
    button.setAttribute('aria-label', url ? '重新上传壁纸图片' : '选择壁纸图片');
    document.getElementById('clearWallpaperBtn').hidden = !url;
  } catch (error) { showToast(`无法读取壁纸：${error.message}`); }
}

// Settings Modal
export function openSettingsModal(panelId) {
  const wasHidden = settingsModal.classList.contains('hidden');
  if (typeof panelId === 'string') selectSettingsPanel(panelId);
  else if (wasHidden) selectSettingsPanel(settingsModal.dataset.locked === 'true' ? 'settingsAccount' : 'settingsGeneral');
  document.getElementById('compactModeToggle').checked = appData.settings.compactMode;
  updateDockSettings();
  updateWallpaperPreview();
  renderSearchEngineSettings();

  const accentColorInput = document.getElementById('accentColorInput');
  const accentColor = appData.settings.accentColor || '#6366f1';
  accentColorInput.value = accentColor;

  const settingSelectValues = {
    openModeSelect: appData.settings.openLinksInNewTab ? 'new-tab' : 'current-tab',
    themeSelect: appData.settings.theme || 'system',
    groupColumnsSelect: String(appData.settings.groupColumns || 'auto'),
    dockPositionSelect: appData.settings.dockPosition || 'bottom'
  };
  Object.entries(settingSelectValues).forEach(([id, value]) => {
    const select = document.getElementById(id);
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

document.getElementById('applyAccentColorBtn').addEventListener('click', () => {
  appData.settings.accentColor = document.getElementById('accentColorInput').value;
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
  appData.settings.searchEngine = e.target.value;
  syncManager.saveData();
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
    showToast(`壁纸保存失败：${error.message}`);
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
  } catch (error) { showToast(`移除壁纸失败：${error.message}`); }
});

document.getElementById('exportBtnNew').addEventListener('click', async () => {
  try { await syncManager.exportData(); }
  catch (error) { showToast(`导出失败：${error.message}`); }
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


function getCustomSelectIconMarkup(option, size = 16) {
  const icons = {
    "current-tab": "app-window",
    "new-tab": "external-link",
    "icon-text": "panel-top",
    "icon-only": "grid-2x2",
    "light": "sun",
    "dark": "moon",
    "system": "monitor",
    "dock-left": "panel-left",
    "dock-right": "panel-right",
    "dock-bottom": "panel-bottom",
    "dock-hidden": "eye-off"
};

  const iconName = icons[option.dataset.iconName];
  if (iconName) return icon(iconName, size, 'select-option-icon');

  const iconSrc = option.dataset.url ? getFaviconUrl(option.dataset.url) : option.dataset.icon;
  return iconSrc ? `<img src="${iconSrc}" width="${size}" height="${size}" style="border-radius:4px" alt="">` : '';
}

function sizeSettingSelectFromOptions(select, container) {
  if (!select.classList.contains('setting-select')) return;
  const trigger = container.querySelector('.custom-select-trigger-global');
  const computed = getComputedStyle(trigger);
  const canvas = sizeSettingSelectFromOptions.canvas ||
    (sizeSettingSelectFromOptions.canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  context.font = computed.font || `${computed.fontSize} ${computed.fontFamily}`;

  const widestText = Array.from(select.options).reduce(
    (width, option) => Math.max(width, context.measureText(option.text).width),
    0
  );
  const hasIcons = Array.from(select.options).some(option =>
    option.dataset.iconName || option.dataset.icon || option.dataset.url
  );
  const iconWidth = hasIcons ? 24 : 0;
  const arrowAndSpacingWidth = 34;
  const horizontalPadding =
    (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
  const preferredWidth = Math.ceil(widestText + iconWidth + arrowAndSpacingWidth + horizontalPadding);

  container.style.width = `${Math.max(112, preferredWidth)}px`;
}

function setSelectOpen(container, open) {
  const options = container.querySelector('.custom-select-options-global');
  container.classList.toggle('open', open);
  options.classList.toggle('hidden', !open);
  options.inert = !open;
  container.querySelector('.custom-select-trigger-global').setAttribute('aria-expanded', String(open));
  if (container.previousElementSibling?.id === 'searchEngineSelect') {
    document.querySelector('.search-container')?.classList.toggle('engine-select-open', open);
  }
}

export function updateCustomSelectOptions(select) {
  if (select.dataset.native === 'true') return;
  let container = select.nextElementSibling;
  if (!container || !container.classList.contains('custom-select-container')) {
    container = document.createElement('div');
    container.className = 'custom-select-container';
    
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.disabled = select.disabled;
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || document.querySelector(`label[for="${select.id}"]`)?.textContent || '选择搜索引擎');
    trigger.className = 'custom-select-trigger-global';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<div class="selected-content"></div>${icon('chevron-down', 14)}`;
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options-global hidden';
    optionsContainer.inert = true;
    const optionsContent = document.createElement('div');
    optionsContent.className = 'custom-select-options-content';
    optionsContainer.appendChild(optionsContent);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (select.disabled) return;
      const open = !container.classList.contains('open');
      document.querySelectorAll('.custom-select-container.open').forEach(other => {
        if (other !== container) setSelectOpen(other, false);
      });
      setSelectOpen(container, open);
    });

    container.addEventListener('keydown', event => {
      if (event.key === 'Escape' && container.classList.contains('open')) {
        event.preventDefault();
        event.stopPropagation();
        setSelectOpen(container, false);
        trigger.focus();
      }
    });
    container.appendChild(trigger);
    container.appendChild(optionsContainer);
    select.style.display = 'none';
    select.parentNode.insertBefore(container, select.nextSibling);

    select.addEventListener('change', () => updateCustomSelectTrigger(select));
  }

  const optionsContainer = container.querySelector('.custom-select-options-global');
  const optionsContent = optionsContainer.querySelector('.custom-select-options-content');
  optionsContent.replaceChildren();
  
  Array.from(select.options).forEach((option, index) => {
    const optDiv = document.createElement('button');
    optDiv.type = 'button';
    optDiv.className = `custom-option-global ${index === select.selectedIndex ? 'active' : ''}`;
    
    const iconMarkup = getCustomSelectIconMarkup(option);
    if (iconMarkup) {
      optDiv.innerHTML = `${iconMarkup}<span>${option.text}</span>`;
    } else {
      optDiv.textContent = option.text;
    }

    optDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      select.selectedIndex = index;
      select.dispatchEvent(new Event('change'));
      setSelectOpen(container, false);
      container.querySelector('.custom-select-trigger-global').focus();
      if (select.id === 'searchEngineSelect') {
        document.querySelector('.search-container')?.classList.remove('engine-select-open');
        document.getElementById('searchInput').focus();
      }
    });
    optionsContent.appendChild(optDiv);
  });
  
  updateCustomSelectTrigger(select);
  sizeSettingSelectFromOptions(select, container);
}

export function updateCustomSelectTrigger(select) {
  const container = select.nextElementSibling;
  if (!container || !container.classList.contains('custom-select-container')) return;
  
  const content = container.querySelector('.selected-content');
  const option = select.options[select.selectedIndex];
  if (!option) return;

  const isIconOnly = select.dataset.iconOnly === 'true';
  
  const iconMarkup = getCustomSelectIconMarkup(option, isIconOnly ? 18 : 16);
  if (iconMarkup) {
    if (isIconOnly) {
      content.innerHTML = iconMarkup;
    } else {
      content.innerHTML = `${iconMarkup}<span>${option.text}</span>`;
    }
  } else {
    content.textContent = option.text;
  }

  const optionsContainer = container.querySelector('.custom-select-options-global');
  optionsContainer.querySelectorAll('.custom-option-global').forEach((el, i) => {
    el.classList.toggle('active', i === select.selectedIndex);
  });
}

export function initAllCustomSelects() {
  document.querySelectorAll('select').forEach(updateCustomSelectOptions);
  
  if (!window.customSelectListenerAdded) {
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-container.open').forEach(container => setSelectOpen(container, false));
    });
    window.customSelectListenerAdded = true;
  }
}


export let currentContextMenuSiteId = null;
export let currentContextMenuGroupId = null;

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
    const menu = document.getElementById('contextMenu');
    
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
    
    let x = e.clientX;
    let y = e.clientY;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
    
    // adjust if it goes off bottom/right
    const rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    if (y + rect.height > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
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
    showConfirm('删除网站', `确定删除网站 "${link.title}" 吗？`, () => {
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
