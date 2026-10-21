import { icon as lucideIcon } from './icons.js';
import { appData, syncManager } from './storage.js';
import { linkStore } from './catalog.js';
import { generateId, getFaviconUrl } from './utils.js';
import { render } from './render.js';
import { closeAllModals, modalOverlay, openGroupModal } from './modals.js';



export const appStoreModal = document.getElementById('appStoreModal');
export let selectedStoreLinks = [];
export let activeStoreCategoryId = null; // initialized lazily
export let currentStoreGroupId = null;
const BROWSER_BOOKMARKS_TYPE = 'browser-bookmarks';
const BROWSER_BOOKMARK_SOURCE = 'browser-bookmark';
let browserBookmarksLoaded = false;

export function getStoreLinkMap() {
  const map = new Map();
  linkStore.forEach(category => {
    category.links.forEach(link => map.set(link.url, link));
  });
  return map;
}

export function setStoreSelectionFromGroup(groupId) {
  currentStoreGroupId = groupId;
  const group = appData.groups.find(g => g.id === groupId);
  const storeLinkMap = getStoreLinkMap();
  selectedStoreLinks = group
    ? group.links.map(link => storeLinkMap.get(link.url)).filter(Boolean)
    : [];
  updateStoreSelectionCount();
}

export function getSelectedStoreMap() {
  return new Map(selectedStoreLinks.map(link => [link.url, link]));
}

export function updateStoreSelectionCount() {
  const count = selectedStoreLinks.length;
  document.getElementById('selectedLinksCount').textContent = count;
  const status = document.getElementById('storeStatusMsg');
  if (status) {
    status.textContent = count > 0 ? `已选择 ${count} 项` : '';
    status.className = 'store-status';
  }
}

function setStoreStatus(message, type = '') {
  const status = document.getElementById('storeStatusMsg');
  if (!status) return;
  status.textContent = message;
  status.className = `store-status ${type}`.trim();
}

function requestBookmarksPermission() {
  return new Promise(resolve => {
    if (!globalThis.chrome?.permissions?.request) {
      resolve(false);
      return;
    }
    chrome.permissions.request({ permissions: ['bookmarks'] }, granted => {
      const error = chrome.runtime.lastError;
      resolve(Boolean(granted) && !error);
    });
  });
}

function readBrowserBookmarks() {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.bookmarks?.getTree) {
      reject(new Error('当前环境无法读取浏览器收藏夹'));
      return;
    }
    chrome.bookmarks.getTree(nodes => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(nodes || []);
    });
  });
}

function flattenBrowserBookmarks(nodes, folderPath = [], result = [], seenUrls = new Set()) {
  nodes.forEach(node => {
    const nextPath = node.url
      ? folderPath
      : node.title
        ? [...folderPath, node.title]
        : folderPath;

    if (node.url) {
      try {
        const protocol = new URL(node.url).protocol;
        if (['http:', 'https:'].includes(protocol) && !seenUrls.has(node.url)) {
          seenUrls.add(node.url);
          result.push({
            name: node.title || node.url,
            url: node.url,
            type: BROWSER_BOOKMARKS_TYPE,
            bookmarkId: node.id,
            bookmarkPath: folderPath.join(' / ')
          });
        }
      } catch {
        // Ignore malformed bookmark URLs.
      }
    }
    if (node.children) flattenBrowserBookmarks(node.children, nextPath, result, seenUrls);
  });
  return result;
}

function mergeBookmarkSelectionFromGroup(category) {
  const group = appData.groups.find(item => item.id === currentStoreGroupId);
  if (!group) return;
  const selectedMap = new Map(
    selectedStoreLinks
      .filter(link => link.type !== BROWSER_BOOKMARKS_TYPE)
      .map(link => [link.url, link])
  );
  const categoryMap = new Map(category.links.map(link => [link.url, link]));
  group.links.forEach(link => {
    const bookmark = categoryMap.get(link.url);
    if (bookmark) selectedMap.set(bookmark.url, bookmark);
  });
  selectedStoreLinks = Array.from(selectedMap.values());
}

export function ensureStoreLayout() {
  const content = document.getElementById('appStoreContent');
  if (document.getElementById('appStoreMenu')) return;

  const title = appStoreModal.querySelector('h3');
  if (title) title.textContent = '应用商店';

  const shell = document.createElement('div');
  shell.className = 'store-shell';

  const menu = document.createElement('aside');
  menu.id = 'appStoreMenu';
  menu.className = 'store-menu';
  menu.setAttribute('aria-label', '应用分类');

  const main = document.createElement('section');
  main.className = 'store-main';

  content.parentNode.insertBefore(shell, content);
  shell.appendChild(menu);
  shell.appendChild(main);
  main.appendChild(content);

  const groupField = document.getElementById('storeGroupSelect').closest('.form-group');
  const actions = document.getElementById('addStoreLinksBtn').closest('.modal-actions');
  const footer = document.createElement('div');
  footer.className = 'store-footer';
  groupField.parentNode.insertBefore(footer, groupField);
  footer.appendChild(groupField);
  footer.appendChild(actions);

  // Status message sits below the footer row
  const status = document.createElement('div');
  status.id = 'storeStatusMsg';
  status.className = 'store-status';
  footer.parentNode.insertBefore(status, footer.nextSibling);
}

