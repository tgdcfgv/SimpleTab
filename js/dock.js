import { appData, syncManager } from './storage.js';
import { draggedItem, draggedItemType, clearExternalDropState, handleDockDragStart, handleDragEnd } from './drag.js';
import { render } from './render.js';
import { extractDroppedLink, safeWebUrl } from './urls.js';
import { loadSiteIcon } from './site-icons.js';
import { showConfirm } from './modals.js';

let refreshDock = () => {};

export function renderDockSites() {
  const list = document.getElementById('dockSites');
  if (!list) return;
  list.replaceChildren();
  for (const link of appData.settings.dockLinks || []) {
    const anchor = document.createElement('a');
    anchor.className = 'dock-site-btn dock-action-btn';
    anchor.href = link.url;
    anchor.dataset.dockId = link.id;
    anchor.title = `${link.title}（可拖回分组，右键移除）`;
    anchor.setAttribute('aria-label', link.title);
    anchor.draggable = true;
    anchor.addEventListener('dragstart', handleDockDragStart);
    anchor.addEventListener('dragend', handleDragEnd);
    if (appData.settings.openLinksInNewTab) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    const image = document.createElement('img');
    anchor.append(image);
    loadSiteIcon(image, link);
    const remove = () => showConfirm('从程序坞移除', `移除「${link.title}」的快捷图标？`, () => {
      appData.settings.dockLinks = appData.settings.dockLinks.filter(item => item.id !== link.id);
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

export function initDockDrop(onChange) {
  refreshDock = onChange;
  const dock = document.getElementById('spaceDock');
  const targetGroup = event => {
    if (draggedItemType !== 'dock-site' || document.querySelector('.app-container')?.inert ||
        document.querySelector('dialog[open]') || !document.getElementById('modalOverlay').classList.contains('hidden')) return null;
    const card = event.target instanceof Element ? event.target.closest('.group-card') : null;
    return appData.groups.find(group => group.id === card?.dataset.id);
  };
  for (const type of ['dragenter', 'dragover']) {
    document.addEventListener(type, event => {
      if (draggedItemType !== 'dock-site') return;
      clearExternalDropState();
      const group = targetGroup(event);
      if (!group) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      event.target.closest('.group-card').classList.add('external-drop-target');
    }, true);
  }
  document.addEventListener('drop', event => {
    const group = targetGroup(event);
    if (!group) return;
    event.preventDefault();
    event.stopPropagation();
    const link = appData.settings.dockLinks.find(item => item.id === draggedItem?.dataset.dockId);
    if (link) {
      if (!group.links.some(item => safeWebUrl(item.url) === link.url)) {
        group.links.push({ ...link, id: `link-${crypto.randomUUID()}` });
      }
      appData.settings.dockLinks = appData.settings.dockLinks.filter(item => item.id !== link.id);
      syncManager.saveData();
    }
    handleDragEnd();
    render();
  }, true);
  document.addEventListener('dragleave', event => {
    if (draggedItemType !== 'dock-site') return;
    const card = event.target instanceof Element ? event.target.closest('.group-card') : null;
    if (card && !card.contains(event.relatedTarget)) card.classList.remove('external-drop-target');
  });
  const clear = () => dock.classList.remove('dock-drop-target');
  const accepts = event => {
    if (!syncManager.ready || document.querySelector('.app-container')?.inert ||
        document.querySelector('dialog[open]') || !document.getElementById('modalOverlay').classList.contains('hidden')) return false;
    if (draggedItemType) return draggedItemType === 'site';
    const types = Array.from(event.dataTransfer?.types || []);
    return !types.includes('Files') && types.some(type => ['text/uri-list', 'text/x-moz-url', 'text/html', 'text/plain'].includes(type));
  };
  for (const type of ['dragenter', 'dragover']) {
    dock.addEventListener(type, event => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      // Internal website drags already allow move; pinning keeps the original.
      event.dataTransfer.dropEffect = draggedItemType === 'site' ? 'move' : 'copy';
      clearExternalDropState();
      dock.classList.add('dock-drop-target');
    });
  }
  dock.addEventListener('dragleave', event => {
    if (!dock.contains(event.relatedTarget)) clear();
  });
  document.addEventListener('dragend', clear);
  window.addEventListener('blur', clear);
  dock.addEventListener('drop', event => {
    clear();
    if (!accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearExternalDropState();
    const link = draggedItemType === 'site'
      ? appData.groups.flatMap(group => group.links).find(item => item.id === draggedItem?.dataset.id)
      : extractDroppedLink(event.dataTransfer);
    const url = safeWebUrl(link?.url);
    if (!url) return;
    const links = appData.settings.dockLinks ||= [];
    if (links.some(item => item.url === url)) return;
    links.push({ ...link, url, id: `dock-${crypto.randomUUID()}` });
    syncManager.saveData();
    refreshDock();
  });
}
