import { escapeHTML, getFaviconUrl } from './utils.js';

const colors = ['#4338CA', '#0369A1', '#047857', '#A16207', '#B91C1C', '#A21CAF', '#6D28D9', '#0F766E'];
const requests = new Map();
const imageLoads = new WeakMap();
const failureCacheMs = 5 * 60 * 1000;
const glyphPositions = new Map();
let textContext;

function centeredGlyph(letter) {
  if (glyphPositions.has(letter)) return glyphPositions.get(letter);
  textContext ??= globalThis.document?.createElement('canvas').getContext('2d');
  let position = 'x="32" y="32" text-anchor="middle" dominant-baseline="central"';
  if (textContext) {
    textContext.font = '600 34px system-ui, sans-serif';
    const metrics = textContext.measureText(letter);
    // Center the visible glyph bounds, rather than the font's line box.
    // Latin capitals and Chinese characters have different font baselines.
    const x = 32 + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;
    const y = 32 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    position = `x="${x.toFixed(3)}" y="${y.toFixed(3)}"`;
  }
  glyphPositions.set(letter, position);
  return position;
}

export function letterBadge(url, title = '') {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* Use the title. */ }
  const label = String(title).trim() || host || 'S';
  const letter = (label.match(/[\p{L}\p{N}]/u)?.[0] || 'S').toLocaleUpperCase();
  let hash = 0;
  for (const char of host || label) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${colors[hash % colors.length]}"/><text ${centeredGlyph(letter)} fill="white" font-family="system-ui,sans-serif" font-size="34" font-weight="600">${escapeHTML(letter)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveIcon(source, timeoutMs) {
  const cached = requests.get(source);
  if (cached && Date.now() < cached.expiresAt) return cached;
  const entry = { value: null, expiresAt: Infinity, promise: null };
  entry.promise = new Promise(resolve => {
    const probe = new Image();
    const finish = value => {
      clearTimeout(timer);
      probe.onload = probe.onerror = null;
      if (!value) probe.removeAttribute('src');
      entry.value = value;
      entry.expiresAt = value ? Infinity : Date.now() + failureCacheMs;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    probe.onload = () => finish(probe.naturalWidth > 0 ? source : null);
    probe.onerror = () => finish(null);
    probe.referrerPolicy = 'no-referrer';
    probe.src = source;
  });
  if (requests.size >= 256) requests.delete(requests.keys().next().value);
  requests.set(source, entry);
  return entry;
}

// Show a local badge until a remote image has actually loaded. A failed or
// stalled request never becomes the visible image, so no broken icon flashes.
export function loadSiteIcon(image, link, { timeoutMs = 5000 } = {}) {
  const badge = letterBadge(link.url, link.title || link.name);
  const token = {};
  imageLoads.set(image, token);
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  const source = link.customIcon || getFaviconUrl(link.url);
  const entry = resolveIcon(source, timeoutMs);
  const showLoaded = loaded => {
    if (loaded && imageLoads.get(image) === token) {
      image.addEventListener('error', () => {
        if (imageLoads.get(image) !== token) return;
        image.src = badge;
        if (requests.get(source) === entry) requests.delete(source);
      }, { once: true });
      image.src = loaded;
    }
  };
  // A completed successful load can be displayed synchronously on re-render.
  const alreadyLoaded = Boolean(entry.value);
  if (alreadyLoaded) showLoaded(entry.value);
  else image.src = badge;
  return entry.promise.then(loaded => {
    if (!alreadyLoaded) showLoaded(loaded);
  });
}
