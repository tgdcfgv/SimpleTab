import { resolveLocale, LANGUAGES } from './i18n.js';
import { searchRegion } from './search-locale.js';
import { CAPTURE_PREFIX, captureDraft, validDraft } from './capture-model.js';

export const CAPTURE_MENU_ID = 'simtab-save-page';
let captureTitle = chrome.i18n?.getMessage('savePage') || '保存当前页面到 SimTab';
let captureFailure = chrome.i18n?.getMessage('captureFailed') || '收藏窗口未能打开，请重试';
async function refreshCaptureLanguage() {
  if (!chrome.storage?.local?.get) return;
  try {
    const stored = await chrome.storage.local.get(['appData', 'simtab-language']);
    const preferred = stored['simtab-language'] || stored.appData?.settings?.language;
    const language = LANGUAGES.some(item => item.id === preferred)
      ? preferred : resolveLocale(chrome.i18n?.getUILanguage() || 'en');
    const response = await fetch(new URL(`../_locales/${language}/messages.json`, import.meta.url));
    if (!response.ok) return;
    const catalog = await response.json();
    captureTitle = catalog.savePage.message;
    captureFailure = catalog.captureFailed.message;
    await chrome.action.setTitle({ title: captureTitle });
    // The menu may not exist until onInstalled creates it.
    try { await chrome.contextMenus.update(CAPTURE_MENU_ID, { title: captureTitle }); } catch {}
  } catch { /* Keep the browser-language labels when local storage is unavailable. */ }
}
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area === 'local' && (changes['simtab-language'] || changes.appData?.newValue?.settings?.language !== changes.appData?.oldValue?.settings?.language)) refreshCaptureLanguage();
});
void refreshCaptureLanguage();

export async function openCapture(tab, api = chrome) {
  const drafts = await api.storage.session.get(null);
  const expired = Object.entries(drafts)
    .filter(([key, value]) => key.startsWith(CAPTURE_PREFIX) && !validDraft(value))
    .map(([key]) => key);
  if (expired.length) await api.storage.session.remove(expired);
  const token = crypto.randomUUID();
  const key = CAPTURE_PREFIX + token;
  await api.storage.session.set({ [key]: captureDraft(tab) });
  try {
    await api.tabs.create({ url: api.runtime.getURL(`newtab.html#capture=${token}`) });
  } catch (error) {
    await api.storage.session.remove(key);
    throw error;
  }
}

function launch(tab) {
  chrome.action.setTitle({ title: captureTitle, ...(tab?.id ? { tabId: tab.id } : {}) });
  chrome.action.setBadgeText({ text: '', ...(tab?.id ? { tabId: tab.id } : {}) });
  openCapture(tab).catch(error => {
    console.error('无法打开 SimTab 收藏窗口', error);
    chrome.action.setBadgeText({ text: '!', ...(tab?.id ? { tabId: tab.id } : {}) });
    chrome.action.setTitle({ title: captureFailure, ...(tab?.id ? { tabId: tab.id } : {}) });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll().then(async () => {
    await refreshCaptureLanguage();
    chrome.contextMenus.create({ id: CAPTURE_MENU_ID, title: captureTitle,
      contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  }).catch(error => console.error('无法创建收藏菜单', error));
});
chrome.action.onClicked.addListener(launch);
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CAPTURE_MENU_ID) launch({ ...tab, url: info.pageUrl || tab?.url });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'bing-suggest') {
    const q = message.query?.trim() || '';
    if (!q) {
      sendResponse({ ok: true, data: [q, []] });
      return false;
    }
    const url = `https://www.bing.com/osjson.aspx?query=${encodeURIComponent(q)}&cc=${searchRegion(message.language)}`;
    fetch(url, { headers: { Accept: 'application/json, text/plain, */*' } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
