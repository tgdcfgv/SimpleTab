import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { t, loadLocale, resolveLocale } from '../js/i18n.js';
import { normalizeAppData, createDefaultData, defaultSearchSettings, ensureTemporaryGroup } from '../js/data.js';
import { catalogForLocale } from '../js/catalog.js';
import { searchRegion } from '../js/search-locale.js';
const nativeFetch = globalThis.fetch;
globalThis.fetch = async url => new Response(await readFile(url));

test('browser language variants resolve to the supported locales', () => {
  for (const [input, expected] of [
    ['zh-Hans-CN','zh_CN'],['zh-Hant','zh_TW'],['zh-HK','zh_TW'],['zh-MO','zh_TW'],
    ['ja-JP','ja'],['ko-KR','ko'],['es-ES','es'],['es-419','es'],['de-DE','de'],['de-AT','de'],['de-CH','de'],
    ['pt-BR','pt_BR'],['pt-PT','pt_BR'],['fr-FR','fr'],['fr-CA','fr'],['en-GB','en'],['it-IT','en']
  ]) assert.equal(resolveLocale(input), expected);
});

test('catalogs have matching keys and substitution parameters', async () => {
  const catalogs = await Promise.all(['zh_CN','en','zh_TW','ja','ko','es','de','pt_BR','fr'].map(lang => readFile(new URL(`../_locales/${lang}/messages.json`, import.meta.url), 'utf8').then(JSON.parse)));
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
  for (const language of ['zh_CN','en','zh_TW','ja','ko','es','de','pt_BR','fr']) {
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
  assert(defaultSearchSettings('ko').enabledSearchEngines.includes('naver'));
  assert.deepEqual(['zh_CN','zh_TW','ja','ko','es','de','pt_BR','fr','en'].map(searchRegion), ['cn','tw','jp','kr','es','de','br','fr','us']);
  await loadLocale('zh_CN');
  const zhCatalog = catalogForLocale('zh_CN');
  const aiLinks = zhCatalog.find(group => group.id === 'ai').links;
  for (const expectedName of ['腾讯Workbuddy', '千问办公', '豆包工作', 'Google Notebook', 'Meta Muse']) {
    assert(aiLinks.some(link => link.name === expectedName), `missing ${expectedName}`);
  }
  for (const group of zhCatalog.filter(item => !item.dynamicType)) {
    assert(!group.name.includes('与') && !group.name.includes('国际') && !group.name.includes('国内'), `disallowed category name ${group.name}`);
    assert(group.links.every(link => typeof link.section === 'string' && link.section.length > 0), `missing section in ${group.id}`);
    assert(group.links.every(link => !link.section.includes('与') && !link.section.includes('国际') && !link.section.includes('国内')), `disallowed section in ${group.id}`);
  }
  await loadLocale('en');
  const enCatalog = catalogForLocale('en');
  for (const group of enCatalog.filter(item => !item.dynamicType)) {
    assert(!group.links.some(link => /[\u3400-\u9fff]/.test(link.section || '')), `untranslated section in ${group.id}`);
  }
  await loadLocale('zh_CN');
  globalThis.fetch = nativeFetch;
});
