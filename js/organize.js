import { appData, syncManager } from './storage.js';
import { render } from './render.js';
import { icon } from './icons.js';
import { escapeHTML } from './utils.js';

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
const search = document.getElementById('bulkSearch');
const filter = document.getElementById('bulkGroupFilter');
const target = document.getElementById('bulkMoveTarget');
const selectAll = document.getElementById('bulkSelectAll');
const status = document.getElementById('bulkEditStatus');
const collapsedGroups = new Set();
let hasImportedDraft = false;
let draft = [], selected = new Set(), original = '', spaceId = '', dirty = false;
const keyFor = (groupIndex, linkIndex) => `${groupIndex}:${linkIndex}`;
function visibleLinks() {
  const query = search.value.trim().toLocaleLowerCase();
  return draft.flatMap((group, groupIndex) => group.links.flatMap((link, linkIndex) => {
    if (filter.value !== '' && Number(filter.value) !== groupIndex) return [];
    if (query && !`${group.name} ${link.title} ${link.url}`.toLocaleLowerCase().includes(query)) return [];
    return [{ group, link, key: keyFor(groupIndex, linkIndex) }];
  }));
}
function updateSelection() {
  const visible = visibleLinks();
  const count = visible.filter(item => selected.has(item.key)).length;
  selectAll.checked = visible.length > 0 && count === visible.length;
  selectAll.indeterminate = count > 0 && count < visible.length;
  selectAll.disabled = !visible.length;
  document.getElementById('bulkSelectionCount').textContent = `已选 ${selected.size} 个 · 匹配 ${visible.length} 个`;
  document.getElementById('bulkMove').disabled = !selected.size || target.value === '';
  document.getElementById('bulkDelete').disabled = !selected.size;
  document.getElementById('bulkSave').disabled = !dirty;
  document.querySelectorAll('[data-select-group]').forEach(input => {
    const links = visible.filter(item => item.key.startsWith(`${input.dataset.selectGroup}:`));
    const checked = links.filter(item => selected.has(item.key)).length;
    input.checked = links.length > 0 && checked === links.length;
    input.indeterminate = checked > 0 && checked < links.length;
    input.disabled = !links.length;
  });
}
function renderList() {
  const list = document.getElementById('bulkSiteList');
  const visible = visibleLinks();
  const query = search.value.trim();
  const groups = draft.flatMap((group, groupIndex) => {
    if (filter.value !== '' && Number(filter.value) !== groupIndex) return [];
    const links = visible.filter(item => item.key.startsWith(`${groupIndex}:`));
    if (query && !links.length && !group.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return [];
    const expanded = !collapsedGroups.has(groupIndex);
    return [`<li class="bulk-outline-group">
      <div class="bulk-group-row">
        <button type="button" class="bulk-fold" data-fold-group="${groupIndex}" aria-expanded="${expanded}" aria-controls="bulkGroupChildren${groupIndex}" aria-label="${expanded ? '折叠' : '展开'}${escapeHTML(group.name)}">${icon('chevron-down', 14)}</button>
        <input type="checkbox" data-select-group="${groupIndex}" aria-label="选择${escapeHTML(group.name)}中的${query ? '匹配' : '全部'}网站">
        <button type="button" class="bulk-group-title" data-fold-group="${groupIndex}" aria-expanded="${expanded}" aria-controls="bulkGroupChildren${groupIndex}">${icon('folder', 17)}<span>${escapeHTML(group.name)}</span></button>
        <span class="bulk-group-count">${query ? `${links.length} / ` : ''}${group.links.length}</span>
      </div>
      <ul id="bulkGroupChildren${groupIndex}" class="bulk-group-children" ${expanded ? '' : 'hidden'}>
        ${links.length ? links.map(({ link, key }) => `<li><label class="bulk-site-row"><input type="checkbox" data-key="${key}" ${selected.has(key) ? 'checked' : ''}>
          <span class="bulk-site-copy"><strong>${escapeHTML(link.title)}</strong><small>${escapeHTML(link.url)}</small></span></label></li>`).join('')
          : '<li class="bulk-group-empty">此分组还没有网站</li>'}
      </ul>
    </li>`];
  });
  list.innerHTML = groups.length ? `<ul class="bulk-outline" aria-label="分组与网站大纲">${groups.join('')}</ul>`
    : '<p class="bulk-empty">没有符合条件的网站或分组</p>';
  updateSelection();
}
function updateGroupOptions() {
  const options = draft.map((group, index) => `<option value="${index}">${escapeHTML(group.name)}</option>`).join('');
  filter.innerHTML = '<option value="">所有分组</option>' + options;
  target.innerHTML = '<option value="">选择目标分组</option>' + options;
}
function openEditor() {
  hasImportedDraft = false;
  document.getElementById('contextMenu').classList.add('hidden');
  draft = structuredClone(appData.groups);
  original = JSON.stringify(appData.groups);
  spaceId = appData.activeSpaceId;
  dirty = false; selected.clear(); collapsedGroups.clear(); search.value = '';
  updateGroupOptions();
  document.getElementById('bulkSpaceName').textContent = `${appData.spaces.find(space => space.id === spaceId)?.name || '当前空间'} · 分组与网站大纲`;
  status.textContent = '更改将在保存后生效';
  renderList(); dialog.showModal(); search.focus();
}
for (const id of ['openBulkEditor', 'helpBulkEditor', 'contextBulkEditor']) document.getElementById(id).addEventListener('click', openEditor);
search.placeholder = '搜索分组、网站名称或网址';
search.setAttribute('aria-label', '搜索分组或网站');
search.addEventListener('input', () => { collapsedGroups.clear(); renderList(); });
filter.addEventListener('change', renderList);
target.addEventListener('change', updateSelection);
document.getElementById('bulkSiteList').addEventListener('change', event => {
  const key = event.target.dataset.key;
  const groupIndex = event.target.dataset.selectGroup;
  if (groupIndex !== undefined) {
    visibleLinks().filter(item => item.key.startsWith(`${groupIndex}:`)).forEach(({ key }) => {
      if (event.target.checked) selected.add(key); else selected.delete(key);
    });
    document.querySelectorAll('#bulkSiteList [data-key]').forEach(input => { input.checked = selected.has(input.dataset.key); });
    updateSelection(); return;
  }
  if (!key) return;
  if (event.target.checked) selected.add(key); else selected.delete(key);
  updateSelection();
});
document.getElementById('bulkSiteList').addEventListener('click', event => {
  const button = event.target.closest('[data-fold-group]');
  if (!button) return;
  const groupIndex = Number(button.dataset.foldGroup);
  const expanded = collapsedGroups.has(groupIndex);
  if (expanded) collapsedGroups.delete(groupIndex); else collapsedGroups.add(groupIndex);
  document.getElementById(`bulkGroupChildren${groupIndex}`).hidden = !expanded;
  button.closest('.bulk-group-row').querySelectorAll('[data-fold-group]').forEach(control => {
    control.setAttribute('aria-expanded', String(expanded));
  });
  button.closest('.bulk-group-row').querySelector('.bulk-fold').setAttribute('aria-label', `${expanded ? '折叠' : '展开'}${draft[groupIndex].name}`);
});
for (const [id, collapse] of [['bulkExpandAll', false], ['bulkCollapseAll', true]]) {
  document.getElementById(id).addEventListener('click', () => {
    collapsedGroups.clear();
    if (collapse) draft.forEach((group, index) => collapsedGroups.add(index));
    renderList();
  });
}
selectAll.addEventListener('change', () => {
  visibleLinks().forEach(({ key }) => selectAll.checked ? selected.add(key) : selected.delete(key));
  renderList();
});
function applyBulkAction(move) {
  if (!selected.size || (move && target.value === '')) return;
  const destination = move ? draft[Number(target.value)] : null;
  const moved = [];
  let count = 0;
  draft.forEach((group, groupIndex) => {
    group.links = group.links.filter((link, linkIndex) => {
      if (!selected.has(keyFor(groupIndex, linkIndex)) || group === destination) return true;
      count++;
      if (move) moved.push(link);
      return false;
    });
  });
  if (destination) destination.links.push(...moved);
  selected.clear(); dirty = dirty || count > 0;
  status.textContent = count ? `已${move ? '移动' : '删除'} ${count} 个网站，点击“保存更改”生效` : '所选网站已在目标分组中';
  renderList();
}
document.getElementById('bulkMove').addEventListener('click', () => applyBulkAction(true));
document.getElementById('bulkDelete').addEventListener('click', () => applyBulkAction(false));
document.getElementById('bulkClose').addEventListener('click', () => dialog.close());
document.getElementById('bulkSave').addEventListener('click', async () => {
  if (!dirty) return;
  if (appData.activeSpaceId !== spaceId || JSON.stringify(appData.groups) !== original) {
    status.textContent = '网站数据已发生变化，请关闭并重新打开批量编辑后再操作。';
    return;
  }
  appData.groups = draft;
  const space = appData.spaces.find(item => item.id === spaceId);
  if (space) space.groups = draft;
  original = JSON.stringify(draft);
  dirty = false;
  render(); original = JSON.stringify(appData.groups); updateSelection();
  const saved = await syncManager.saveData();
  status.textContent = saved ? '更改已保存' : '更改已应用，但保存失败，请返回设置重试同步或导出备份。';
  if (hasImportedDraft) importStatus.textContent = saved ? '收藏夹已导入并保存，可在主页查看。' : status.textContent;
  hasImportedDraft = false;
  if (saved) dialog.close();
});

// Both settings and this editor share the same safe file parser and preview.
document.getElementById('bulkImportBookmarks').addEventListener('click', () => document.getElementById('bookmarkFile').click());
document.addEventListener('simtab-bookmark-preview', event => {
  if (!dialog.open) openEditor();
  const firstImportedIndex = draft.length;
  draft.push(...event.detail.groups);
  hasImportedDraft = true; dirty = true;
  search.value = ''; selected.clear();
  collapsedGroups.clear();
  for (let index = 0; index < firstImportedIndex; index++) collapsedGroups.add(index);
  updateGroupOptions();
  status.textContent = `“${event.detail.filename}”：${event.detail.count} 个网站待导入，可先整理，保存后生效`;
  renderList();
  document.querySelectorAll('.bulk-outline-group')[firstImportedIndex]?.scrollIntoView({ block: 'nearest' });
});
dialog.addEventListener('close', () => {
  if (hasImportedDraft) importStatus.textContent = '已取消导入，收藏夹未保存。';
  hasImportedDraft = false;
});
