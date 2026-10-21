// Uploaded wallpaper is a browser preference, stored separately from account data.
const DB_NAME = 'simtab-assets';
const KEY = 'wallpaper';
const MAX_BYTES = 10 * 1024 * 1024;
let currentUrl = null;
let operation = Promise.resolve();

function withStore(mode, action) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('壁纸存储被其他页面占用，请关闭旧页面后重试。'));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('assets', mode);
      const result = action(transaction.objectStore('assets'));
      transaction.oncomplete = () => { db.close(); resolve(result.result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}

function serialize(action) {
  const next = operation.then(action);
  operation = next.catch(() => {});
  return next;
}

export function saveWallpaper(blob) {
  return serialize(async () => {
    if (!/^image\/(png|jpeg|gif|webp|avif)$/i.test(blob.type) || !blob.size || blob.size > MAX_BYTES) {
      throw new Error('请选择不超过 10 MB 的 PNG、JPEG、GIF、WebP 或 AVIF 图片。');
    }
    await withStore('readwrite', store => store.put(blob, KEY));
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
  });
}

export function clearWallpaper() {
  return serialize(async () => {
    await withStore('readwrite', store => store.delete(KEY));
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  });
}

export function getWallpaperUrl() {
  return serialize(async () => {
    if (!currentUrl) {
      const blob = await withStore('readonly', store => store.get(KEY));
      if (blob) currentUrl = URL.createObjectURL(blob);
    }
    return currentUrl;
  });
}

export async function migrateWallpaper(data) {
  const value = data.settings.wallpaper;
  if (typeof value !== 'string' || !value.startsWith('data:')) return false;
  // Do not remove the source until the independent transaction has committed.
  const blob = await (await fetch(value)).blob();
  await saveWallpaper(blob);
  data.settings.wallpaper = null;
  return true;
}

export function portableSnapshot(data) {
  const snapshot = JSON.parse(JSON.stringify(data));
  // Defense in depth: embedded images never enter localStorage or the cloud payload.
  if (snapshot.settings?.wallpaper?.startsWith('data:')) snapshot.settings.wallpaper = null;
  return snapshot;
}
