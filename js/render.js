import { appData, SEARCH_ENGINES, setActiveSpace, syncManager } from './storage.js';
import { getFaviconUrl } from './utils.js';
import { draggedItem, draggedItemType, handleDragEnd, handleDragLeaveGroup, handleDragOver, handleDragOverGroup, handleDragStart, handleDrop, handleDropOnGroup, handleGroupDragStart, moveGroupTo } from './drag.js';
import { openGroupModal, showConfirm, updateCustomSelectOptions, updateCustomSelectTrigger } from './modals.js';

const siteIconFallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5YWEwYTYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiPjwvY2lyY2xlPjxsaW5lIHgxPSIxMiIgeTE9IjgiIHgyPSIxMiIgeTI9IjEyIj48L2xpbmU+PGxpbmUgeDE9IjEyIiB5MT0iMTYiIHgyPSIxMi4wMSIgeTI9IjE2Ij48L2xpbmU+PC9zdmc+';

export function render() {
  const container = document.getElementById('groupsContainer');
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

  const cols = [
    document.createElement('div'),
    document.createElement('div'),
    document.createElement('div')
  ];
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

  appData.groups.forEach((g, i) => { if (g.column === undefined) g.column = i % 3; });

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
        <svg class="fold-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${group.collapsed ? '-90deg' : '0'});">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span class="group-title">${group.name}</span>
        <div class="group-collapsed-icons">
          ${group.links.slice(0, 6).map(link => {
            const iconSrc = link.customIcon || getFaviconUrl(link.url);
            return `
            <a href="${link.url}" class="collapsed-icon-link" title="${link.title}"${linkTargetAttrs}>
              <img src="${iconSrc}" alt="" loading="lazy">
            </a>
            `;
          }).join('')}
        </div>
      </div>
      <div class="group-actions">
        <button class="group-action-btn edit-group-btn" title="编辑" data-id="${group.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="group-action-btn delete-group-btn" title="删除" data-id="${group.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
      showConfirm('删除分组', `确定要删除分组 "${group.name}" 及其包含的所有网站吗？`, () => {
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
          <img src="${iconSrc}" alt="" loading="lazy" onerror="this.src='${siteIconFallback}'">
          <span class="site-title" title="${link.title}">${link.title}</span>
        `;

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
    
    cols[group.column].appendChild(card);
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

  const icons = {
    home: '<path d="M3 10.8 12 3l9 7.8"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9.5 21v-6h5v6"></path>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path><path d="M10 12v2h4v-2"></path>',
    favorites: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3z"></path>',
    space: '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect>'
  };
  return `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[iconKey]}</svg>`;
}

export function renderSpaceDock() {
  const dockList = document.getElementById('spaceDockList');
  if (!dockList || !appData?.spaces) return;

  dockList.innerHTML = '';
  appData.spaces.forEach((space, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
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

    const modalOverlay = document.getElementById('modalOverlay');
    const isModalOpen = modalOverlay && !modalOverlay.classList.contains('hidden');
    const isEditable = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (isModalOpen || isEditable) return;

    e.preventDefault();
    switchToNextSpace();
  });
}


export function applySettings() {
  document.documentElement.dataset.compact = appData.settings.compactMode;
  document.documentElement.dataset.cardMode = appData.settings.cardDisplayMode || 'icon-text';
  document.documentElement.dataset.dockPosition = appData.settings.dockPosition || 'left';
  document.documentElement.style.setProperty('--pure-icon-size', (appData.settings.iconSize || 24) + 'px');
  document.documentElement.style.setProperty('--accent-color', appData.settings.accentColor || '#6366f1');

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
    const enabledIds = appData.settings.enabledSearchEngines || ['google', 'bing'];
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
      appData.settings.searchEngine = enabledEngines[0]?.id || 'google';
    }
    engineSelect.value = appData.settings.searchEngine;
    if (window.customSelectListenerAdded) {
      updateCustomSelectOptions(engineSelect);
    }
  }

  if (appData.settings.wallpaper) {
    document.body.style.backgroundImage = `url(${appData.settings.wallpaper})`;
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
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (appData.settings.theme === 'system') {
    applySettings();
  }
});


