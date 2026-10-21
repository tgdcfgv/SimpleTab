import { safeWebUrl } from './urls.js';

export const CAPTURE_PREFIX = 'simtab.capture.';
export const CAPTURE_MAX_AGE = 30 * 60 * 1000;

export function captureDraft(tab, now = Date.now()) {
  const url = safeWebUrl(tab?.url);
  return { url, title: url ? String(tab.title || new URL(url).hostname).slice(0, 500) : '', createdAt: now };
}

export function validDraft(draft, now = Date.now()) {
  return draft && typeof draft.createdAt === 'number' && now >= draft.createdAt
    && now - draft.createdAt < CAPTURE_MAX_AGE;
}

export function addCapturedLink(data, { spaceId, groupId, title, url }, id) {
  const safeUrl = safeWebUrl(url);
  if (!safeUrl) throw new Error('请输入有效的 HTTP 或 HTTPS 网址。');
  const space = data.spaces.find(item => item.id === spaceId);
  const group = space?.groups.find(item => item.id === groupId);
  if (!group) throw new Error('目标空间或分组已变更，请重新选择。');
  const existing = group.links.find(link => safeWebUrl(link.url) === safeUrl);
  if (existing) return { added: false, link: existing, space, group };
  const link = { id, title: String(title || '').trim() || new URL(safeUrl).hostname, url: safeUrl };
  group.links.push(link);
  return { added: true, link, space, group };
}