export function renderStoreMenu() {
  const menu = document.getElementById('appStoreMenu');
  menu.innerHTML = '';

  linkStore.forEach(category => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `store-menu-btn ${category.id === activeStoreCategoryId ? 'active' : ''}`;
    btn.dataset.categoryId = category.id;
    btn.innerHTML = `<span>${category.name}</span><span class="store-menu-count">${category.links.length}</span>`;
    btn.addEventListener('click', () => {
      activeStoreCategoryId = category.id;
      renderAppStoreCategory();
      renderStoreMenu();
    });
    menu.appendChild(btn);
  });
}

export async function renderAppStoreCategory() {
  const content = document.getElementById('appStoreContent');
  const category = linkStore.find(c => c.id === activeStoreCategoryId) || linkStore[0];
  if (!category) {
    content.innerHTML = '';
    return;
  }

  activeStoreCategoryId = category.id;
  content.innerHTML = '';

  if (category.dynamicType === BROWSER_BOOKMARKS_TYPE && !browserBookmarksLoaded) {
    const state = document.createElement('div');
    state.className = 'empty-group-state';
    state.textContent = '正在读取我的收藏夹…';
    content.appendChild(state);

    if (!globalThis.chrome?.runtime?.id || !globalThis.chrome?.permissions?.request) {
      state.textContent = '网页版无法直接读取 Edge 收藏夹。可在“设置 → 账户与同步”导入书签 HTML 文件，或使用扩展版。';
      const installLink = document.createElement('a');
      installLink.className = 'btn primary';
      installLink.href = 'install.html';
      installLink.target = '_blank';
      installLink.rel = 'noopener noreferrer';
      installLink.textContent = '查看扩展安装方法';
      state.append(document.createElement('br'), installLink);
      return;
    }

    const granted = await requestBookmarksPermission();
    if (!granted) {
      state.textContent = '需要允许读取书签，才能显示我的收藏夹。';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn primary';
      retryBtn.textContent = '允许读取收藏夹';
      retryBtn.style.marginTop = '12px';
      retryBtn.addEventListener('click', renderAppStoreCategory);
      state.appendChild(document.createElement('br'));
      state.appendChild(retryBtn);
      return;
    }

    try {
      category.links = flattenBrowserBookmarks(await readBrowserBookmarks());
      browserBookmarksLoaded = true;
      mergeBookmarkSelectionFromGroup(category);
      renderStoreMenu();
      if (activeStoreCategoryId === category.id) renderAppStoreCategory();
    } catch (error) {
      state.textContent = `读取收藏夹失败：${error.message}`;
    }
    return;
  }

  const selectedMap = getSelectedStoreMap();
  const categoryDiv = document.createElement('div');
  categoryDiv.className = 'store-category';

  const title = document.createElement('h4');
  title.className = 'store-category-title';
  title.textContent = category.name;
  categoryDiv.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'store-links-grid';

  if (category.links.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-group-state';
    empty.textContent = category.dynamicType === BROWSER_BOOKMARKS_TYPE
      ? '收藏夹中暂无可添加的网站'
      : '此分类暂无内容';
    grid.appendChild(empty);
  }

  category.links.forEach(link => {
    const label = document.createElement('label');
    label.className = 'store-link-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = link.url;
    checkbox.className = 'store-checkbox';
    checkbox.checked = selectedMap.has(link.url);

    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedMap.set(link.url, link);
      } else {
        selectedMap.delete(link.url);
      }
      selectedStoreLinks = Array.from(selectedMap.values());
      updateStoreSelectionCount();
    });

    const icon = document.createElement('img');
    icon.src = getFaviconUrl(link.url);
    icon.alt = '';
    icon.className = 'store-icon';

    const span = document.createElement('span');
    span.textContent = link.name;
    if (link.bookmarkPath) span.title = `${link.bookmarkPath} / ${link.name}`;
    span.className = 'store-name';

    // Circle-check indicator on right side
    const circleCheck = document.createElement('span');
    circleCheck.className = 'store-circle-check';
    circleCheck.innerHTML = lucideIcon('check', 11).replace('stroke="currentColor"', 'stroke="white"');

    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(span);
    label.appendChild(circleCheck);
    grid.appendChild(label);
  });

  categoryDiv.appendChild(grid);
  content.appendChild(categoryDiv);
  updateStoreSelectionCount();
}

