import test from 'node:test';
import assert from 'node:assert/strict';
import { readIconCache, writeIconCache } from '../js/icon-cache.js';

const KEY = 'simtab.site-icons.v1';
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value)
};
const png = 'data:image/png;base64,AAAA';

test('persists success and failure records separately from account and guest contents', async () => {
  values.clear();
  values.set('appData', 'guest');
  values.set('simtab.auth', 'session');
  await writeIconCache('https://icons.test/good', { value: png, expiresAt: Date.now() + 1000 });
  await writeIconCache('https://icons.test/bad', { value: null, expiresAt: Date.now() + 1000 });
  const entries = new Map(await readIconCache());
  assert.equal(entries.get('https://icons.test/good').value, png);
  assert.equal(entries.get('https://icons.test/bad').value, null);
  assert.equal(values.get('appData'), 'guest');
  assert.equal(values.get('simtab.auth'), 'session');
});

test('expired failures retry while expired successful images remain available during refresh', async () => {
  values.set(KEY, JSON.stringify({
    good: { value: png, expiresAt: Date.now() - 1 },
    bad: { value: null, expiresAt: Date.now() - 1 },
    malformed: { value: 'javascript:invalid', expiresAt: Date.now() + 1000 }
  }));
  assert.deepEqual((await readIconCache()).map(([source]) => source), ['good']);
});

test('bounds cache entries and supports explicit invalidation', async () => {
  values.set(KEY, JSON.stringify(Object.fromEntries(Array.from({ length: 256 }, (_, index) =>
    [`https://icons.test/${index}`, { value: png, expiresAt: Date.now() + 1000 }]))));
  await writeIconCache('https://icons.test/new', { value: png, expiresAt: Date.now() + 1000 });
  const entries = new Map(await readIconCache());
  assert.equal(entries.size, 256);
  assert.equal(entries.has('https://icons.test/0'), false);
  await writeIconCache('https://icons.test/new', null);
  assert.equal(new Map(await readIconCache()).has('https://icons.test/new'), false);
});

test('corrupt and unavailable storage do not prevent icons from loading', async () => {
  values.set(KEY, '{bad json');
  assert.deepEqual(await readIconCache(), []);
  await assert.doesNotReject(writeIconCache('https://icons.test/new', { value: png, expiresAt: Date.now() + 1000 }));
  assert.equal(new Map(await readIconCache()).get('https://icons.test/new').value, png, 'a corrupt cache can be rebuilt');
  values.set(KEY, '{}');
  const set = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota'); };
  try { await assert.doesNotReject(writeIconCache('https://icons.test/new', { value: png, expiresAt: Date.now() + 1000 })); }
  finally { localStorage.setItem = set; }
});
