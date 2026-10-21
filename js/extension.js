import { appData, syncManager } from './storage.js';
import { render } from './render.js';
import { generateId } from './utils.js';

const environment = document.getElementById('extensionEnvironment');
if (environment && globalThis.chrome?.runtime?.id) {
  environment.textContent = '你正在使用扩展版，可在热门网站的“我的收藏夹”中授权读取书签。';
}

// Read only anchors from an inert document; never insert imported HTML into the UI.
export function parseBookmarkHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seen = new Set();
  const links = [];
  for (const anchor of doc.querySelectorAll('a[href]')) {
    try {
      const url = new URL(anchor.getAttribute('href'));
      if (!['https:', 'http:'].includes(url.protocol) || seen.has(url.href)) continue;
      seen.add(url.href);
      links.push({ id: generateId(), title: anchor.textContent.trim() || url.hostname, url: url.href });
    } catch { /* Skip invalid URLs and bookmarklets. */ }
  }
  return links;
}

const fileInput = document.getElementById('bookmarkFile');
fileInput?.addEventListener('change', async () => {
  const file = fileInput.files[0];
  const status = document.getElementById('bookmarkImportStatus');
  if (!file) return;
  fileInput.disabled = true;
  let group;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('请选择小于 5 MB 的书签 HTML 文件。');
    const links = parseBookmarkHTML(await file.text());
    if (!links.length) throw new Error('文件中没有可导入的 HTTP/HTTPS 书签。');
    if (links.length > 5000) throw new Error('一次最多导入 5000 条书签，请拆分文件后重试。');
    group = { id: generateId(), name: '导入的收藏夹', collapsed: false, links };
    appData.groups.push(group);
    await syncManager.saveData();
    render();
    status.textContent = `已导入 ${links.length} 条书签到“导入的收藏夹”。`;
  } catch (error) {
    if (group) appData.groups.splice(appData.groups.indexOf(group), 1);
    status.textContent = error.message || '导入失败，请重试。';
  } finally {
    fileInput.disabled = false;
    fileInput.value = '';
  }
});
