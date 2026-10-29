import { appData, syncManager } from './storage.js';
import { render } from './render.js';
import { extractDroppedLink } from './urls.js';


export let draggedItem = null;
export let draggedItemType = null; // 'site' or 'group'
let siteOrderChanged = false;

function captureSiteRects() {
  return new Map(
    Array.from(document.querySelectorAll('.site-btn')).map(item => [item, item.getBoundingClientRect()])
  );
}

function getLayoutPosition(element) {
  let left = 0;
  let top = 0;
  let current = element;
  while (current) {
    left += current.offsetLeft || 0;
    top += current.offsetTop || 0;
    current = current.offsetParent;
  }
  return { left, top };
}

function animateSiteReflow(previousRects) {
  document.querySelectorAll('.site-btn').forEach(item => {
    if (item === draggedItem) return;
    const previous = previousRects.get(item);
    if (!previous) return;
    item.getAnimations().forEach(animation => animation.cancel());
    const current = item.getBoundingClientRect();
    const deltaX = previous.left - current.left;
    const deltaY = previous.top - current.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

    item.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' }
      ],
      {
        duration: 190,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    );
  });
}

function syncSiteOrderFromDom() {
  const linksById = new Map();
  appData.groups.forEach(group => {
    group.links.forEach(link => linksById.set(link.id, link));
  });

  document.querySelectorAll('.sites-grid[data-group-id]').forEach(grid => {
    const group = appData.groups.find(item => item.id === grid.dataset.groupId);
    if (!group) return;
    group.links = Array.from(grid.querySelectorAll(':scope > .site-btn'))
      .map(item => linksById.get(item.dataset.id))
      .filter(Boolean);
  });
}

function moveDraggedSite(targetGrid, referenceNode = null) {
  if (!draggedItem || draggedItemType !== 'site' || !targetGrid) return;
  if (referenceNode === draggedItem) return;

  const isAlreadyPlaced = referenceNode
    ? draggedItem.parentElement === targetGrid && draggedItem.nextElementSibling === referenceNode
    : draggedItem.parentElement === targetGrid && draggedItem === targetGrid.lastElementChild;
  if (isAlreadyPlaced) return;

  const previousRects = captureSiteRects();
  targetGrid.querySelector('.empty-group-state')?.remove();
  targetGrid.insertBefore(draggedItem, referenceNode);
  syncSiteOrderFromDom();
  siteOrderChanged = true;
  animateSiteReflow(previousRects);
}

export function handleDragStart(e) {
  draggedItem = e.currentTarget;
  draggedItemType = 'site';
  siteOrderChanged = false;
  e.stopPropagation();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedItem.dataset.id || '');
  document.querySelectorAll('.sites-grid').forEach(grid => grid.classList.add('is-sorting'));
  const item = draggedItem;
  setTimeout(() => { if (draggedItem === item) item.classList.add('dragging'); }, 0);
}

export function handleGroupDragStart(e) {
  if (e.target.closest('.site-btn, .group-action-btn, .collapsed-icon-link')) {
    e.preventDefault();
    return;
  }
  draggedItem = e.currentTarget;
  draggedItemType = 'group';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedItem.dataset.id || '');
  draggedItem.classList.add('group-drag-surface');
  e.dataTransfer.setDragImage(draggedItem, e.clientX - draggedItem.getBoundingClientRect().left, e.clientY - draggedItem.getBoundingClientRect().top);
  const card = draggedItem;
  setTimeout(() => { if (draggedItem === card) card.classList.add('dragging-group'); }, 0);
}

