import { appData, syncManager } from './storage.js';
import { draggedItem, draggedItemType, clearExternalDropState, handleDockDragStart, handleDragEnd } from './drag.js';
import { render } from './render.js';
import { extractDroppedLink, safeWebUrl } from './urls.js';
import { loadSiteIcon } from './site-icons.js';
import { showConfirm, showToast } from './modals.js';

export const DOCK_ACTION_SETTINGS = {
  accountBtn: 'showDockAccountButton', settingsBtn: 'showDockSettingsButton',
  addGroupBtn: 'showDockAddGroupButton', addSiteBtn: 'showDockAddSiteButton',
  appStoreBtn: 'showDockStoreButton', spaceEditBtn: 'showDockEditButton', spaceTabHint: 'showDockTabHint'
};
let refreshDock = () => {};

export function applyDockOrder() {
  const list = document.getElementById('dockItems');
  const defaults = ['action:spaceTabHint', ...appData.spaces.map(space => `space:${space.id}`),
    'action:spaceEditBtn', ...(appData.settings.dockLinks || []).map(link => `site:${link.id}`),
    ...Object.keys(DOCK_ACTION_SETTINGS).map(id => `action:${id}`)];
  const order = [...new Set([...(appData.settings.dockOrder || []), ...defaults])];
  for (const item of list.children) {
    item.dataset.dockKey = item.dataset.spaceId ? `space:${item.dataset.spaceId}`
      : item.dataset.dockId ? `site:${item.dataset.dockId}` : `action:${item.id}`;
    item.draggable = true;
  }
  const items = Array.from(list.children).sort((a, b) => order.indexOf(a.dataset.dockKey) - order.indexOf(b.dataset.dockKey));
  list.append(...items);
}

export function renderDockSites() {
  const list = document.getElementById('dockItems');
  if (!list) return;
  list.querySelectorAll('.dock-site-btn').forEach(item => item.remove());
  for (const link of appData.settings.dockLinks || []) {
    const anchor = document.createElement('a');
    anchor.className = 'dock-site-btn dock-action-btn';
    anchor.href = link.url;
    anchor.dataset.dockId = link.id;
    anchor.title = `${link.title}（拖动排序，拖出移除或拖回分组）`;
    anchor.setAttribute('aria-label', link.title);
    if (appData.settings.openLinksInNewTab) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    const image = document.createElement('img');
    anchor.append(image);
    loadSiteIcon(image, link);
    const remove = () => showConfirm('从程序坞移除', `移除「${link.title}」的快捷图标？`, () => {
      appData.settings.dockLinks = appData.settings.dockLinks.filter(item => item.id !== link.id);
      appData.settings.dockOrder = (appData.settings.dockOrder || []).filter(key => key !== `site:${link.id}`);
      syncManager.saveData();
      refreshDock();
    });
    anchor.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      remove();
    });
    anchor.addEventListener('keydown', event => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        remove();
      }
    });
    list.append(anchor);
  }
}

function isDockDrag() {
  return draggedItemType === 'dock-site' || draggedItemType === 'dock-item';
}

