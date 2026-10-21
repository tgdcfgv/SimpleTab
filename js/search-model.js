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
