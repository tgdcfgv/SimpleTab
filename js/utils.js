import { siteIconFallback } from './icons.js';
export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      const u = new URL(chrome.runtime.getURL("/_favicon/"));
      u.searchParams.set("pageUrl", url);
      u.searchParams.set("size", "64");
      return u.toString();
    }
    return `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
  } catch (e) {
    return siteIconFallback;
  }
}


export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
