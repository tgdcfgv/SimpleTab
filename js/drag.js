import { appData, syncManager } from './storage.js';
import { render } from './render.js';


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
  setTimeout(() => draggedItem.classList.add('dragging'), 0);
}

export function handleGroupDragStart(e) {
  if (e.target.closest('.site-btn, .group-action-btn, .collapsed-icon-link')) {
    e.preventDefault();
    return;
  }
  draggedItem = e.currentTarget;
  draggedItemType = 'group';
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => draggedItem?.classList.add('dragging-group'), 0);
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
  e.preventDefault();
  if (draggedItemType !== 'site') return;
  e.dataTransfer.dropEffect = 'move';
}

export function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
}

export function handleDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove('dragging', 'dragging-group');
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
  e.preventDefault();
  if (draggedItemType !== 'site') return;
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
  e.preventDefault();
  e.stopPropagation();
}