export function moveGroupTo(sourceId, colIndex, targetId = null, position = 'after') {
  // Persist the visible placement before reordering so drops work at every width.
  const columns = document.querySelectorAll('#groupsContainer > .group-col');
  columns.forEach((column, index) => {
    column.querySelectorAll(':scope > .group-card').forEach(card => {
      const group = appData.groups.find(item => item.id === card.dataset.id);
      if (group) { group.column = index; group.columnCount = columns.length; }
    });
  });
  const sourceIndex = appData.groups.findIndex(g => g.id === sourceId);
  if (sourceIndex === -1) return;
  const sourceGroup = appData.groups[sourceIndex];
  sourceGroup.column = colIndex;

  appData.groups.splice(sourceIndex, 1);

  if (targetId) {
    let targetIndex = appData.groups.findIndex(g => g.id === targetId);
    if (position === 'after') targetIndex++;
    appData.groups.splice(targetIndex, 0, sourceGroup);
  } else {
    let insertIndex = appData.groups.length;
    for (let i = appData.groups.length - 1; i >= 0; i--) {
      if (appData.groups[i].column === colIndex) {
        insertIndex = i + 1;
        break;
      }
    }
    appData.groups.splice(insertIndex, 0, sourceGroup);
  }
  syncManager.saveData();
  render();
}

export function handleDragOver(e) {
  if (draggedItemType !== 'site') return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

export function handleDrop(e) {
  if (draggedItemType !== 'site') return;
  e.preventDefault();
  e.stopPropagation();
}

export function handleDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove('dragging', 'dragging-group', 'group-drag-surface');
  }
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelectorAll('.drag-over-top').forEach(el => el.classList.remove('drag-over-top'));
  document.querySelectorAll('.drag-over-bottom').forEach(el => el.classList.remove('drag-over-bottom'));
  document.querySelectorAll('.drag-over-col').forEach(el => el.classList.remove('drag-over-col'));
  document.querySelectorAll('.sites-grid.is-sorting').forEach(grid => grid.classList.remove('is-sorting'));
  if (draggedItemType === 'site' && siteOrderChanged) {
    syncManager.saveData();
    render();
  }
  draggedItem = null;
  draggedItemType = null;
  siteOrderChanged = false;
}

export function handleDragOverGroup(e) {
  if (draggedItemType !== 'site') return;
  e.preventDefault();
  const grid = e.currentTarget.closest('.sites-grid');
  if (!grid) return;
  e.dataTransfer.dropEffect = 'move';

  const items = Array.from(grid.querySelectorAll(':scope > .site-btn'))
    .filter(item => item !== draggedItem);
  if (items.length === 0) {
    moveDraggedSite(grid);
    return;
  }

  const gridRect = grid.getBoundingClientRect();
  const pointerX = e.clientX - gridRect.left + grid.scrollLeft;
  const pointerY = e.clientY - gridRect.top + grid.scrollTop;
  const gridLayout = getLayoutPosition(grid);
  const rows = [];

  items.forEach(item => {
    const itemLayout = getLayoutPosition(item);
    const metric = {
      item,
      left: itemLayout.left - gridLayout.left,
      top: itemLayout.top - gridLayout.top,
      width: item.offsetWidth
    };
    let row = rows.find(candidate => Math.abs(candidate.top - metric.top) < 2);
    if (!row) {
      row = { top: metric.top, items: [] };
      rows.push(row);
    }
    row.items.push(metric);
  });
  rows.sort((a, b) => a.top - b.top);
  rows.forEach(row => row.items.sort((a, b) => a.left - b.left));

  let rowIndex = rows.length - 1;
  for (let index = 0; index < rows.length - 1; index++) {
    const boundary = (rows[index].top + rows[index + 1].top) / 2;
    if (pointerY < boundary) {
      rowIndex = index;
      break;
    }
  }

  const row = rows[rowIndex];
  const referenceInRow = row.items.find(metric => pointerX < metric.left + metric.width / 2);
  const referenceNode = referenceInRow?.item || rows[rowIndex + 1]?.items[0]?.item || null;
  moveDraggedSite(grid, referenceNode);
}

export function handleDragLeaveGroup(e) {
}

export function handleDropOnGroup(e) {
  if (draggedItemType !== 'site') return;
  e.preventDefault();
  e.stopPropagation();
}

