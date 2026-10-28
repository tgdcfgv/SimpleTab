// Shared by imports, cloud restoration, forms and search.
export function safeWebUrl(value, { allowBare = false } = {}) {
  if (typeof value !== 'string') return null;
  let input = value.trim();
  if (!input || /[\u0000-\u001f\u007f]/.test(input)) return null;
  if (allowBare && !/^[a-z][a-z\d+.-]*:/i.test(input)) input = `https://${input}`;
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

export function safeImageUrl(value) {
  return safeWebUrl(value) || (typeof value === 'string' &&
    /^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z\d+/=\s]+$/i.test(value) ? value : null);
}

export function deriveSiteTitle(urlStr) {
  if (typeof urlStr !== 'string' || !urlStr.trim()) return '';
  try {
    let input = urlStr.trim();
    if (!/^[a-z][a-z\d+.-]*:/i.test(input)) input = `https://${input}`;
    const url = new URL(input);
    let hostname = url.hostname.replace(/^www\./i, '');
    hostname = hostname.split('.')[0] || '';
    return hostname ? hostname.charAt(0).toUpperCase() + hostname.slice(1) : '';
  } catch {
    return '';
  }
}

function getTransferText(dataTransfer, type) {
  try {
    return typeof dataTransfer?.getData === 'function' ? (dataTransfer.getData(type) || '') : '';
  } catch {
    return '';
  }
}

function parseHtmlAnchor(html) {
  if (!html || !/<a\b/i.test(html)) return null;
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const anchor = doc.querySelector('a[href]');
      if (anchor) {
        const url = safeWebUrl(anchor.getAttribute('href') || '');
        const rawTitle = anchor.textContent
          || anchor.getAttribute('title')
          || anchor.querySelector('img[alt]')?.getAttribute('alt')
          || '';
        return url ? { url, title: rawTitle.replace(/\s+/g, ' ').trim() } : null;
      }
    } catch {}
  }
  const match = html.match(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const url = safeWebUrl(match[1] ?? match[2] ?? match[3] ?? '');
  if (!url) return null;
  const text = (match[4] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { url, title: text };
}

function isMeaningfulTitle(title, url) {
  if (!title) return false;
  const normalized = title.trim();
  if (!normalized || /^https?:\/\/\S+$/i.test(normalized)) return false;
  const stripSlash = value => value.replace(/\/+$/, '').toLowerCase();
  if (stripSlash(normalized) === stripSlash(url)) return false;
  try {
    const parsed = new URL(url);
    if (stripSlash(normalized) === stripSlash(parsed.host + parsed.pathname + parsed.search)) return false;
  } catch {}
  return true;
}

export function extractDroppedLink(dataTransfer) {
  if (!dataTransfer) return null;

  const uriListRaw = getTransferText(dataTransfer, 'text/uri-list');
  const mozUrlRaw = getTransferText(dataTransfer, 'text/x-moz-url');
  const htmlRaw = getTransferText(dataTransfer, 'text/html');
  const plainRaw = getTransferText(dataTransfer, 'text/plain');

  let uriListUrl = null;
  if (uriListRaw) {
    const firstUri = uriListRaw
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith('#'));
    if (firstUri) uriListUrl = safeWebUrl(firstUri);
  }

  let mozUrl = null;
  let mozTitle = '';
  if (mozUrlRaw) {
    const lines = mozUrlRaw.split(/\r?\n/);
    mozUrl = safeWebUrl(lines[0] || '');
    mozTitle = (lines[1] || '').replace(/\s+/g, ' ').trim();
  }

  const htmlParsed = parseHtmlAnchor(htmlRaw);
  const htmlUrl = htmlParsed?.url || null;
  const htmlTitle = htmlParsed?.title || '';

  let plainUrl = null;
  const hasFiles = (dataTransfer.files?.length || 0) > 0;
  if (plainRaw && !hasFiles) {
    const trimmed = plainRaw.trim();
    const firstLine = trimmed.split(/\r?\n/)[0]?.trim() || '';
    plainUrl = safeWebUrl(firstLine);
    if (!plainUrl && !/\s/.test(trimmed) && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:[/:?#]\S*)?$/i.test(firstLine)) {
      plainUrl = safeWebUrl(firstLine, { allowBare: true });
    }
  }

  const url = uriListUrl || htmlUrl || mozUrl || plainUrl;
  if (!url) return null;

  const explicitTitle = [htmlTitle, mozTitle].find(candidate => isMeaningfulTitle(candidate, url));
  const title = explicitTitle || deriveSiteTitle(url);

  return { url, title };
}
