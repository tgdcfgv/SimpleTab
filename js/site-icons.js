import { escapeHTML, getFaviconUrl } from './utils.js';

const colors = ['#4338CA', '#0369A1', '#047857', '#A16207', '#B91C1C', '#A21CAF', '#6D28D9', '#0F766E'];
const requests = new Map();

export function letterBadge(url, title = '') {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* Use the title. */ }
  const label = String(title).trim() || host || 'S';
  const letter = (label.match(/[\p{L}\p{N}]/u)?.[0] || 'S').toLocaleUpperCase();
  let hash = 0;
  for (const char of host || label) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${colors[hash % colors.length]}"/><text x="32" y="33" dy=".1em" text-anchor="middle" dominant-baseline="central" fill="white" font-family="system-ui,sans-serif" font-size="34" font-weight="600">${escapeHTML(letter)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveIcon(source, timeoutMs) {
  if (requests.has(source)) return requests.get(source);
  const request = new Promise(resolve => {
    const probe = new Image();
    const finish = value => {
      clearTimeout(timer);
      probe.onload = probe.onerror = null;
      if (!value) probe.removeAttribute('src');
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    probe.onload = () => finish(probe.naturalWidth > 0 ? source : null);
    probe.onerror = () => finish(null);
    probe.referrerPolicy = 'no-referrer';
    probe.src = source;
  });
  if (requests.size >= 256) requests.delete(requests.keys().next().value);
  requests.set(source, request);
  return request;
}

// Show a local badge until a remote image has actually loaded. A failed or
// stalled request never becomes the visible image, so no broken icon flashes.
export function loadSiteIcon(image, link, { timeoutMs = 5000 } = {}) {
  const badge = letterBadge(link.url, link.title || link.name);
  image.src = badge;
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  const source = link.customIcon || getFaviconUrl(link.url);
  return resolveIcon(source, timeoutMs).then(loaded => {
    if (loaded && image.getAttribute('src') === badge) {
      image.addEventListener('error', () => { image.src = badge; }, { once: true });
      image.src = loaded;
    }
  });
}
