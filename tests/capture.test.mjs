import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppData } from '../js/data.js';
import { CAPTURE_PREFIX, CAPTURE_MAX_AGE, captureDraft, validDraft, addCapturedLink } from '../js/capture-model.js';
import { fingerprint, writeLocalSnapshot } from '../js/local-store.js';

const listeners = {};
const event = name => ({ addListener: handler => { listeners[name] = handler; } });
globalThis.chrome = {
  runtime: { onInstalled: event('installed') },
  action: { onClicked: event('action') },
  contextMenus: { onClicked: event('menu') }
};
const { openCapture, CAPTURE_MENU_ID } = await import('../js/background.js');

function mockAPI() {
  const values = { unrelated: 'keep', [CAPTURE_PREFIX + 'expired']: { createdAt: 1 } };
  const opened = [];
  return { values, opened,
    storage: { session: {
      get: async () => ({ ...values }),
      set: async data => Object.assign(values, data),
      remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; }
    } },
    tabs: { create: async tab => { opened.push(tab); } },
    runtime: { getURL: value => 'chrome-extension://test/' + value }
  };
}

test('capture drafts allow web pages only, expire, and limit titles', () => {
  assert.equal(captureDraft({ url: 'chrome://settings', title: 'Settings' }, 1).url, null);
  assert.equal(captureDraft({ url: 'javascript:alert(1)' }, 1).url, null);
  assert.equal(captureDraft({ url: 'https://user:pass@example.org' }, 1).url, null);
  const draft = captureDraft({ url: 'https://example.org', title: 'x'.repeat(1000) }, 100);
  assert.equal(draft.title.length, 500);
  assert.equal(validDraft(draft, 100 + CAPTURE_MAX_AGE - 1), true);
  assert.equal(validDraft(draft, 100 + CAPTURE_MAX_AGE), false);
  assert.equal(validDraft(draft, 99), false);
});

test('adds to the chosen space without changing the active alias; duplicates are group-specific', () => {
  const data = normalizeAppData(null);
  const active = data.groups;
  const request = { spaceId: data.spaces[1].id, groupId: data.spaces[1].groups[0].id,
    title: '', url: 'https://example.org' };
  assert.equal(addCapturedLink(data, request, 'new-id').link.title, 'example.org');
  assert.equal(data.groups, active);
  assert.equal(data.spaces[1].groups[0].links.length, 1);
  assert.equal(addCapturedLink(data, { ...request, url: 'https://example.org/' }, 'duplicate').added, false);
  assert.equal(data.spaces[1].groups[0].links.length, 1);
  assert.throws(() => addCapturedLink(data, { ...request, groupId: 'deleted' }, 'x'), /变更/);
  assert.throws(() => addCapturedLink(data, { ...request, url: 'javascript:evil' }, 'x'), /HTTP/);
});

test('worker stores isolated session drafts and opens a token-only URL; does not write bookmarks', async () => {
  const api = mockAPI();
  await openCapture({ url: 'https://example.org/private?query=secret', title: 'Private page' }, api);
  const keys = Object.keys(api.values).filter(key => key.startsWith(CAPTURE_PREFIX));
  assert.equal(keys.length, 1);
  assert.equal(api.values.unrelated, 'keep');
  assert.equal(api.values[keys[0]].title, 'Private page');
  assert.match(api.opened[0].url, /^chrome-extension:\/\/test\/newtab.html#capture=[\da-f-]{36}$/);
  assert.equal(api.opened[0].url.includes('secret'), false);
  await openCapture({ url: 'https://other.example.org' }, api);
  assert.equal(Object.keys(api.values).filter(key => key.startsWith(CAPTURE_PREFIX)).length, 2);
});

test('failed tab creation removes the new draft', async () => {
  const api = mockAPI();
  api.tabs.create = async () => { throw new Error('tab failure'); };
  await assert.rejects(openCapture({ url: 'https://example.org' }, api), /tab failure/);
  assert.deepEqual(api.values, { unrelated: 'keep' });
});

test('installs only the HTTP(S) page context menu and binds both entry points', async () => {
  const definitions = [];
  chrome.contextMenus.removeAll = async () => {};
  chrome.contextMenus.create = definition => definitions.push(definition);
  listeners.installed();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(definitions[0].id, CAPTURE_MENU_ID);
  assert.deepEqual(definitions[0].documentUrlPatterns, ['http://*/*', 'https://*/*']);
  assert.equal(typeof listeners.action, 'function');
  assert.equal(typeof listeners.menu, 'function');
});

test('toolbar and page menu listeners create drafts using their selected page URL', async () => {
  const api = mockAPI();
  Object.assign(chrome, { storage: api.storage, tabs: api.tabs });
  chrome.runtime.getURL = api.runtime.getURL;
  chrome.action.setTitle = chrome.action.setBadgeText = () => {};
  listeners.action({ id: 1, title: 'Toolbar', url: 'https://toolbar.example.org' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(api.opened.length, 1);
  listeners.menu({ menuItemId: CAPTURE_MENU_ID, pageUrl: 'https://page.example.org' }, { id: 2, title: 'Menu' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(api.opened.length, 2);
  assert.deepEqual(Object.entries(api.values).filter(([key]) => key.startsWith(CAPTURE_PREFIX)).map(([, draft]) => draft.url),
    ['https://toolbar.example.org/', 'https://page.example.org/']);
});

test('local saves reject stale snapshots under a shared lock', async () => {
  let stored = { version: 'original' };
  let queue = Promise.resolve();
  const locks = { request: (_, callback) => {
    const result = queue.then(callback);
    queue = result.catch(() => {});
    return result;
  } };
  const expected = fingerprint(stored);
  const save = version => writeLocalSnapshot({ locks, expected, snapshot: { version },
    read: async () => stored, write: async value => { stored = value; } });
  const results = await Promise.allSettled([save('first'), save('stale')]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.match(results[1].reason.message, /其他标签页/);
  assert.equal(stored.version, 'first');
});
