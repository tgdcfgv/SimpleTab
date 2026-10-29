// UI strings live in Chrome-compatible _locales catalogs. User data never enters
// the translator: template substitutions are inserted only after translation.
export const LANGUAGES = [
  { id: 'zh_CN', name: '简体中文' }, { id: 'en', name: 'English' },
  { id: 'zh_TW', name: '繁體中文' }, { id: 'ja', name: '日本語' }
];
export function resolveLocale(value = '') {
  const tag = String(value).replaceAll('_', '-').toLowerCase();
  if (/^zh-(tw|hk|mo|hant)(-|$)/.test(tag)) return 'zh_TW';
  if (tag === 'zh' || tag.startsWith('zh-')) return 'zh_CN';
  if (tag === 'ja' || tag.startsWith('ja-')) return 'ja';
  return 'en';
}
function initialLocale() {
  try {
    const saved = localStorage.getItem('simtab-language');
    if (LANGUAGES.some(item => item.id === saved)) return saved;
    const language = JSON.parse(localStorage.getItem('appData') || 'null')?.settings?.language;
    if (LANGUAGES.some(item => item.id === language)) return language;
  } catch { /* Browser storage can be unavailable. */ }
  return typeof window === 'undefined' ? 'zh_CN' : resolveLocale(globalThis.navigator?.language || 'en');
}
let locale = initialLocale();
let messages = new Map();
export function getLocale() { return locale; }
export function setLocale(language) {
  locale = LANGUAGES.some(item => item.id === language) ? language : resolveLocale(language);
  if (typeof document !== 'undefined') document.documentElement.lang = locale.replace('_', '-');
  try { localStorage.setItem('simtab-language', locale); } catch { /* Optional startup cache. */ }
}
export async function loadLocale(language = locale) {
  const next = LANGUAGES.some(item => item.id === language) ? language : resolveLocale(language);
  const response = await fetch(new URL(`../_locales/${next}/messages.json`, import.meta.url));
  if (!response.ok) throw new Error(`Locale HTTP ${response.status}`);
  const catalog = await response.json();
  messages = new Map(Object.values(catalog).filter(item => item.description).map(item => [item.description, item.message]));
  setLocale(next);
}
function translateText(source) {
  // A markup fragment may contain only a subset of a template's parameters.
  const indexes = [];
  const key = source.trim().replace(/\{(\d+)\}/g, (_, index) => {
    let position = indexes.indexOf(index);
    if (position < 0) { position = indexes.length; indexes.push(index); }
    return `{${position}}`;
  });
  const translated = messages.get(key);
  if (!translated) return source;
  return source.slice(0, source.length - source.trimStart().length)
    + translated.replace(/\{(\d+)\}/g, (_, position) => `{${indexes[position] ?? position}}`)
    + source.slice(source.trimEnd().length);
}
function translateSource(source) {
  if (!/<[a-z][\s\S]*>/i.test(source)) return translateText(source);
  return source.replace(/(<[^>]+>)|([^<]+)/g, (part, tag, text) => tag
    ? tag.replace(/\b(title|aria-label|placeholder|alt)=(['"])(.*?)\2/g,
      (_, attr, quote, value) => `${attr}=${quote}${translateText(value)}${quote}`)
    : translateText(text));
}
export function t(source, ...values) {
  if (Array.isArray(source) && Object.hasOwn(source, 'raw')) {
    const pattern = source.reduce((result, part, index) => result + (index ? `{${index - 1}}` : '') + part, '');
    return translateSource(pattern).replace(/\{(\d+)\}/g, (_, index) => String(values[index] ?? ''));
  }
  return translateSource(String(source));
}
export function localizeDocument(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
}
