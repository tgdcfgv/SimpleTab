import { escapeHTML, getFaviconUrl } from './utils.js';
import { readIconCache, writeIconCache } from './icon-cache.js';

const colors = ['#4338CA', '#0369A1', '#047857', '#A16207', '#B91C1C', '#A21CAF', '#6D28D9', '#0F766E'];
const requests = new Map();
const imageLoads = new WeakMap();
const failureCacheMs = 24 * 60 * 60 * 1000;
const successCacheMs = 7 * 24 * 60 * 60 * 1000;
const glyphPositions = new Map();
const nativeFallbacks = new Map();
let textContext;
let initialization;

export function initSiteIcons() {
  return initialization ??= readIconCache().then(async entries => {
    const decoding = [];
    for (const [source, entry] of entries) {
      if (!requests.has(source)) requests.set(source, { ...entry, promise: Promise.resolve(entry.value) });
      if (entry.value?.startsWith('data:image/png;')) {
        const image = new Image();
        image.src = entry.value;
        decoding.push(image.decode().catch(() => {}));
      }
    }
    // Decode the tiny local PNGs before first render to avoid an empty-image frame.
    await Promise.all(decoding);
  });
}

export async function invalidateSiteIcon(url) {
  const source = getFaviconUrl(url);
  requests.delete(source);
  await writeIconCache(source, null);
}

function localImage(image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(image.naturalWidth, 64);
    canvas.height = Math.min(image.naturalHeight || image.naturalWidth, 64);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const value = canvas.toDataURL('image/png');
    return value.startsWith('data:image/png;base64,') ? value : null;
  } catch { return null; }
}

function nativeFaviconUrl(source) {
  try {
    const url = new URL(source);
    return url.protocol === 'chrome-extension:' && url.pathname === '/_favicon/' ? url : null;
  } catch { return null; }
}

function imageSignature(image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0) ? canvas.toDataURL() : '';
  } catch { return undefined; }
}

function nativeFallbackSignature(url, timeoutMs) {
  // The reserved .invalid host cannot have a real favicon in the browser cache.
  // Compare pixels instead of rejecting all 16px icons, which may be genuine.
  url.searchParams.set('pageUrl', 'https://simtab-missing-favicon.invalid/');
  const source = url.href;
  const key = `${source}:${globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches}`;
  if (nativeFallbacks.has(key)) return nativeFallbacks.get(key);
  const promise = new Promise(resolve => {
    const probe = new Image();
    const finish = signature => {
      clearTimeout(timer);
      probe.onload = probe.onerror = null;
      if (signature === undefined) {
        probe.removeAttribute('src');
        nativeFallbacks.delete(key);
      }
      resolve(signature);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    probe.onload = () => finish(imageSignature(probe));
    probe.onerror = () => finish(undefined);
    probe.src = source;
  });
  nativeFallbacks.set(key, promise);
  return promise;
}

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
  // An expired successful image stays visible during revalidation.
  const entry = { value: cached?.value || null, expiresAt: Infinity, promise: null };
  entry.promise = new Promise(resolve => {
    const probe = new Image();
    let finished = false;
    const finish = async value => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      probe.onload = probe.onerror = null;
      if (!value) probe.removeAttribute('src');
      entry.value = value || cached?.value || null;
      entry.expiresAt = Date.now() + (value ? successCacheMs : failureCacheMs);
      if (requests.get(source) === entry) await writeIconCache(source, { value: entry.value, expiresAt: entry.expiresAt });
      resolve(entry.value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    probe.onload = async () => {
      if (probe.naturalWidth <= 0) return finish(null);
      const nativeUrl = nativeFaviconUrl(source);
      if (nativeUrl) {
        const signature = imageSignature(probe);
        if (!signature) return finish(null);
        const fallback = await nativeFallbackSignature(nativeUrl, timeoutMs);
        if (fallback === undefined || signature === fallback) return finish(null);
      }
      finish(localImage(probe) || source);
    };
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
        void writeIconCache(source, { value: null, expiresAt: Date.now() + failureCacheMs });
      }, { once: true });
      image.src = loaded;
    }
  };
  // A completed successful load can be displayed synchronously on re-render.
  const alreadyLoaded = Boolean(entry.value);
  if (alreadyLoaded) showLoaded(entry.value);
  else image.src = badge;
  return entry.promise.then(loaded => {
    if (loaded !== entry.value || image.src === loaded) return;
    showLoaded(loaded);
  });
}
