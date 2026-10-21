import { saveWallpaper, clearWallpaper } from './wallpaper.js';
import { safeWebUrl, safeImageUrl } from './urls.js';
import { icon } from './icons.js';
import { appData, createTemporaryGroup, SEARCH_ENGINES, setActiveSpace, syncManager } from './storage.js';
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
export const spaceModal = document.getElementById('spaceModal');
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
  const settingsWereOpen = !settingsModal.classList.contains('hidden');
  modalOverlay.classList.add('hidden');
  siteModal.classList.add('hidden');
  groupModal.classList.add('hidden');
  settingsModal.classList.add('hidden');
  if (spaceModal) spaceModal.classList.add('hidden');
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
  document.getElementById('groupLinksPerRow').value = currentLinksPerRow === 'auto' ? '自动' : currentLinksPerRow + '个';
}

document.getElementById('decreaseLinksPerRow').addEventListener('click', () => {
  if (currentLinksPerRow === 'auto') currentLinksPerRow = 6;
  else if (currentLinksPerRow === 1) currentLinksPerRow = 'auto';
  else currentLinksPerRow--;
  updateLinksPerRowUI();
});

document.getElementById('increaseLinksPerRow').addEventListener('click', () => {
  if (currentLinksPerRow === 'auto') currentLinksPerRow = 1;
  else if (currentLinksPerRow === 6) currentLinksPerRow = 'auto';
  else currentLinksPerRow++;
  updateLinksPerRowUI();
});

export function openGroupModal(groupId = null, returnContext = null) {
  const form = document.getElementById('groupForm');
  form.reset();
  groupModalReturnContext = groupId ? null : returnContext;
  
  const isIconOnly = appData.settings.cardDisplayMode === 'icon-only';
  const stepperBtns = document.querySelectorAll('.stepper-btn');
  const stepperContainer = document.querySelector('.number-stepper');
  
  if (isIconOnly) {
    stepperBtns.forEach(btn => btn.disabled = true);
    stepperContainer.title = "纯图标状态下无法更改列数";
    stepperContainer.style.opacity = '0.5';
  } else {
    stepperBtns.forEach(btn => btn.disabled = false);
    stepperContainer.title = "";
    stepperContainer.style.opacity = '1';
  }

  if (groupId) {
    const group = appData.groups.find(g => g.id === groupId);
    document.getElementById('groupId').value = group.id;
    document.getElementById('groupName').value = group.name;
    currentLinksPerRow = group.linksPerRow || 'auto';
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
    });

    toggle.appendChild(input);
    toggle.appendChild(label);
    row.appendChild(identity);
    row.appendChild(toggle);
    container.appendChild(row);
  });
}

function formatDataSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function renderDataOverview() {
  const grid = document.getElementById('dataOverviewGrid');
  const summary = document.getElementById('dataOverviewSummary');
  if (!grid || !summary || !appData) return;

  const spaces = Array.isArray(appData.spaces) ? appData.spaces : [];
  const groups = spaces.length > 0
    ? spaces.flatMap(space => Array.isArray(space.groups) ? space.groups : [])
    : (Array.isArray(appData.groups) ? appData.groups : []);
  const links = groups.flatMap(group => Array.isArray(group.links) ? group.links : []);
  const items = [
    { label: '网站', value: links.length, color: 'var(--primary-color)' },
    { label: '分组', value: groups.length, color: '#F59E0B' },
    { label: '空间', value: spaces.length, color: '#10B981' }
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const dataSize = new Blob([JSON.stringify(appData)]).size;

  summary.textContent = `共 ${total} 项记录 · ${syncManager.mode === 'local' ? '本地存储' : 'Supabase 云端'} ${formatDataSize(dataSize)}`;
  grid.innerHTML = '';

  items.forEach(item => {
    const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const card = document.createElement('article');
    card.className = 'data-overview-card';
    card.style.setProperty('--data-accent', item.color);
    card.style.setProperty('--data-ratio', `${percent}%`);

    const header = document.createElement('div');
    header.className = 'data-overview-card-header';

    const label = document.createElement('div');
    label.className = 'data-overview-label';
    const dot = document.createElement('span');
    dot.className = 'data-overview-dot';
    const labelText = document.createElement('span');
    labelText.textContent = item.label;
    label.appendChild(dot);
    label.appendChild(labelText);

    const percentage = document.createElement('span');
    percentage.className = 'data-overview-percent';
    percentage.textContent = `${percent}%`;
    header.appendChild(label);
    header.appendChild(percentage);

    const value = document.createElement('strong');
    value.className = 'data-overview-value';
    value.textContent = item.value;

    const track = document.createElement('div');
    track.className = 'data-overview-track';
    const fill = document.createElement('div');
    fill.className = 'data-overview-fill';
    track.appendChild(fill);

    card.appendChild(header);
    card.appendChild(value);
    card.appendChild(track);
    grid.appendChild(card);
  });
}

// Settings Modal
export function openSettingsModal(panelId) {
  const wasHidden = settingsModal.classList.contains('hidden');
  if (typeof panelId === 'string') selectSettingsPanel(panelId);
  document.getElementById('compactModeToggle').checked = appData.settings.compactMode;
  document.getElementById('dockTabHintToggle').checked = appData.settings.showDockTabHint !== false;
  document.getElementById('dockEditButtonToggle').checked = appData.settings.showDockEditButton !== false;
  renderSearchEngineSettings();
  renderDataOverview();

  const accentColorInput = document.getElementById('accentColorInput');
  const accentColor = appData.settings.accentColor || '#6366f1';
  accentColorInput.value = accentColor;

  const settingSelectValues = {
    openModeSelect: appData.settings.openLinksInNewTab ? 'new-tab' : 'current-tab',
    themeSelect: appData.settings.theme || 'system',
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
      document.getElementById('settingsBtn').focus();
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

function selectSettingsPanel(panelId) {
  document.querySelectorAll('.settings-nav-btn').forEach(button => {
    const active = button.dataset.settingsPanel === panelId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelectorAll('.settings-section').forEach(panel => {
    panel.classList.toggle('active', panel.id === panelId);
  });
  if (panelId === 'settingsData') renderDataOverview();
}

document.querySelectorAll('.settings-nav-btn').forEach(button => {
  button.addEventListener('click', () => selectSettingsPanel(button.dataset.settingsPanel));
});
document.addEventListener('simtab-sync', renderDataOverview);

document.getElementById('dockTabHintToggle').addEventListener('change', (e) => {
  appData.settings.showDockTabHint = e.target.checked;
  syncManager.saveData();
  applySettings();
});

document.getElementById('dockEditButtonToggle').addEventListener('change', (e) => {
  appData.settings.showDockEditButton = e.target.checked;
  syncManager.saveData();
  applySettings();
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

document.getElementById('wallpaperUpload').addEventListener('change', async (e) => {
  const input = e.target;
  const file = input.files[0];
  input.disabled = true;
  try {
    if (!file) return;
    await saveWallpaper(file);
    appData.settings.wallpaper = null;
    await syncManager.saveData();
    applySettings();
  } catch (error) {
    alert(`壁纸保存失败：${error.message}`);
  } finally { input.value = ''; input.disabled = false; }
});

document.getElementById('clearWallpaperBtn').addEventListener('click', async () => {
  try {
    await clearWallpaper();
    appData.settings.wallpaper = null;
    await syncManager.saveData();
    applySettings();
  } catch (error) { alert(`移除壁纸失败：${error.message}`); }
});

document.getElementById('exportBtnNew').addEventListener('click', () => syncManager.exportData());
document.getElementById('importFileNew').addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    syncManager.importData(e.target.files[0]);
    e.target.value = ''; // reset file input
    closeAllModals();
  }
});

// Space Modal
let spaceEditorDraft = [];
let draggedSpaceId = null;
let draggedSpaceElement = null;

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function syncSpaceDraftOrder(container) {
  const spacesById = new Map(spaceEditorDraft.map(space => [space.id, space]));
  spaceEditorDraft = Array.from(container.querySelectorAll('.space-editor-item'))
    .map(item => spacesById.get(item.dataset.id))
    .filter(Boolean);
}

function animateSpaceEditorShift(container, previousRects) {
  container.querySelectorAll('.space-editor-item:not(.dragging)').forEach(item => {
    const previous = previousRects.get(item.dataset.id);
    if (!previous) return;
    const current = item.getBoundingClientRect();
    const deltaY = previous.top - current.top;
    if (Math.abs(deltaY) < 1) return;

    item.getAnimations().forEach(animation => animation.cancel());
    item.animate(
      [
        { transform: `translateY(${deltaY}px)` },
        { transform: 'translateY(0)' }
      ],
      {
        duration: 190,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    );
  });
}

function renderSpaceEditor() {
  const container = document.getElementById('spaceEditorList');
  if (!container) return;

  container.innerHTML = '';
  spaceEditorDraft.forEach(space => {
    const item = document.createElement('div');
    item.className = 'space-editor-item';
    item.dataset.id = space.id;
    item.innerHTML = `
      <button type="button" class="space-icon-btn space-drag-handle" title="按住拖动排序" aria-label="按住拖动排序" draggable="true">
        ${icon('menu', 17)}
      </button>
      <input type="text" value="${escapeAttr(space.name)}" aria-label="空间名称">
      <button type="button" class="space-icon-btn danger delete-space" title="删除空间" aria-label="删除空间" ${spaceEditorDraft.length <= 1 ? 'disabled' : ''}>
        ${icon('x', 16)}
      </button>
    `;

    const input = item.querySelector('input');
    input.addEventListener('input', () => {
      space.name = input.value;
    });

    const dragHandle = item.querySelector('.space-drag-handle');
    dragHandle.addEventListener('dragstart', (e) => {
      draggedSpaceId = space.id;
      draggedSpaceElement = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', space.id);
      e.dataTransfer.setDragImage(item, 24, Math.round(item.offsetHeight / 2));
    });

    dragHandle.addEventListener('dragend', () => {
      draggedSpaceId = null;
      draggedSpaceElement = null;
      item.classList.remove('dragging');
    });

    item.querySelector('.delete-space').addEventListener('click', () => {
      if (spaceEditorDraft.length <= 1) return;
      const index = spaceEditorDraft.findIndex(item => item.id === space.id);
      if (index !== -1) spaceEditorDraft.splice(index, 1);
      renderSpaceEditor();
    });

    container.appendChild(item);
  });

  container.ondragover = (e) => {
    if (!draggedSpaceId || !draggedSpaceElement) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const siblings = Array.from(container.querySelectorAll('.space-editor-item:not(.dragging)'));
    const nextItem = siblings.find(item => {
      const rect = item.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    }) || null;
    const isAlreadyPlaced = nextItem
      ? draggedSpaceElement.nextElementSibling === nextItem
      : draggedSpaceElement === container.lastElementChild;
    if (isAlreadyPlaced) return;

    const previousRects = new Map(
      siblings.map(item => [item.dataset.id, item.getBoundingClientRect()])
    );
    container.insertBefore(draggedSpaceElement, nextItem);
    syncSpaceDraftOrder(container);
    animateSpaceEditorShift(container, previousRects);
  };

  container.ondrop = (e) => {
    if (!draggedSpaceId) return;
    e.preventDefault();
    syncSpaceDraftOrder(container);
  };
}

function openSpaceModal() {
  spaceEditorDraft = appData.spaces.map(space => ({
    id: space.id,
    name: space.name,
    groups: space.groups
  }));
  renderSpaceEditor();
  showModal(spaceModal);
}

document.getElementById('spaceEditBtn')?.addEventListener('click', openSpaceModal);

document.getElementById('addSpaceBtn')?.addEventListener('click', () => {
  spaceEditorDraft.push({
    id: generateId(),
    name: `空间 ${spaceEditorDraft.length + 1}`,
    groups: [createTemporaryGroup(spaceEditorDraft.length)]
  });
  renderSpaceEditor();
});

document.getElementById('cancelSpaceBtn')?.addEventListener('click', closeAllModals);

document.getElementById('saveSpaceBtn')?.addEventListener('click', () => {
  const nextSpaces = spaceEditorDraft
    .map((space, index) => ({
      ...space,
      name: space.name.trim() || `空间 ${index + 1}`
    }))
    .filter(space => space.name);

  if (nextSpaces.length === 0) return;

  appData.spaces = nextSpaces;
  if (!appData.spaces.some(space => space.id === appData.activeSpaceId)) {
    appData.activeSpaceId = appData.spaces[0].id;
  }
  setActiveSpace(appData.activeSpaceId);
  syncManager.saveData();
  render();
  closeAllModals();
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

export function updateCustomSelectOptions(select) {
  if (select.dataset.native === 'true') return;
  let container = select.nextElementSibling;
  if (!container || !container.classList.contains('custom-select-container')) {
    container = document.createElement('div');
    container.className = 'custom-select-container';
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger-global';
    trigger.innerHTML = `<div class="selected-content"></div>${icon('chevron-down', 14)}`;
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options-global hidden';

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-options-global').forEach(el => {
        if (el !== optionsContainer) {
          el.classList.add('hidden');
          el.closest('.custom-select-container')?.classList.remove('open');
        }
      });
      optionsContainer.classList.toggle('hidden');
      container.classList.toggle('open', !optionsContainer.classList.contains('hidden'));
      if (select.id === 'searchEngineSelect') {
        document.querySelector('.search-container')?.classList.toggle(
          'engine-select-open',
          !optionsContainer.classList.contains('hidden')
        );
      }
    });

    container.appendChild(trigger);
    container.appendChild(optionsContainer);
    select.style.display = 'none';
    select.parentNode.insertBefore(container, select.nextSibling);

    select.addEventListener('change', () => updateCustomSelectTrigger(select));
  }

  const optionsContainer = container.querySelector('.custom-select-options-global');
  optionsContainer.innerHTML = '';
  
  Array.from(select.options).forEach((option, index) => {
    const optDiv = document.createElement('div');
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
      optionsContainer.classList.add('hidden');
      container.classList.remove('open');
      if (select.id === 'searchEngineSelect') {
        document.querySelector('.search-container')?.classList.remove('engine-select-open');
        document.getElementById('searchInput').focus();
      }
    });
    optionsContainer.appendChild(optDiv);
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
      document.querySelectorAll('.custom-select-options-global').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.custom-select-container.open').forEach(el => el.classList.remove('open'));
      document.querySelector('.search-container')?.classList.remove('engine-select-open');
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


