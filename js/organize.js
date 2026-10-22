import { appData, syncManager } from './storage.js';
import { render } from './render.js';
import { icon } from './icons.js';
import { escapeHTML, generateId } from './utils.js';
import { safeWebUrl } from './urls.js';
import { loadSiteIcon } from './site-icons.js';

const guides = {
  edge: `<h5>从 Edge 导出收藏夹</h5><ol><li>在电脑上打开 Edge，点击右上角“…” →“收藏夹”。也可以在地址栏输入 <code>edge://favorites</code>。</li><li>点击收藏夹面板中的“…” →“导出收藏夹”。</li><li>将文件保存为 HTML，回到这里选择该文件。</li></ol>`,
  chrome: `<h5>从 Chrome 导出书签</h5><ol><li>在电脑上打开 Chrome，点击右上角“⋮” →“书签和清单” →“书签管理器”。也可以在地址栏输入 <code>chrome://bookmarks</code>。</li><li>点击书签管理器右上角的“⋮” →“导出书签”。</li><li>保存 HTML 文件，回到这里选择该文件。</li></ol><a href="https://support.google.com/chrome/answer/96816?hl=zh-Hans" target="_blank" rel="noopener noreferrer">Chrome 官方说明</a>`,
  safari: `<h5>从 Safari 导出书签（Mac）</h5><ol><li>打开 Safari，在屏幕顶部菜单选择“文件” →“将浏览数据导出到文件”（部分版本显示“从 Safari 导出”）。</li><li>仅选择“书签”并导出。如果得到 ZIP 文件，先双击解压，再找到其中的书签 HTML 文件。</li><li>旧版 Safari 可直接选择“文件” →“导出” →“书签”，保存为 HTML。</li><li>回到这里，选择导出的 HTML 文件。</li></ol><a href="https://support.apple.com/zh-cn/guide/safari/ibrwebf10132/mac" target="_blank" rel="noopener noreferrer">Safari 官方说明</a>`
};
const guide = document.getElementById('migrationGuide');
guide.innerHTML = guides.edge;
document.querySelectorAll('[data-guide]').forEach(button => {
  button.addEventListener('click', () => {
    guide.innerHTML = guides[button.dataset.guide];
    document.querySelectorAll('[data-guide]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  });
});
document.getElementById('guideImportBtn').addEventListener('click', () => document.getElementById('bookmarkFile').click());
const importStatus = document.getElementById('bookmarkImportStatus');
new MutationObserver(() => { document.getElementById('guideImportStatus').textContent = importStatus.textContent; })
  .observe(importStatus, { childList: true, characterData: true, subtree: true });

const dialog = document.getElementById('bulkEditorDialog');
const list = document.getElementById('bulkSiteList');
const groupList = document.getElementById('bulkGroupList');
const search = document.getElementById('bulkSearch');
const target = document.getElementById('bulkMoveTarget');
const selectAll = document.getElementById('bulkSelectAll');
const status = document.getElementById('bulkEditStatus');
const undoButton = document.getElementById('bulkUndo');
const allButton = document.getElementById('bulkAllGroups');
const saveButton = document.getElementById('bulkSave');
const collapsedGroups = new Set();
const collapsedSpaces = new Set();
// Object identity survives sorting, group switching and moving sites. IDs from
// imported files need not be unique for editor selections to remain correct.
let draftSpaces = [], draft = [], selected = new Set(), activeGroup = null;
let linkKeys = new WeakMap(), linksByKey = new Map(), nextKey = 0;
let original = '', spaceId = '', dirty = false, drag = null, saving = false;
let hasImportedDraft = false, deletedItems = [], editorColumnCount = 1;
function ownerSpace(group) { return draftSpaces.find(space => space.groups.includes(group)); }
function rebuildDraft() { draft = draftSpaces.flatMap(space => space.groups); }
function currentSpaces() { return appData.spaces.map(space => ({ ...space, groups: space.id === appData.activeSpaceId ? appData.groups : space.groups })); }
function hasBookmarks(space) { return space.groups.some(group => group.links.length > 0); }
function groupColumn(group) {
  return Number.isInteger(group.column) && group.column >= 0 && (group.columnCount || 3) === editorColumnCount
    ? group.column % editorColumnCount : (ownerSpace(group)?.groups.indexOf(group) || 0) % editorColumnCount;
}
function keyFor(link) {
  if (!linkKeys.has(link)) { const key = `site-${++nextKey}`; linkKeys.set(link, key); linksByKey.set(key, link); }
  return linkKeys.get(link);
}
function visibleLinks() {
  const query = search.value.trim().toLocaleLowerCase();
  return draft.flatMap(group => {
    if (!query && activeGroup && group !== activeGroup) return [];
    return group.links.filter(link => !query || `${link.title} ${link.url}`.toLocaleLowerCase().includes(query))
      .map(link => ({ group, link, key: keyFor(link) }));
  });
}
function updateSelection() {
  const visible = visibleLinks(), count = visible.filter(({ link }) => selected.has(link)).length;
  selectAll.checked = visible.length > 0 && count === visible.length;
  selectAll.indeterminate = count > 0 && count < visible.length;
  selectAll.disabled = !visible.length;
  document.getElementById('bulkSelectionCount').textContent = `已选 ${selected.size} 个 · 匹配 ${visible.length} 个`;
  document.getElementById('bulkMove').disabled = saving || !selected.size || target.value === '';
  document.getElementById('bulkDelete').disabled = saving || !selected.size;
  saveButton.disabled = saving || !dirty;
  document.getElementById('bulkCurrentGroup').textContent = search.value.trim()
    ? `搜索结果 (${visible.length})` : activeGroup ? `${ownerSpace(activeGroup)?.name || ''} / ${activeGroup.name || '未命名分组'} (${activeGroup.links.length})` : `全部网站 (${visible.length})`;
  document.getElementById('bulkFoldTools').hidden = !!activeGroup && !search.value.trim();
}
function changed(message = '更改将在保存后生效') { dirty = true; status.textContent = message; updateSelection(); }
function updateGroupOptions() {
  const previous = target.value;
  target.innerHTML = '<option value="">选择目标分组</option>' + draftSpaces.map(space => `<optgroup label="${escapeHTML(space.name)}">${space.groups.map(group => `<option value="${draft.indexOf(group)}">${escapeHTML(group.name || '未命名分组')}</option>`).join('')}</optgroup>`).join('') + '<option value="new">+ 新建分组...</option>';
  target.value = previous === 'new' ? '' : previous;
}
function renderNavigation() {
  const total = draft.reduce((sum, group) => sum + group.links.length, 0);
  document.getElementById('bulkAllCount').textContent = total;
  allButton.classList.toggle('active', !activeGroup);
  allButton.setAttribute('aria-current', activeGroup ? 'false' : 'page');
  const row = (group, index) => `<div class="bulk-nav-item ${group === activeGroup ? 'active' : ''}" data-nav-group="${index}" role="listitem">
    <button type="button" class="bulk-drag-handle" draggable="true" data-drag-group="${index}" aria-label="拖动分组排序，或按 Alt 加上下方向键" title="拖动分组排序">${icon('menu', 13)}</button>
    <button type="button" class="bulk-group-select" data-select-nav="${index}" aria-current="${group === activeGroup ? 'page' : 'false'}" title="${escapeHTML(group.name)}（双击或按 F2 改名）"><span class="bulk-nav-name">${escapeHTML(group.name || '未命名分组')}</span></button>
    <input type="text" class="bulk-field bulk-group-name-input" data-edit-group="${index}" value="${escapeHTML(group.name)}" aria-label="分组名称" maxlength="100" spellcheck="false" hidden>
    <span class="bulk-group-count">${group.links.length}</span>
  </div>`;
  const columnNames = ['第一列', '第二列', '第三列', '第四列', '第五列', '第六列'];
  groupList.innerHTML = draftSpaces.flatMap((space, spaceIndex) => {
    if (!hasBookmarks(space)) return [];
    const expanded = !collapsedSpaces.has(space), name = escapeHTML(space.name);
    const columns = Array.from({ length: editorColumnCount }, (_, column) => {
      const groups = space.groups.filter(group => groupColumn(group) === column);
      const label = columnNames[column] || `第 ${column + 1} 列`;
      const id = `bulkColumn${spaceIndex}-${column}`;
      return `<section class="bulk-nav-column" role="group" aria-labelledby="${id}"><h5 class="bulk-column-label" id="${id}">${label}</h5>${groups.map(group => row(group, draft.indexOf(group))).join('')}${groups.length ? '' : '<p class="bulk-column-empty">暂无分组</p>'}</section>`;
    }).join('');
    return [`<section class="bulk-space-section" data-space-index="${spaceIndex}"><button type="button" class="bulk-space-toggle" data-fold-space="${spaceIndex}" aria-expanded="${expanded}" aria-controls="bulkSpaceGroups${spaceIndex}">${icon('chevron-down', 14)}<span>${name}</span><span class="bulk-group-count">${space.groups.reduce((sum, group) => sum + group.links.length, 0)}</span></button><div class="bulk-space-columns" id="bulkSpaceGroups${spaceIndex}" ${expanded ? '' : 'hidden'}>${columns}</div></section>`];
  }).join('');
}
const titleWidth = title => Math.min(28, Math.max(10, [...title].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0) + 2));
function siteRow({ link, key }) {
  const invalid = !safeWebUrl(link.url, { allowBare: true });
  return `<li class="bulk-site-row" data-site-key="${key}">
    <button type="button" class="bulk-drag-handle" draggable="true" data-drag-site="${key}" aria-label="拖动网站排序或移至左侧分组，也可按 Alt 加上下方向键" title="拖动排序或移到左侧分组">${icon('menu', 12)}</button>
    <input type="checkbox" data-key="${key}" aria-label="选择${escapeHTML(link.title)}" ${selected.has(link) ? 'checked' : ''}>
    <img class="bulk-favicon" data-icon-key="${key}" alt="" width="18" height="18">
    <div class="bulk-site-copy"><input type="text" class="bulk-field bulk-title-input" data-edit-key="${key}" data-field="title" value="${escapeHTML(link.title)}" aria-label="网站名称" maxlength="200" spellcheck="false" style="--title-ch:${titleWidth(link.title)}">
    <input type="text" inputmode="url" class="bulk-field bulk-url-input" data-edit-key="${key}" data-field="url" value="${escapeHTML(link.url)}" aria-label="网站网址" aria-invalid="${invalid}" spellcheck="false" autocomplete="off"></div>
  </li>`;
}
function renderList() {
  const visible = visibleLinks(), grouped = !activeGroup || !!search.value.trim();
  if (!visible.length && !(grouped && !search.value.trim() && draftSpaces.some(hasBookmarks))) list.innerHTML = `<p class="bulk-empty">${search.value.trim() ? '没有匹配的网站' : '此处还没有网站，可导入收藏夹或从其他分组移动'}</p>`;
  else if (!grouped) list.innerHTML = `<ul class="bulk-site-rows" aria-label="网站列表">${visible.map(siteRow).join('')}</ul>`;
  else {
    const byGroup = new Map(search.value.trim() ? [] : draft.filter(group => hasBookmarks(ownerSpace(group))).map(group => [group, []]));
    visible.forEach(item => { if (!byGroup.has(item.group)) byGroup.set(item.group, []); byGroup.get(item.group).push(item); });
    list.innerHTML = [...byGroup].map(([group, items]) => {
      const index = draft.indexOf(group), expanded = !collapsedGroups.has(group);
      return `<section class="bulk-detail-group" data-detail-group="${index}"><button type="button" class="bulk-detail-heading" data-fold-group="${index}" aria-expanded="${expanded}" aria-controls="bulkDetails${index}">${icon('chevron-down', 13)}<span>${escapeHTML(ownerSpace(group).name)} / ${escapeHTML(group.name || '未命名分组')}</span><span class="bulk-group-count">${items.length}</span></button><ul id="bulkDetails${index}" class="bulk-site-rows" ${expanded ? '' : 'hidden'}>${items.length ? items.map(siteRow).join('') : '<li class="bulk-group-empty">暂无网站 · 可拖入此分组</li>'}</ul></section>`;
    }).join('');
  }
  list.querySelectorAll('[data-icon-key]').forEach(image => loadSiteIcon(image, linksByKey.get(image.dataset.iconKey)));
  list.querySelectorAll('[data-field="url"]').forEach(input => input.setCustomValidity(input.getAttribute('aria-invalid') === 'true' ? '请输入有效的 HTTP 或 HTTPS 网址' : ''));
  updateSelection();
}
function refresh() { renderNavigation(); renderList(); }
function activate(group) { activeGroup = group; search.value = ''; refresh(); list.scrollTop = 0; }
function openEditor() {
  document.getElementById('contextMenu').classList.add('hidden');
  editorColumnCount = document.querySelectorAll('#groupsContainer > .group-col').length || 1;
  draftSpaces = structuredClone(currentSpaces()); rebuildDraft(); original = JSON.stringify(currentSpaces()); spaceId = appData.activeSpaceId;
  collapsedSpaces.clear();
  const expandedSpace = draftSpaces.find(space => space.id === spaceId && hasBookmarks(space)) || draftSpaces.find(hasBookmarks);
  draftSpaces.forEach(space => { if (space !== expandedSpace) collapsedSpaces.add(space); });
  selected.clear(); collapsedGroups.clear(); linksByKey.clear(); linkKeys = new WeakMap(); nextKey = 0;
  activeGroup = null; dirty = false; drag = null; deletedItems = []; undoButton.hidden = true; hasImportedDraft = false;
  search.value = ''; target.value = ''; updateGroupOptions();
  document.getElementById('bulkSpaceName').textContent = `全部空间 · 直接编辑名称与网址，拖动手柄整理`;
  status.textContent = '更改将在保存后生效'; refresh(); dialog.showModal(); search.focus();
}
for (const id of ['openBulkEditor', 'contextBulkEditor', 'spaceEditBtn']) document.getElementById(id).addEventListener('click', openEditor);
allButton.addEventListener('click', () => activate(null));
groupList.addEventListener('click', event => {
  const toggle = event.target.closest('[data-fold-space]');
  if (toggle) {
    const space = draftSpaces[Number(toggle.dataset.foldSpace)], expanded = collapsedSpaces.has(space);
    if (expanded) collapsedSpaces.delete(space); else collapsedSpaces.add(space);
    toggle.setAttribute('aria-expanded', String(expanded)); document.getElementById(toggle.getAttribute('aria-controls')).hidden = !expanded; return;
  }
  const button = event.target.closest('[data-select-nav]');
  if (!button) return;
  // Keep the clicked navigation element alive so a second click can start rename.
  activeGroup = draft[Number(button.dataset.selectNav)]; search.value = '';
  allButton.classList.remove('active'); allButton.setAttribute('aria-current', 'false');
  groupList.querySelectorAll('[data-nav-group]').forEach(row => {
    const active = draft[Number(row.dataset.navGroup)] === activeGroup;
    row.classList.toggle('active', active); row.querySelector('[data-select-nav]').setAttribute('aria-current', active ? 'page' : 'false');
  });
  renderList(); list.scrollTop = 0;
});
function renameGroup(row) {
  const input = row.querySelector('[data-edit-group]');
  row.querySelector('[data-select-nav]').hidden = true; input.hidden = false; input.focus(); input.select();
}
groupList.addEventListener('dblclick', event => { const button = event.target.closest('[data-select-nav]'); if (button) renameGroup(button.closest('[data-nav-group]')); });
groupList.addEventListener('keydown', event => {
  if (event.key === 'F2') { const row = event.target.closest('[data-nav-group]'); if (row) { event.preventDefault(); renameGroup(row); } }
  if (event.key === 'Enter' && event.target.matches('[data-edit-group]')) { event.preventDefault(); event.target.blur(); }
});
groupList.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.editGroup === undefined) return;
  const group = draft[Number(input.dataset.editGroup)]; group.name = input.value;
  input.closest('[data-nav-group]').querySelector('.bulk-nav-name').textContent = group.name || '未命名分组';
  updateGroupOptions(); changed();
});
groupList.addEventListener('focusout', event => {
  const input = event.target;
  if (input.dataset.editGroup === undefined) return;
  const group = draft[Number(input.dataset.editGroup)]; group.name = group.name.trim() || '未命名分组'; input.value = group.name;
  const button = input.closest('[data-nav-group]').querySelector('[data-select-nav]'); button.hidden = false;
  button.querySelector('.bulk-nav-name').textContent = group.name; button.title = `${group.name}（双击或按 F2 改名）`; input.hidden = true;
  updateGroupOptions(); updateSelection();
});
function createGroup() {
  const group = { id: generateId(), name: '新建分组', collapsed: false, links: [], column: activeGroup ? groupColumn(activeGroup) : 0, columnCount: editorColumnCount };
  const space = ownerSpace(activeGroup) || draftSpaces.find(item => item.id === spaceId && hasBookmarks(item)) || draftSpaces.find(hasBookmarks) || draftSpaces.find(item => item.id === spaceId) || draftSpaces[0];
  space.groups.push(group); rebuildDraft(); collapsedSpaces.delete(space); activeGroup = group; search.value = ''; updateGroupOptions(); target.value = String(draft.indexOf(group));
  changed('已新建分组，输入名称后可将所选网站移动到此处'); refresh();
  const row = groupList.querySelector(`[data-nav-group="${draft.indexOf(group)}"]`); if (row) { row.scrollIntoView({ block: 'nearest', inline: 'nearest' }); renameGroup(row); }
}
document.getElementById('bulkAddGroup').addEventListener('click', createGroup);
target.addEventListener('change', () => { if (target.value === 'new') createGroup(); else updateSelection(); });
search.addEventListener('input', () => { collapsedGroups.clear(); renderList(); });
list.addEventListener('input', event => {
  const input = event.target, link = linksByKey.get(input.dataset.editKey);
  if (!link) return;
  link[input.dataset.field] = input.value;
  if (input.dataset.field === 'url') {
    const valid = !!safeWebUrl(input.value, { allowBare: true });
    input.setCustomValidity(valid ? '' : '请输入有效的 HTTP 或 HTTPS 网址'); input.setAttribute('aria-invalid', String(!valid));
  } else input.style.setProperty('--title-ch', titleWidth(input.value));
  changed();
});
list.addEventListener('focusout', event => {
  const input = event.target;
  if (input.dataset.field !== 'url') return;
  const link = linksByKey.get(input.dataset.editKey), url = safeWebUrl(input.value, { allowBare: true });
  if (url && link) { link.url = url; input.value = url; const image = list.querySelector(`[data-icon-key="${input.dataset.editKey}"]`); if (image) loadSiteIcon(image, link); }
});
list.addEventListener('change', event => {
  const input = event.target, link = linksByKey.get(input.dataset.key);
  if (!link) return;
  if (input.checked) selected.add(link); else selected.delete(link); updateSelection();
});
selectAll.addEventListener('change', () => {
  visibleLinks().forEach(({ link }) => selectAll.checked ? selected.add(link) : selected.delete(link));
  list.querySelectorAll('[data-key]').forEach(input => { input.checked = selected.has(linksByKey.get(input.dataset.key)); }); updateSelection();
});
list.addEventListener('click', event => {
  const button = event.target.closest('[data-fold-group]'); if (!button) return;
  const group = draft[Number(button.dataset.foldGroup)], expanded = collapsedGroups.has(group);
  if (expanded) collapsedGroups.delete(group); else collapsedGroups.add(group);
  button.setAttribute('aria-expanded', String(expanded)); document.getElementById(button.getAttribute('aria-controls')).hidden = !expanded;
});
for (const [id, collapse] of [['bulkExpandAll', false], ['bulkCollapseAll', true]]) document.getElementById(id).addEventListener('click', () => {
  collapsedGroups.clear(); if (collapse) draft.forEach(group => collapsedGroups.add(group)); renderList();
});
function moveLinks(links, destination) {
  let count = 0;
  draft.forEach(group => {
    if (group === destination) return;
    group.links = group.links.filter(link => { if (!links.has(link)) return true; destination.links.push(link); count++; return false; });
  });
  if (count) { collapsedGroups.delete(destination); changed(`已移动 ${count} 个网站到“${destination.name}”，保存后生效`); }
  refresh(); return count;
}
document.getElementById('bulkMove').addEventListener('click', () => {
  const destination = target.value === '' ? null : draft[Number(target.value)];
  if (destination && selected.size) moveLinks(selected, destination);
});
document.getElementById('bulkDelete').addEventListener('click', () => {
  if (!selected.size) return;
  const removed = [];
  draft.forEach(group => { group.links = group.links.filter((link, index) => { if (!selected.has(link)) return true; removed.push({ group, link, index }); return false; }); });
  if (!removed.length) return;
  deletedItems = removed; selected.clear(); undoButton.hidden = false; changed(`已删除 ${removed.length} 个网站`); refresh();
});
undoButton.addEventListener('click', () => {
  if (!deletedItems.length) return;
  const count = deletedItems.length;
  deletedItems.forEach(({ group, link, index }) => { group.links.splice(Math.min(index, group.links.length), 0, link); collapsedGroups.delete(group); });
  deletedItems = []; undoButton.hidden = true; changed(`已恢复 ${count} 个网站`); refresh();
});
function reorderGroups(group, destination, after) {
  if (group === destination) return;
  const targetGroup = target.value === '' ? null : draft[Number(target.value)];
  // Persist each visible column before changing the global order. Dropping on
  // another column's group moves only the dragged group into that column.
  const destinationColumn = groupColumn(destination);
  draft.forEach(item => { item.column = groupColumn(item); item.columnCount = editorColumnCount; });
  const sourceSpace = ownerSpace(group), destinationSpace = ownerSpace(destination);
  sourceSpace.groups.splice(sourceSpace.groups.indexOf(group), 1);
  destinationSpace.groups.splice(destinationSpace.groups.indexOf(destination) + (after ? 1 : 0), 0, group);
  group.column = destinationColumn; collapsedSpaces.delete(destinationSpace); rebuildDraft();
  updateGroupOptions(); target.value = targetGroup ? String(draft.indexOf(targetGroup)) : '';
  changed('分组顺序已调整，保存后生效'); refresh();
}
function reorderSites(links, destination, reference, after) {
  if (links.has(reference)) return;
  const moving = draft.flatMap(group => group.links).filter(link => links.has(link));
  if (!moving.length) return;
  draft.forEach(group => { group.links = group.links.filter(link => !links.has(link)); });
  const index = destination.links.indexOf(reference);
  destination.links.splice(index < 0 ? destination.links.length : index + (after ? 1 : 0), 0, ...moving);
  collapsedGroups.delete(destination); changed('网站顺序已调整，保存后生效'); refresh();
}
function clearDropMarks() { dialog.querySelectorAll('.drop-target, .bulk-drop-before, .bulk-drop-after').forEach(el => el.classList.remove('drop-target', 'bulk-drop-before', 'bulk-drop-after')); }
function dropDestination(event) {
  if (!drag) return null;
  // Navigation takes priority over editable inputs and all right-pane drop zones.
  const nav = event.target.closest('[data-nav-group]');
  if (nav) return { group: draft[Number(nav.dataset.navGroup)], element: nav, navigation: true, after: event.clientY > nav.getBoundingClientRect().top + nav.offsetHeight / 2 };
  const row = event.target.closest('[data-site-key]');
  if (row && drag.type === 'site') {
    const link = linksByKey.get(row.dataset.siteKey), group = draft.find(item => item.links.includes(link));
    return { group, link, element: row, after: event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2 };
  }
  const section = event.target.closest('[data-detail-group]');
  if (drag.type === 'site' && section) return { group: draft[Number(section.dataset.detailGroup)], element: section, append: true };
  if (drag.type === 'site' && activeGroup && event.target.closest('#bulkSiteList')) return { group: activeGroup, element: list, append: true };
  return null;
}
dialog.addEventListener('dragstart', event => {
  const handle = event.target.closest('[data-drag-group], [data-drag-site]');
  if (!handle) { if (event.target.closest('.bulk-master-detail')) event.preventDefault(); return; }
  if (handle.dataset.dragGroup !== undefined) drag = { type: 'group', group: draft[Number(handle.dataset.dragGroup)] };
  else { const link = linksByKey.get(handle.dataset.dragSite); drag = { type: 'site', links: selected.has(link) ? new Set(selected) : new Set([link]) }; }
  event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'simtab-editor');
  event.dataTransfer.setDragImage(handle.closest('.bulk-nav-item, .bulk-site-row'), 16, 14);
});
dialog.addEventListener('dragover', event => {
  const destination = dropDestination(event); if (!destination) return;
  event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; clearDropMarks();
  destination.element.classList.add(drag.type === 'site' && destination.navigation || destination.append ? 'drop-target' : destination.after ? 'bulk-drop-after' : 'bulk-drop-before');
  const scrollable = destination.navigation ? groupList : list, rect = scrollable.getBoundingClientRect();
  if (event.clientY < rect.top + 28) scrollable.scrollTop -= 12;
  if (event.clientY > rect.bottom - 28) scrollable.scrollTop += 12;
});
dialog.addEventListener('dragleave', event => { if (!dialog.contains(event.relatedTarget)) clearDropMarks(); });
dialog.addEventListener('drop', event => {
  const destination = dropDestination(event); if (!destination) return;
  event.preventDefault(); event.stopPropagation(); clearDropMarks();
  const source = drag; drag = null;
  if (source.type === 'group') reorderGroups(source.group, destination.group, destination.after);
  else if (destination.navigation || destination.append) moveLinks(source.links, destination.group);
  else reorderSites(source.links, destination.group, destination.link, destination.after);
});
dialog.addEventListener('dragend', () => { drag = null; clearDropMarks(); });
dialog.addEventListener('keydown', event => {
  const handle = event.target.closest('[data-drag-group], [data-drag-site]');
  if (!handle || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === 'ArrowUp' ? -1 : 1;
  if (handle.dataset.dragGroup !== undefined) {
    const index = Number(handle.dataset.dragGroup), group = draft[index], destination = draft[index + direction];
    if (!destination) return; reorderGroups(group, destination, direction > 0); groupList.querySelector(`[data-drag-group="${draft.indexOf(group)}"]`)?.focus();
  } else {
    const link = linksByKey.get(handle.dataset.dragSite), group = draft.find(item => item.links.includes(link)), index = group.links.indexOf(link);
    const reference = group.links[index + direction]; if (!reference) return;
    reorderSites(new Set([link]), group, reference, direction > 0); list.querySelector(`[data-drag-site="${keyFor(link)}"]`)?.focus();
  }
});
document.getElementById('bulkClose').addEventListener('click', () => { if (!saving) dialog.close(); });
dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
saveButton.addEventListener('click', async () => {
  if (!dirty || saving) return;
  for (const group of draft) for (const link of group.links) {
    if (safeWebUrl(link.url, { allowBare: true })) continue;
    activeGroup = group; collapsedSpaces.delete(ownerSpace(group)); search.value = ''; refresh();
    const input = list.querySelector(`[data-edit-key="${keyFor(link)}"][data-field="url"]`);
    input.setCustomValidity('请输入有效的 HTTP 或 HTTPS 网址'); input.focus(); input.reportValidity(); status.textContent = '有网站的网址无效，请修改后保存'; return;
  }
  if (appData.activeSpaceId !== spaceId || JSON.stringify(currentSpaces()) !== original) { status.textContent = '网站数据已发生变化，请关闭并重新打开批量编辑后再操作。'; return; }
  draft.forEach(group => { group.name = group.name.trim() || '未命名分组'; group.links.forEach(link => { link.url = safeWebUrl(link.url, { allowBare: true }); link.title = link.title.trim() || new URL(link.url).hostname; }); });
  // Persist a separate snapshot so the editor draft never mutates live appData.
  const snapshot = structuredClone(draftSpaces); appData.spaces = snapshot;
  appData.groups = snapshot.find(space => space.id === spaceId).groups;
  dirty = false; render(); original = JSON.stringify(currentSpaces());
  saving = true;
  const controls = [...dialog.querySelectorAll('button, input, select')], previouslyDisabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; }); saveButton.textContent = '正在保存…';
  try {
    const saved = await syncManager.saveData();
    status.textContent = saved ? '更改已保存' : '更改已应用，但保存失败，请返回设置重试同步或导出备份。';
    if (hasImportedDraft) importStatus.textContent = saved ? '收藏夹已导入并保存，可在主页查看。' : status.textContent;
    hasImportedDraft = false; dirty = !saved; if (saved) dialog.close();
  } catch (error) {
    dirty = true; status.textContent = `保存失败：${error.message || '请重试'}`;
  } finally {
    saving = false; controls.forEach((control, index) => { control.disabled = previouslyDisabled[index]; }); saveButton.textContent = '保存更改'; updateSelection();
  }
});
document.getElementById('bulkImportBookmarks').addEventListener('click', () => document.getElementById('bookmarkFile').click());
document.addEventListener('simtab-bookmark-preview', event => {
  if (!dialog.open) openEditor();
  const first = event.detail.groups[0];
  const space = ownerSpace(activeGroup) || draftSpaces.find(item => item.id === spaceId) || draftSpaces[0];
  space.groups.push(...event.detail.groups); rebuildDraft(); collapsedSpaces.delete(space); hasImportedDraft = true; dirty = true;
  activeGroup = event.detail.groups.length === 1 ? first : null; search.value = ''; collapsedGroups.clear();
  updateGroupOptions(); status.textContent = `“${event.detail.filename}”：${event.detail.count} 个网站待导入，可先整理，保存后生效`; refresh();
  groupList.querySelector(`[data-nav-group="${draft.indexOf(first)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (!activeGroup) list.querySelector(`#bulkDetails${draft.indexOf(first)}`)?.scrollIntoView({ block: 'nearest' });
});
dialog.addEventListener('close', () => { if (hasImportedDraft) importStatus.textContent = '已取消导入，收藏夹未保存。'; hasImportedDraft = false; drag = null; clearDropMarks(); });
