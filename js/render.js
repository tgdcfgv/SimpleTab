import { getWallpaperUrl } from './wallpaper.js';
import { icon, siteIconFallback } from './icons.js';
import { appData, SEARCH_ENGINES, setActiveSpace, syncManager } from './storage.js';
import { getFaviconUrl, escapeHTML } from './utils.js';
import { draggedItem, draggedItemType, handleDragEnd, handleDragLeaveGroup, handleDragOver, handleDragOverGroup, handleDragStart, handleDrop, handleDropOnGroup, handleGroupDragStart, moveGroupTo } from './drag.js';
import { openGroupModal, showConfirm, updateCustomSelectOptions, updateCustomSelectTrigger } from './modals.js';


export function render() {
  const container = document.getElementById('groupsContainer');
  document.dispatchEvent(new Event('simtab-render'));
  const openLinksInNewTab = !!appData.settings.openLinksInNewTab;
  const linkTargetAttrs = openLinksInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
  container.innerHTML = '';
  renderSpaceDock();

  if (appData.groups.length === 0) {
    container.style.display = 'none';
    return;
  } else {
    container.style.display = 'grid';
  }

  const columnCount = getColumnCount(container);
  renderedColumnCount = columnCount;
  const cols = Array.from({ length: columnCount }, () => document.createElement('div'));
  cols.forEach((c, i) => {
    c.className = 'group-col';
    c.dataset.colIndex = i;
    c.addEventListener('dragover', (e) => {
      if (draggedItemType !== 'group') return;
      e.preventDefault();
      c.classList.add('drag-over-col');
    });
    c.addEventListener('dragleave', () => c.classList.remove('drag-over-col'));
    c.addEventListener('drop', (e) => {
      if (draggedItemType !== 'group') return;
      e.preventDefault();
      c.classList.remove('drag-over-col');
      if (e.target === c || e.target.classList.contains('group-col')) {
        moveGroupTo(draggedItem.dataset.id, i, null);
      }
    });
  });

  appData.groups.forEach((g, i) => {
    if (!Number.isInteger(g.column) || g.column < 0) {
      g.column = i % columnCount;
      g.columnCount = columnCount;
    }
  });

  appData.groups.forEach((group, index) => {
    const card = document.createElement('div');
    card.className = `group-card ${group.collapsed ? 'is-collapsed' : ''}`;
    card.dataset.id = group.id;
    card.draggable = true;

    card.addEventListener('dragstart', handleGroupDragStart);

    card.addEventListener('dragend', handleDragEnd);

    card.addEventListener('dragover', (e) => {
      if (draggedItemType !== 'group' || draggedItem === card) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = card.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        card.classList.add('drag-over-top');
        card.classList.remove('drag-over-bottom');
      } else {
        card.classList.add('drag-over-bottom');
        card.classList.remove('drag-over-top');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', (e) => {
      if (draggedItemType !== 'group' || draggedItem === card) return;
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('drag-over-top', 'drag-over-bottom');
      const sourceId = draggedItem.dataset.id;
      const targetColIndex = parseInt(card.closest('.group-col').dataset.colIndex);
      const rect = card.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      moveGroupTo(sourceId, targetColIndex, card.dataset.id, e.clientY < mid ? 'before' : 'after');
    });

    // Header
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <div class="group-title-container">
        ${icon('chevron-down', 16, 'fold-icon', `transform: rotate(${group.collapsed ? '-90deg' : '0'});`)}
        <span class="group-title">${escapeHTML(group.name)}</span>
        <div class="group-collapsed-icons">
          ${group.links.slice(0, 6).map(link => {
            const iconSrc = link.customIcon || getFaviconUrl(link.url);
            return `
            <a href="${escapeHTML(link.url)}" class="collapsed-icon-link" title="${escapeHTML(link.title)}"${linkTargetAttrs}>
              <img src="${escapeHTML(iconSrc)}" alt="" loading="lazy">
            </a>
            `;
          }).join('')}
        </div>
      </div>
      <div class="group-actions">
        <button class="group-action-btn edit-group-btn" title="编辑" data-id="${escapeHTML(group.id)}">
          ${icon('square-pen', 14)}
        </button>
        <button class="group-action-btn delete-group-btn" title="删除" data-id="${escapeHTML(group.id)}">
          ${icon('trash', 14)}
        </button>
      </div>
    `;

    // Toggle collapse
    header.querySelector('.group-title-container').addEventListener('click', (e) => {
      if (e.target.closest('.collapsed-icon-link')) return;
      group.collapsed = !group.collapsed;
      syncManager.saveData();
      
      const icon = header.querySelector('.fold-icon');
      icon.style.transform = group.collapsed ? 'rotate(-90deg)' : 'rotate(0)';
      
      const wrapper = card.querySelector('.sites-grid-wrapper');
      if (group.collapsed) {
        wrapper.classList.add('collapsed');
        card.classList.add('is-collapsed');
      } else {
        wrapper.classList.remove('collapsed');
        card.classList.remove('is-collapsed');
      }
    });

    // Group Actions
    header.querySelector('.edit-group-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openGroupModal(group.id);
    });
    header.querySelector('.delete-group-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm('删除分组', `确定要删除分组 "${escapeHTML(group.name)}" 及其包含的所有网站吗？`, () => {
        const groupIndex = appData.groups.findIndex(g => g.id === group.id);
        if (groupIndex !== -1) {
          appData.groups.splice(groupIndex, 1);
        }
        syncManager.saveData();
        render();
      });
    });

    card.appendChild(header);

    // Links Grid Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `sites-grid-wrapper ${group.collapsed ? 'collapsed' : ''}`;

    const grid = document.createElement('div');
    grid.className = 'sites-grid';
    grid.dataset.groupId = group.id;
    if (group.linksPerRow && group.linksPerRow !== 'auto') {
      grid.style.gridTemplateColumns = `repeat(${group.linksPerRow}, 1fr)`;
    }

    if (group.links.length === 0) {
      grid.innerHTML = `<div class="empty-group-state">拖拽网站到此处</div>`;
    } else {
      group.links.forEach(link => {
        const siteBtn = document.createElement('a');
        siteBtn.className = 'site-btn';
        siteBtn.href = link.url;
        if (openLinksInNewTab) {
          siteBtn.target = '_blank';
          siteBtn.rel = 'noopener noreferrer';
        }
        siteBtn.draggable = true;
        siteBtn.dataset.id = link.id;
        
        const iconSrc = link.customIcon || getFaviconUrl(link.url);
        siteBtn.innerHTML = `
          <img src="${escapeHTML(iconSrc)}" alt="" loading="lazy">
          <span class="site-title" title="${escapeHTML(link.title)}">${escapeHTML(link.title)}</span>
        `;

        siteBtn.querySelector('img').addEventListener('error', event => { event.target.src = siteIconFallback; }, { once: true });
        siteBtn.addEventListener('dragstart', handleDragStart);
        siteBtn.addEventListener('dragover', handleDragOver);
        siteBtn.addEventListener('drop', handleDrop);
        siteBtn.addEventListener('dragend', handleDragEnd);

        grid.appendChild(siteBtn);
      });
    }

    grid.addEventListener('dragover', handleDragOverGroup);
    grid.addEventListener('dragleave', handleDragLeaveGroup);
    grid.addEventListener('drop', handleDropOnGroup);

    wrapper.appendChild(grid);
    card.appendChild(wrapper);
    
    const column = (group.columnCount || 3) === columnCount
      ? group.column % columnCount : index % columnCount;
    cols[column].appendChild(card);
  });

  cols.forEach(col => {
    container.appendChild(col);
  });
}

function getSpaceDockIcon(space, index) {
  const iconKey = space.id === 'space-home' || space.name === '主页'
    ? 'home'
    : space.id === 'space-work' || space.name === '工作'
      ? 'work'
      : space.id === 'space-favorites' || space.name === '收藏'
        ? 'favorites'
        : index === 0 ? 'home' : index === 1 ? 'work' : index === 2 ? 'favorites' : 'space';

  const icons = { home: 'house', work: 'briefcase-business', favorites: 'star', space: 'grid-2x2' };
  return icon(icons[iconKey], 19);
}

export function renderSpaceDock() {
  const dockList = document.getElementById('spaceDockList');
  if (!dockList || !appData?.spaces) return;

  dockList.innerHTML = '';
  appData.spaces.forEach((space, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.spaceId = space.id;
    btn.className = `space-dock-btn ${space.id === appData.activeSpaceId ? 'active' : ''}`;
    btn.innerHTML = getSpaceDockIcon(space, index);
    btn.title = space.name;
    btn.setAttribute('aria-label', space.name);
    btn.addEventListener('click', () => {
      if (space.id === appData.activeSpaceId) return;
      setActiveSpace(space.id);
      syncManager.saveData();
      render();
    });
    dockList.appendChild(btn);
  });
  updateDockVisibility();
}

export function switchToNextSpace() {
  if (!appData?.spaces?.length) return;
  const currentIndex = appData.spaces.findIndex(space => space.id === appData.activeSpaceId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % appData.spaces.length;
  setActiveSpace(appData.spaces[nextIndex].id);
  syncManager.saveData();
  render();
}

export function initSpaceShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!syncManager.ready) return;

    const modalOverlay = document.getElementById('modalOverlay');
    const isModalOpen = modalOverlay && !modalOverlay.classList.contains('hidden');
    const isEditable = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (isModalOpen || isEditable) return;

    e.preventDefault();
    switchToNextSpace();
  });
}


export function getContrastForeground(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') return '#FFFFFF';
  let hex = hexColor.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#FFFFFF';
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#FFFFFF';
  const toLinear = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.35 ? '#0F172A' : '#FFFFFF';
}

let wallpaperRender = 0;

export function updateDockVisibility() {
  if (!appData) return;
  const settings = appData.settings;
  const buttons = { accountBtn: 'showDockAccountButton', settingsBtn: 'showDockSettingsButton', addGroupBtn: 'showDockAddGroupButton', addSiteBtn: 'showDockAddSiteButton', appStoreBtn: 'showDockStoreButton', spaceEditBtn: 'showDockEditButton', spaceTabHint: 'showDockTabHint' };
  for (const [id, key] of Object.entries(buttons)) {
    document.getElementById(id).hidden = key === 'showDockStoreButton' ? settings[key] !== true : settings[key] === false;
  }
  const hiddenSpaces = settings.hiddenDockSpaces || [];
  document.querySelectorAll('.space-dock-btn').forEach(button => { button.hidden = hiddenSpaces.includes(button.dataset.spaceId); });
  const actions = document.querySelector('.dock-actions');
  const spaces = document.querySelector('.space-switcher');
  actions.hidden = !actions.querySelector('button:not([hidden])');
  spaces.hidden = !spaces.querySelector('button:not([hidden])');
  document.querySelector('.dock-divider').hidden = actions.hidden || spaces.hidden;
  document.getElementById('spaceDock').hidden = settings.dockEnabled === false || (actions.hidden && spaces.hidden);
  document.getElementById('settingsFallbackBtn').hidden = settings.dockEnabled !== false && settings.showDockSettingsButton !== false;
}

export function applySettings() {
  const wallpaperRequest = ++wallpaperRender;
  document.documentElement.dataset.compact = appData.settings.compactMode;
  document.documentElement.dataset.cardMode = appData.settings.cardDisplayMode || 'icon-text';
  document.documentElement.dataset.dockPosition = appData.settings.dockEnabled === false ? 'hidden' : (appData.settings.dockPosition || 'bottom');
  updateDockVisibility();
  document.documentElement.style.setProperty('--pure-icon-size', (appData.settings.iconSize || 24) + 'px');
  const accent = appData.settings.accentColor || '#6366f1';
  const accentFg = getContrastForeground(accent);
  document.documentElement.style.setProperty('--accent-color', accent);
  document.documentElement.style.setProperty('--accent-fg', accentFg);
  document.documentElement.style.setProperty('--primary-color', accent);
  document.documentElement.style.setProperty('--primary-fg', accentFg);

  const tabHint = document.getElementById('spaceTabHint');
  const editButton = document.getElementById('spaceEditBtn');
  if (tabHint) tabHint.hidden = appData.settings.showDockTabHint === false;
  if (editButton) editButton.hidden = appData.settings.showDockEditButton === false;
  
  let theme = appData.settings.theme;
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;

  const engineSelect = document.getElementById('searchEngineSelect');
  if (engineSelect) {
    const enabledIds = appData.settings.enabledSearchEngines || ['bing', 'baidu'];
    const enabledEngines = SEARCH_ENGINES.filter(engine => enabledIds.includes(engine.id));
    engineSelect.innerHTML = '';
    enabledEngines.forEach(engine => {
      const option = document.createElement('option');
      option.value = engine.id;
      option.textContent = engine.name;
      option.dataset.url = engine.homeUrl;
      engineSelect.appendChild(option);
    });
    if (!enabledIds.includes(appData.settings.searchEngine)) {
      appData.settings.searchEngine = enabledEngines[0]?.id || 'bing';
    }
    engineSelect.value = appData.settings.searchEngine;
    if (window.customSelectListenerAdded) {
      updateCustomSelectOptions(engineSelect);
    }
  }

  if (appData.settings.wallpaper && !appData.settings.wallpaper.startsWith('data:')) {
    document.body.style.backgroundImage = `url(${JSON.stringify(appData.settings.wallpaper)})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  } else {
    document.body.style.backgroundImage = theme === 'dark'
      ? 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.035) 0%, transparent 52%)'
      : 'radial-gradient(circle at 50% 0%, rgba(125, 211, 252, 0.05) 0%, transparent 50%)';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
  }
  getWallpaperUrl().then(url => {
    if (!url || wallpaperRequest !== wallpaperRender) return;
    document.body.style.backgroundImage = `url(${JSON.stringify(url)})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  }).catch(error => console.warn('无法读取本机壁纸', error));
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (appData?.settings.theme === 'system') {
    applySettings();
  }
});



let renderedColumnCount = 0;
function getColumnCount(container) {
  return getComputedStyle(container).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
}
const groupContainer = document.getElementById('groupsContainer');
new ResizeObserver(() => {
  if (appData && !draggedItem && getColumnCount(groupContainer) !== renderedColumnCount) render();
}).observe(groupContainer);
