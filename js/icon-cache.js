const KEY = 'simtab.site-icons.v1';
const MAX_ENTRIES = 256;
const MAX_BYTES = 2 * 1024 * 1024;

async function read() {
  const store = globalThis.chrome?.storage?.local;
  let value;
  if (store) value = (await store.get(KEY))[KEY];
  else {
    const stored = localStorage.getItem(KEY);
    try { value = JSON.parse(stored || '{}'); } catch { value = {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function valid(entry) {
  return entry && Number.isFinite(entry.expiresAt) &&
    (entry.value === null || (typeof entry.value === 'string' &&
      (/^data:image\/png;base64,[a-z\d+/=]+$/i.test(entry.value) || /^https?:\/\//i.test(entry.value))));
}

export async function readIconCache() {
  try {
    return Object.entries(await read()).filter(([, entry]) => valid(entry) &&
      (entry.value || entry.expiresAt > Date.now())).slice(-MAX_ENTRIES);
  } catch { return []; }
}

export async function writeIconCache(source, entry) {
  if (source.length > 2048 || (entry !== null && !valid(entry))) return;
  const commit = async () => {
    const entries = await read();
    delete entries[source];
    if (entry) entries[source] = entry;
    const retained = Object.entries(entries).filter(([, value]) => valid(value) &&
      (value.value || value.expiresAt > Date.now())).slice(-MAX_ENTRIES);
    let value = Object.fromEntries(retained);
    while (JSON.stringify(value).length > MAX_BYTES && retained.length) {
      retained.shift();
      value = Object.fromEntries(retained);
    }
    const store = globalThis.chrome?.storage?.local;
    if (store) await store.set({ [KEY]: value });
    else localStorage.setItem(KEY, JSON.stringify(value));
  };
  try {
    if (globalThis.navigator?.locks) await navigator.locks.request('simtab-icon-cache', commit);
    else await commit();
  } catch { /* Icons still work when local storage is full or unavailable. */ }
}
