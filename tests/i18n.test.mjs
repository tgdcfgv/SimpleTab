import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { t, loadLocale, resolveLocale } from '../js/i18n.js';
import { normalizeAppData, createDefaultData, defaultSearchSettings, ensureTemporaryGroup } from '../js/data.js';
import { catalogForLocale } from '../js/catalog.js';
import { searchRegion } from '../js/search-locale.js';
const nativeFetch = globalThis.fetch;
globalThis.fetch = async url => new Response(await readFile(url));

test('browser language variants resolve to the four supported locales', () => {
  for (const [input, expected] of [['zh-Hans-CN','zh_CN'],['zh-Hant','zh_TW'],['zh-HK','zh_TW'],['zh-MO','zh_TW'],['ja-JP','ja'],['en-GB','en'],['fr-FR','en']]) assert.equal(resolveLocale(input), expected);
});

test('catalogs have matching keys and substitution parameters', async () => {
  const catalogs = await Promise.all(['zh_CN','en','zh_TW','ja'].map(lang => readFile(new URL(`../_locales/${lang}/messages.json`, import.meta.url), 'utf8').then(JSON.parse)));
  const parameters = text => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
  for (const catalog of catalogs) {
    assert.deepEqual(Object.keys(catalog), Object.keys(catalogs[0]));
    for (const [key, value] of Object.entries(catalog)) {
      assert(value.message.trim());
      assert.deepEqual(parameters(value.message), parameters(catalogs[0][key].message), key);
    }
  }
});

test('translations preserve user substitutions and support markup fragments', async () => {
  await loadLocale('en');
  const name = '设置 <script>not executed</script> {0}';
  assert.equal(t`松开添加到「${name}」`, `Release to add to “${name}”`);
  assert.equal(t`<button title="编辑${name}">删除</button>`, `<button title="Edit ${name}">Delete</button>`);
  assert.equal(t`<i>${'ignored'}</i><button aria-label="选择${name}">保存</button>`, `<i>ignored</i><button aria-label="Select ${name}">Save</button>`);
  await loadLocale('zh_CN');
});

test('new-user profiles follow language while existing bookmarks and search choices survive', async () => {
  for (const language of ['zh_CN','en','zh_TW','ja']) {
    await loadLocale(language);
    const fresh = createDefaultData();
    assert.equal(fresh.settings.language, language);
    assert.equal(fresh.settings.searchEngine, language === 'zh_CN' ? 'bing' : 'google');
    if (language !== 'zh_CN') {
      assert(fresh.groups[0].links.some(link => link.title === 'YouTube'));
      assert(!catalogForLocale().flatMap(group => group.links).some(link => /[\u3400-\u9fff]/.test(link.name)));
    }
    const existing = normalizeAppData({ settings: { language, searchEngine: 'baidu', enabledSearchEngines: ['baidu'] }, groups: [{ id: 'mine', name: '我的分组', links: [{ id: 'link', title: '设置', url: 'https://example.org' }] }] });
    assert.equal(existing.groups[0].name, '我的分组');
    assert.equal(existing.groups[0].links[0].title, '设置');
    assert.equal(existing.settings.searchEngine, 'baidu');
    assert.equal(ensureTemporaryGroup([{ name: '临时收藏', links: [] }]).length, 1);
    assert.equal(ensureTemporaryGroup([{ kind: 'temporary', name: 'My inbox', links: [] }]).length, 1);
  }
  assert(defaultSearchSettings('ja').enabledSearchEngines.includes('yahoo-jp'));
  assert.deepEqual(['zh_CN','zh_TW','ja','en'].map(searchRegion), ['cn','tw','jp','us']);
  await loadLocale('zh_CN');
  globalThis.fetch = nativeFetch;
});
