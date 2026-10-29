import { t } from './i18n.js';
import { generateId } from './utils.js';

const environment = document.getElementById('extensionEnvironment');
if (environment && globalThis.chrome?.runtime?.id) {
  environment.textContent = t('你正在使用扩展版，可在热门网站的“我的收藏夹”中授权读取书签。');
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

// Preserve browser folders as group paths in the two-level editor.
export function parseBookmarkGroups(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const groups = new Map();
  const seen = new Set();
  for (const anchor of doc.querySelectorAll('a[href]')) {
    try {
      const url = new URL(anchor.getAttribute('href'));
      if (!['https:', 'http:'].includes(url.protocol) || seen.has(url.href)) continue;
      seen.add(url.href);
      const names = [];
      let folder = anchor.closest('dl');
      while (folder) {
        const heading = folder.previousElementSibling?.tagName === 'H3' ? folder.previousElementSibling
          : folder.parentElement?.tagName === 'DT' ? folder.parentElement.querySelector(':scope > h3') : null;
        if (heading?.textContent.trim()) names.unshift(heading.textContent.trim());
        folder = folder.parentElement?.closest('dl');
      }
      const name = names.join(' / ') || t('导入的收藏夹');
      if (!groups.has(name)) groups.set(name, { id: generateId(), name, collapsed: false, links: [] });
      groups.get(name).links.push({ id: generateId(), title: anchor.textContent.trim() || url.hostname, url: url.href });
    } catch { /* Skip invalid URLs and bookmarklets. */ }
  }
  return [...groups.values()];
}

const fileInput = document.getElementById('bookmarkFile');
fileInput?.addEventListener('change', async () => {
  const file = fileInput.files[0];
  const status = document.getElementById('bookmarkImportStatus');
  if (!file) return;
  fileInput.disabled = true;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error(t('请选择小于 5 MB 的书签 HTML 文件。'));
    const groups = parseBookmarkGroups(await file.text());
    const count = groups.reduce((total, group) => total + group.links.length, 0);
    if (!count) throw new Error(t('文件中没有可导入的 HTTP/HTTPS 书签。'));
    if (count > 5000) throw new Error(t('一次最多导入 5000 条书签，请拆分文件后重试。'));
    status.textContent = t`已读取 ${count} 条书签，请在大纲中预览并保存。`;
    document.dispatchEvent(new CustomEvent('simtab-bookmark-preview', { detail: { groups, count, filename: file.name } }));
  } catch (error) {
    status.textContent = error.message || t('导入失败，请重试。');
  } finally {
    fileInput.disabled = false;
    fileInput.value = '';
  }
});
