import { getLocale, loadLocale, localizeDocument } from './i18n.js';
let language = getLocale();
try {
  if (globalThis.chrome?.storage?.local) {
    const stored = await chrome.storage.local.get(['appData', 'simtab-language']);
    language = stored['simtab-language'] || localStorage.getItem('simtab-language') || stored.appData?.settings?.language || language;
  }
  await loadLocale(language);
} catch (error) {
  console.error('Could not load language catalog', error);
}
localizeDocument();
await import('./main.js');