let internalDragActive = false;
let externalDropInitialized = false;

function getExternalDropHint() {
  let hint = document.getElementById('externalDropHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'externalDropHint';
    hint.className = 'external-drop-hint hidden';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);
  }
  return hint;
}

export function clearExternalDropState() {
  document.body?.classList.remove('is-external-dragging');
  document.querySelectorAll('.group-card.external-drop-target').forEach(el => {
    el.classList.remove('external-drop-target');
  });
  const hint = document.getElementById('externalDropHint');
  if (hint) {
    hint.classList.add('hidden');
    hint.textContent = '';
  }
}

function canAcceptExternalDrop(e) {
  if (internalDragActive || draggedItem || draggedItemType) return false;
  const appContainer = document.querySelector('.app-container');
  if (!appContainer || appContainer.inert) return false;
  if (document.querySelector('dialog[open]')) return false;

  const modalOverlay = document.getElementById('modalOverlay');
  const siteModal = document.getElementById('siteModal');
  if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
    if (!siteModal || siteModal.classList.contains('hidden')) return false;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('#siteTitle, #siteIconUrl')) return false;
  }

  const types = Array.from(e.dataTransfer?.types || []);
  return (
    types.includes('text/uri-list') ||
    types.includes('text/x-moz-url') ||
    (!types.includes('Files') && (types.includes('text/html') || types.includes('text/plain')))
  );
}

function updateExternalDropFeedback(e) {
  const modalOverlay = document.getElementById('modalOverlay');
  const target = e.target instanceof Element ? e.target : null;
  const groupCard = modalOverlay?.classList.contains('hidden')
    ? target?.closest('.group-card')
    : null;

  document.querySelectorAll('.group-card.external-drop-target').forEach(card => {
    if (card !== groupCard) card.classList.remove('external-drop-target');
  });

  let groupName = '';
  if (groupCard) {
    groupCard.classList.add('external-drop-target');
    const group = appData.groups?.find(item => item.id === groupCard.dataset.id);
    groupName = group?.name || groupCard.querySelector('.group-title')?.textContent?.trim() || '';
  }

  document.body.classList.add('is-external-dragging');
  const hint = getExternalDropHint();
  hint.textContent = groupName ? `松开添加到「${groupName}」` : '松开添加网站';
  hint.classList.remove('hidden');
}

export function initExternalLinkDrop(onLinkDrop) {
  if (externalDropInitialized || typeof document === 'undefined') return;
  externalDropInitialized = true;

  document.addEventListener('dragstart', () => {
    internalDragActive = true;
    clearExternalDropState();
  }, true);

  document.addEventListener('dragend', () => {
    internalDragActive = false;
    clearExternalDropState();
  }, true);

  document.addEventListener('pointerdown', () => {
    internalDragActive = false;
  }, true);

  window.addEventListener('blur', clearExternalDropState);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearExternalDropState();
  });

  document.addEventListener('dragenter', (e) => {
    if (!canAcceptExternalDrop(e)) return;
    e.preventDefault();
    updateExternalDropFeedback(e);
  });

  document.addEventListener('dragover', (e) => {
    if (!canAcceptExternalDrop(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    updateExternalDropFeedback(e);
  });

  document.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) {
      clearExternalDropState();
    }
  });

  document.addEventListener('drop', (e) => {
    const allowed = canAcceptExternalDrop(e);
    const modalOverlay = document.getElementById('modalOverlay');
    const target = e.target instanceof Element ? e.target : null;
    const groupCard = modalOverlay?.classList.contains('hidden')
      ? target?.closest('.group-card')
      : null;
    const targetGroupId = groupCard?.dataset.id || null;

    internalDragActive = false;
    clearExternalDropState();

    if (!allowed) return;
    const dropped = extractDroppedLink(e.dataTransfer);
    if (!dropped) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof onLinkDrop === 'function') {
      onLinkDrop({ ...dropped, groupId: targetGroupId });
    }
  });
}


