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

export async function fetchBingSuggestions(query, signal, limit = 6, suggestUrl = 'https://api.bing.com/osjson.aspx?query=') {
  const term = typeof query === 'string' ? query.trim() : '';
  if (!term) return [];
  try {
    const url = `${suggestUrl}${encodeURIComponent(term)}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json, text/plain, */*' }
    });
    if (!res.ok) return [];
    const json = await res.json();
    return parseSuggestions(json, limit);
  } catch {
    return [];
  }
}
