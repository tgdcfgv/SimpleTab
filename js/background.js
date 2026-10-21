import { CAPTURE_PREFIX, captureDraft, validDraft } from './capture-model.js';

export const CAPTURE_MENU_ID = 'simtab-save-page';

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
  chrome.action.setTitle({ title: '保存当前页面到 SimTab', ...(tab?.id ? { tabId: tab.id } : {}) });
  chrome.action.setBadgeText({ text: '', ...(tab?.id ? { tabId: tab.id } : {}) });
  openCapture(tab).catch(error => {
    console.error('无法打开 SimTab 收藏窗口', error);
    chrome.action.setBadgeText({ text: '!', ...(tab?.id ? { tabId: tab.id } : {}) });
    chrome.action.setTitle({ title: '收藏窗口未能打开，请重试', ...(tab?.id ? { tabId: tab.id } : {}) });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({ id: CAPTURE_MENU_ID, title: '保存当前页面到 SimTab',
      contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  }).catch(error => console.error('无法创建收藏菜单', error));
});
chrome.action.onClicked.addListener(launch);
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CAPTURE_MENU_ID) launch({ ...tab, url: info.pageUrl || tab?.url });
});
