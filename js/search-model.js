import { safeWebUrl } from './urls.js';

export function findLinks(data, query, limit = 8) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  const matches = [];
  for (const space of data.spaces || []) {
    for (const group of space.groups || []) {
      for (const link of group.links || []) {
        if (safeWebUrl(link.url) && `${link.title}\n${link.url}`.toLocaleLowerCase().includes(term)) {
          matches.push({ ...link, spaceName: space.name, groupName: group.name });
          if (matches.length >= limit) return matches;
        }
      }
    }
  }
  return matches;
}

export function nextSelection(current, direction, count) {
  if (!count) return -1;
  return (current + direction + count + 2) % (count + 1) - 1;
}

export function parseSuggestions(data, limit = 6) {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  return data[1]
    .filter(item => typeof item === 'string' && item.trim())
    .slice(0, limit);
}

export function fetchJsonpSuggestions(query, limit = 6) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve([]);
    const cbName = `__simtab_cb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 1500);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch {}
      if (script.parentNode) script.remove();
    }

    window[cbName] = (data) => {
      cleanup();
      if (data && Array.isArray(data.s)) {
        resolve(data.s.filter(s => typeof s === 'string' && s.trim()).slice(0, limit));
      } else if (Array.isArray(data) && Array.isArray(data[1])) {
        resolve(parseSuggestions(data, limit));
      } else {
        resolve([]);
      }
    };

    script.src = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&cb=${cbName}&ie=utf-8`;
    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

export async function fetchBingSuggestions(query, signal, limit = 6, suggestUrl = 'https://www.bing.com/osjson.aspx?query=') {
  const term = typeof query === 'string' ? query.trim() : '';
  if (!term) return [];

  // 1. Extension environment: background service worker has full host permissions
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
    try {
      const res = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 2000);
        chrome.runtime.sendMessage({ action: 'bing-suggest', query: term }, (resp) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError || !resp?.ok) resolve(null);
          else resolve(resp.data);
        });
      });
      if (res) {
        const parsed = parseSuggestions(res, limit);
        if (parsed.length) return parsed;
      }
    } catch {
      // Fall through
    }
  }

  // 2. Web environment (Cloudflare Pages): same-origin edge function
  if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
        signal,
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parseSuggestions(data, limit);
        if (parsed.length) return parsed;
      }
    } catch {
      // Fall through
    }
  }

  // 3. Direct fetch to Bing
  try {
    const url = `${suggestUrl}${encodeURIComponent(term)}&cc=cn`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json, text/plain, */*' }
    });
    if (res.ok) {
      const json = await res.json();
      const parsed = parseSuggestions(json, limit);
      if (parsed.length) return parsed;
    }
  } catch {
    // Fall through
  }

  // 4. Fallback for static/file environments where CORS blocks HTTP fetch
  if (typeof document !== 'undefined' && (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.id)) {
    try {
      const jsonpResults = await fetchJsonpSuggestions(term, limit);
      if (jsonpResults.length) return jsonpResults;
    } catch {
      // Ignore
    }
  }

  return [];
}
