import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppData } from '../js/data.js';
import { safeWebUrl, safeImageUrl } from '../js/urls.js';
import { findLinks, nextSelection, parseSuggestions } from '../js/search-model.js';
import { portableSnapshot } from '../js/wallpaper.js';

const group = links => ({ id: 'g', name: 'Group', links });

test('only HTTP(S) navigation survives normalization in every space and the active alias', () => {
  const links = ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://example.org', 'https://example.org', 'HTTP://example.net'];
  const input = { spaces: [{ id: 'a', name: 'A', groups: [group(links.map((url, i) => ({ id: i, title: 'link', url })))] },
    { id: 'b', name: 'B', groups: [group([{ url: 'javascript:alert(2)' }])] }], settings: {} };
  const data = normalizeAppData(input);
  assert.deepEqual(data.groups[0].links.map(l => l.url), ['https://example.org/', 'http://example.net/']);
  assert.equal(data.spaces[1].groups[0].links.length, 0);
  assert.equal(data.groups, data.spaces[0].groups);
  assert.equal(input.spaces[0].groups[0].links.length, 6);
});

test('legacy data and malformed records retain usable groups and defaults', () => {
  const data = normalizeAppData({ groups: [null, group([null, {}, { url: 'https://example.org', customIcon: 'javascript:evil' }])], settings: { enabledSearchEngines: ['unknown'] } });
  assert.equal(data.groups[0].links[0].customIcon, undefined);
  assert.equal(data.groups[0].links[0].title, 'example.org');
  assert.equal(data.spaces.length, 3);
  assert(data.groups.some(g => g.name === '临时收藏'));
  assert.equal(data.settings.searchEngine, 'bing');
  assert.throws(() => normalizeAppData('invalid'), TypeError);
  assert(normalizeAppData({ spaces: [null], settings: {} }).spaces.length);
});

test('invalid schemes cannot be disguised as bare URLs and image sources are restricted', () => {
  for (const value of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', '//', 'https://user:pass@example.org']) {
    assert.equal(safeWebUrl(value, { allowBare: true }), null);
  }
  assert.equal(safeWebUrl('example.org/path', { allowBare: true }), 'https://example.org/path');
  assert.equal(safeImageUrl('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(safeImageUrl('blob:https://example.org/id'), null);
});

test('search spans spaces, matches title or URL and limits results', () => {
  const data = normalizeAppData({ spaces: [
    { id: 'a', name: 'A', groups: [group([{ title: 'GitHub', url: 'https://github.com' }])] },
    { id: 'b', name: 'B', groups: [group([{ title: 'Code', url: 'https://gitlab.com' }, { title: 'bad', url: 'javascript:git' }])] }
  ], settings: {} });
  assert.deepEqual(findLinks(data, ' GIT ').map(l => l.spaceName), ['A', 'B']);
  assert.equal(findLinks(data, 'git', 1).length, 1);
  assert.equal(findLinks(data, '').length, 0);
});

test('keyboard selection includes an unselected web-search position', () => {
  assert.equal(nextSelection(-1, 1, 2), 0);
  assert.equal(nextSelection(0, 1, 2), 1);
  assert.equal(nextSelection(1, 1, 2), -1);
  assert.equal(nextSelection(-1, -1, 2), 1);
  assert.equal(nextSelection(0, -1, 2), -1);
  assert.equal(nextSelection(-1, 1, 0), -1);
});

test('portable snapshots never include an embedded wallpaper and do not mutate the source', () => {
  const data = { settings: { wallpaper: 'data:image/png;base64,AA==' } };
  assert.equal(portableSnapshot(data).settings.wallpaper, null);
  assert.match(data.settings.wallpaper, /^data:/);
});

test('parseSuggestions extracts valid list from OpenSearch JSON format', () => {
  assert.deepEqual(parseSuggestions(['bing', ['bing map', 'bing image', 'bing ai']]), ['bing map', 'bing image', 'bing ai']);
  assert.deepEqual(parseSuggestions(null), []);
  assert.deepEqual(parseSuggestions(['bing', []]), []);
  assert.deepEqual(parseSuggestions(['bing', ['a', '', null, 'b']], 1), ['a']);
});


test('Dock defaults hide the store and migrate legacy hidden position without losing position settings', () => {
  const defaults = normalizeAppData(null).settings;
  assert.equal(defaults.showDockStoreButton, false);
  assert.equal(defaults.dockEnabled, true);
  const hidden = normalizeAppData({ settings: { dockPosition: 'hidden' } }).settings;
  assert.equal(hidden.dockEnabled, false);
  assert.equal(hidden.dockPosition, 'bottom');
  const custom = normalizeAppData({ settings: { dockEnabled: false, dockPosition: 'right', hiddenDockSpaces: ['space-work'] } }).settings;
  assert.equal(custom.dockPosition, 'right');
  assert.deepEqual(custom.hiddenDockSpaces, ['space-work']);
});

test('cloud snapshots exclude legacy remote wallpaper URLs as well as embedded images', () => {
  assert.equal(portableSnapshot({ settings: { wallpaper: 'https://example.test/photo.png' } }).settings.wallpaper, null);
});
