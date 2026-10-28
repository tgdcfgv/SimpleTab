import test from 'node:test';
import assert from 'node:assert/strict';
import { readCloudCache, writeCloudCache, clearCloudCache } from '../js/cloud-cache.js';
import { cloud } from '../js/cloud.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};
const data = { settings: {}, groups: [] };
const session = userId => ({ user: { id: userId }, access_token: 'token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600 });

test('account caches are isolated from guest data and other accounts', async () => {
  values.clear(); cloud.storeSession(session('a'));
  values.set('appData', 'guest');
  await writeCloudCache('a', data, 2);
  assert.equal((await readCloudCache('a')).revision, 2);
  assert.equal(await readCloudCache('b'), null);
  await writeCloudCache('b', data, 3);
  assert.equal(await readCloudCache('b'), null);
  assert.equal(values.get('appData'), 'guest');
});

test('late responses cannot roll back the cached revision', async () => {
  await writeCloudCache('a', data, 4);
  await writeCloudCache('a', { ...data, extra: 'stale' }, 3);
  assert.equal((await readCloudCache('a')).revision, 4);
  assert.equal((await readCloudCache('a')).data.extra, undefined);
});

test('corrupt, malformed and mismatched caches are ignored', async () => {
  for (const value of ['{', '{}', JSON.stringify({ userId: 'b', data, revision: 1 }), JSON.stringify({ userId: 'a', data, revision: null })]) {
    values.set('simtab.cloud-cache.a', value);
    assert.equal(await readCloudCache('a'), null);
  }
});

test('cache quota failure does not fail a cloud operation', async () => {
  const set = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota'); };
  try { await assert.doesNotReject(writeCloudCache('a', data, 5)); }
  finally { localStorage.setItem = set; }
});

test('sign out and account changes remove the previous cache', async () => {
  await writeCloudCache('a', data, 6);
  cloud.storeSession(session('b'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(await readCloudCache('a'), null);
  await writeCloudCache('b', data, 1);
  cloud.storeSession(null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(await readCloudCache('b'), null);
  await writeCloudCache('b', data, 2);
  assert.equal(await readCloudCache('b'), null, 'late save after logout cannot recreate the cache');
  await clearCloudCache('b');
});

test('restoring a saved session does not request the user before reading data', async () => {
  cloud.storeSession(session('a'));
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('[]'); };
  await cloud.restore();
  assert.equal(calls, 0);
  await cloud.read();
  assert.equal(calls, 1);
});
