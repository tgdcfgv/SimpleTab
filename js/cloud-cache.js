// Account snapshots are separate from guest appData and never contain credentials.
const keyFor = userId => `simtab.cloud-cache.${userId}`;
const extensionStore = () => globalThis.chrome?.storage?.local;

export async function readCloudCache(userId) {
  if (!userId) return null;
  try {
    const key = keyFor(userId);
    const store = extensionStore();
    const value = store ? (await store.get(key))[key] : JSON.parse(localStorage.getItem(key) || 'null');
    return value?.userId === userId && Number.isSafeInteger(value.revision) && value.revision > 0
      && value.data?.settings && (Array.isArray(value.data.spaces) || Array.isArray(value.data.groups)) ? value : null;
  } catch { return null; }
}

async function locked(action) {
  try {
    if (globalThis.navigator?.locks) return await navigator.locks.request('simtab-cloud-cache', action);
    return await action();
  } catch { /* Cache failures must not turn a successful cloud save into a failure. */ }
}

export function writeCloudCache(userId, data, revision) {
  return locked(async () => {
    const session = JSON.parse(localStorage.getItem('simtab.auth') || 'null');
    if (!userId || session?.user?.id !== userId) return;
    const previous = await readCloudCache(userId);
    if (previous && previous.revision > revision) return;
    const key = keyFor(userId);
    const value = { userId, data, revision };
    const store = extensionStore();
    if (store) await store.set({ [key]: value });
    else localStorage.setItem(key, JSON.stringify(value));
  });
}

export function clearCloudCache(userId) {
  if (!userId) return Promise.resolve();
  return locked(async () => {
    const key = keyFor(userId);
    const store = extensionStore();
    if (store) await store.remove(key);
    else localStorage.removeItem(key);
  });
}