export function renderStoreGroupSelection(selectedId) {
  const select = document.getElementById('storeGroupSelect');
  const groupField = select.closest('.form-group');
  let container = document.getElementById('storeGroupSelection');

  if (!container) {
    container = document.createElement('div');
    container.id = 'storeGroupSelection';
    container.className = 'group-selection-grid store-group-selection';
    groupField.insertBefore(container, select);
  }

  select.style.display = 'none';
  const customSelect = select.nextElementSibling;
  if (customSelect?.classList.contains('custom-select-container')) {
    customSelect.style.display = 'none';
  }

  if (!selectedId && appData.groups.length > 0) {
    selectedId = appData.groups[0].id;
  }

  select.innerHTML = '';
  appData.groups.forEach(group => {
    const opt = document.createElement('option');
    opt.value = group.id;
    opt.textContent = group.name;
    select.appendChild(opt);
  });

  currentStoreGroupId = selectedId || '';
  select.value = currentStoreGroupId;
  container.innerHTML = '';

  appData.groups.forEach(group => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `group-select-btn ${group.id === currentStoreGroupId ? 'active' : ''}`;
    btn.textContent = group.name;
    btn.title = group.name;
    btn.addEventListener('click', () => {
      renderStoreGroupSelection(group.id);
      setStoreSelectionFromGroup(group.id);
      renderAppStoreCategory();
    });
    container.appendChild(btn);
  });

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'group-select-btn new-group';
  newBtn.textContent = '+ 新建分组';
  newBtn.addEventListener('click', () => {
    openGroupModal(null, { source: 'store' });
  });
  container.appendChild(newBtn);
}

export function renderAppStore() {
  ensureStoreLayout();
  browserBookmarksLoaded = false;
  activeStoreCategoryId = activeStoreCategoryId || linkStore[0]?.id || null;
  const addStoreLinksBtn = document.getElementById('addStoreLinksBtn');
  if (addStoreLinksBtn) {
    addStoreLinksBtn.innerHTML = '保存选中 (<span id="selectedLinksCount">0</span>)';
  }

  const storeGroupSelectEl = document.getElementById('storeGroupSelect');
  storeGroupSelectEl.innerHTML = '';

  if (appData.groups.length === 0) {
    appData.groups.push({
      id: generateId(),
      name: '应用商店',
      collapsed: false,
      links: [],
      column: 0,
      linksPerRow: 'auto'
    });
    syncManager.saveData();
    render();
  }

  if (!currentStoreGroupId || !appData.groups.some(g => g.id === currentStoreGroupId)) {
    currentStoreGroupId = appData.groups[0]?.id || '';
  }

  appData.groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    opt.selected = g.id === currentStoreGroupId;
    storeGroupSelectEl.appendChild(opt);
  });

  renderStoreGroupSelection(currentStoreGroupId);
  setStoreSelectionFromGroup(currentStoreGroupId);
  renderStoreMenu();
  renderAppStoreCategory();
}

document.getElementById('closeAppStoreBtn').addEventListener('click', closeAllModals);

document.getElementById('appStoreBtn').addEventListener('click', () => {
  if (!appData) return;
  renderAppStore();
  closeAllModals();
  document.getElementById('modalOverlay').classList.remove('hidden');
  appStoreModal.classList.remove('hidden');
});

document.getElementById('addStoreLinksBtn').addEventListener('click', async () => {

  const groupId = currentStoreGroupId || document.getElementById('storeGroupSelect').value;
  const group = appData.groups.find(g => g.id === groupId);
  if (!group) {
    setStoreStatus('请选择有效分组', 'warning');
    return;
  }

  const selectedMap = getSelectedStoreMap();
  const storeUrlSet = new Set(getStoreLinkMap().keys());
  delete group.browserBookmarksEnabled;
  group.links = group.links.filter(link => {
    if (link.source === BROWSER_BOOKMARK_SOURCE && browserBookmarksLoaded) {
      return selectedMap.has(link.url);
    }
    return !storeUrlSet.has(link.url) || selectedMap.has(link.url);
  });

  selectedStoreLinks.forEach(link => {
    if (!group.links.find(existing => existing.url === link.url)) {
      const savedLink = {
        id: generateId(),
        title: link.name,
        url: link.url
      };
      if (link.type === BROWSER_BOOKMARKS_TYPE) {
        savedLink.source = BROWSER_BOOKMARK_SOURCE;
        savedLink.bookmarkId = link.bookmarkId;
        savedLink.bookmarkPath = link.bookmarkPath;
      }
      group.links.push(savedLink);
    }
  });

  try {
    if (!await syncManager.saveData()) throw new Error(syncManager.error || '更改尚未保存，请重试同步');
    render();
    closeAllModals();
  } catch (error) {
    setStoreStatus(`保存失败：${error.message}`, 'warning');
  }
});

