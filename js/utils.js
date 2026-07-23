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
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5YWEwYTYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiPjwvY2lyY2xlPjxsaW5lIHgxPSIxMiIgeTE9IjgiIHgyPSIxMiIgeTI9IjEyIj48L2xpbmU+PGxpbmUgeDE9IjEyIiB5MT0iMTYiIHgyPSIxMi4wMSIgeTI9IjE2Ij48L2xpbmU+PC9zdmc+';
  }
}