export function initDockDrop(onChange) {
  refreshDock = onChange;
  const dock = document.getElementById('spaceDock');
  const list = document.getElementById('dockItems');
  const removeHint = document.createElement('div');
  removeHint.id = 'dockRemoveHint';
  removeHint.className = 'dock-remove-hint';
  removeHint.hidden = true;
  removeHint.textContent = '拖出程序坞移除';
  removeHint.setAttribute('role', 'status');
  document.body.append(removeHint);
  const marker = document.createElement('div');
  marker.className = 'dock-insert-marker';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  document.body.append(marker);

  const ready = () => syncManager.ready && !document.querySelector('.app-container')?.inert &&
    !document.querySelector('dialog[open]') && document.getElementById('modalOverlay').classList.contains('hidden');
  const targetGroup = event => {
    if (draggedItemType !== 'dock-site') return null;
    const card = event.target instanceof Element ? event.target.closest('.group-card') : null;
    return appData.groups.find(group => group.id === card?.dataset.id);
  };
  const cleanup = () => {
    removeHint.hidden = true;
    marker.hidden = true;
    dock.classList.remove('dock-drop-target');
    list.querySelector('.dock-item-dragging')?.classList.remove('dock-item-dragging');
    clearExternalDropState();
  };
  const placeHint = () => {
    const rect = dock.getBoundingClientRect();
    const bottom = document.documentElement.dataset.dockPosition === 'bottom';
    removeHint.style.left = `${bottom ? rect.left + rect.width / 2 : (rect.left < innerWidth / 2 ? rect.right + 16 : rect.left - 16)}px`;
    removeHint.style.top = `${bottom ? rect.top - 16 : rect.top + rect.height / 2}px`;
    removeHint.dataset.position = bottom ? 'bottom' : (rect.left < innerWidth / 2 ? 'left' : 'right');
  };
  const insertion = event => {
    const horizontal = document.documentElement.dataset.dockPosition === 'bottom';
    const items = Array.from(list.children).filter(item => !item.hidden && item !== draggedItem && item.getClientRects().length);
    const before = items.find(item => {
      const rect = item.getBoundingClientRect();
      return horizontal ? event.clientX < rect.left + rect.width / 2 : event.clientY < rect.top + rect.height / 2;
    });
    const edge = before || items.at(-1);
    if (edge) {
      const rect = edge.getBoundingClientRect();
      marker.dataset.axis = horizontal ? 'horizontal' : 'vertical';
      marker.style.left = `${horizontal ? (before ? rect.left - 4 : rect.right + 4) : rect.left}px`;
      marker.style.top = `${horizontal ? rect.top : (before ? rect.top - 4 : rect.bottom + 4)}px`;
      marker.style.width = `${horizontal ? 2 : rect.width}px`;
      marker.style.height = `${horizontal ? rect.height : 2}px`;
      marker.hidden = false;
    }
    return before?.dataset.dockKey || null;
  };
  dock.addEventListener('dragstart', event => {
    const item = event.target instanceof Element ? event.target.closest('[data-dock-key]') : null;
    if (!item || !ready()) { event.preventDefault(); return; }
    // Use the browser's native drag image and move cursor.
    handleDockDragStart({ currentTarget: item, dataTransfer: event.dataTransfer, stopPropagation: () => event.stopPropagation() });
    removeHint.textContent = '拖出程序坞移除';
    removeHint.classList.remove('is-removing');
    placeHint();
    removeHint.hidden = false;
    requestAnimationFrame(() => { if (draggedItem === item) item.classList.add('dock-item-dragging'); });
  });
  document.addEventListener('dragend', () => {
    cleanup();
    if (isDockDrag()) handleDragEnd();
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') cleanup(); });
  window.addEventListener('blur', cleanup);

  // A dock drag may reorder, return a website to a group, or hide an item outside the dock.
  for (const type of ['dragenter', 'dragover']) {
    document.addEventListener(type, event => {
      if (!isDockDrag() || !ready()) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      clearExternalDropState();
      placeHint();
      removeHint.hidden = false;
      const inside = dock.contains(event.target);
      const group = inside ? null : targetGroup(event);
      marker.hidden = true;
      removeHint.classList.toggle('is-removing', !inside && !group);
      removeHint.textContent = !inside && !group ? '松开移除' : '拖出程序坞移除';
      if (inside) insertion(event);
      if (group) event.target.closest('.group-card').classList.add('external-drop-target');
    }, true);
  }
  document.addEventListener('drop', event => {
    if (!isDockDrag() || !ready()) return;
    event.preventDefault();
    event.stopPropagation();
    const item = draggedItem;
    const key = item.dataset.dockKey;
    if (dock.contains(event.target)) {
      const before = insertion(event);
      const keys = Array.from(list.children, child => child.dataset.dockKey).filter(value => value !== key);
      const index = before ? keys.indexOf(before) : keys.length;
      keys.splice(index < 0 ? keys.length : index, 0, key);
      appData.settings.dockOrder = keys;
    } else {
      const group = targetGroup(event);
      if (item.dataset.dockId) {
        const link = appData.settings.dockLinks.find(link => link.id === item.dataset.dockId);
        if (group && link && !group.links.some(existing => safeWebUrl(existing.url) === link.url)) {
          group.links.push({ ...link, id: `link-${crypto.randomUUID()}` });
        }
        appData.settings.dockLinks = appData.settings.dockLinks.filter(link => link.id !== item.dataset.dockId);
        appData.settings.dockOrder = (appData.settings.dockOrder || []).filter(value => value !== key);
      } else if (item.dataset.spaceId) {
        appData.settings.hiddenDockSpaces = [...new Set([...(appData.settings.hiddenDockSpaces || []), item.dataset.spaceId])];
      } else {
        appData.settings[DOCK_ACTION_SETTINGS[item.id]] = false;
      }
      if (!group) showToast('已从程序坞移除');
    }
    cleanup();
    handleDragEnd();
    syncManager.saveData();
    render();
  }, true);

  const accepts = event => {
    if (!ready()) return false;
    if (draggedItemType) return draggedItemType === 'site';
    const types = Array.from(event.dataTransfer?.types || []);
    return !types.includes('Files') && types.some(type => ['text/uri-list', 'text/x-moz-url', 'text/html', 'text/plain'].includes(type));
  };
  for (const type of ['dragenter', 'dragover']) {
    dock.addEventListener(type, event => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = draggedItemType === 'site' ? 'move' : 'copy';
      clearExternalDropState();
      dock.classList.add('dock-drop-target');
      insertion(event);
    });
  }
  dock.addEventListener('dragleave', event => {
    if (!dock.contains(event.relatedTarget)) {
      dock.classList.remove('dock-drop-target');
      marker.hidden = true;
    }
  });
  dock.addEventListener('drop', event => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const before = insertion(event);
    cleanup();
    const link = draggedItemType === 'site'
      ? appData.groups.flatMap(group => group.links).find(item => item.id === draggedItem?.dataset.id)
      : extractDroppedLink(event.dataTransfer);
    const url = safeWebUrl(link?.url);
    if (!url) return;
    const links = appData.settings.dockLinks ||= [];
    if (links.some(item => item.url === url)) return;
    const id = `dock-${crypto.randomUUID()}`;
    links.push({ ...link, url, id });
    const keys = Array.from(list.children, child => child.dataset.dockKey);
    const index = before ? keys.indexOf(before) : keys.length;
    keys.splice(index < 0 ? keys.length : index, 0, `site:${id}`);
    appData.settings.dockOrder = keys;
    syncManager.saveData();
    refreshDock();
  });
}
