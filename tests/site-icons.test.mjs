import test from 'node:test';
import assert from 'node:assert/strict';
import { letterBadge, loadSiteIcon } from '../js/site-icons.js';

test('badges use a readable initial and a stable color without remote resources', () => {
  const decode = value => decodeURIComponent(value.split(',')[1]);
  const latin = decode(letterBadge('http://intranet.local', 'Intranet'));
  const chinese = decode(letterBadge('http://intranet.local', '内部文档'));
  assert.match(latin, />I<\/text>/);
  assert.match(chinese, />内<\/text>/);
  assert.equal(latin.match(/fill="(#[A-F0-9]+)"/)[1], chinese.match(/fill="(#[A-F0-9]+)"/)[1]);
  assert.match(decode(letterBadge('https://www.example.com')), />E<\/text>/);
  assert.match(decode(letterBadge('', '💡资料')), />资<\/text>/);
  assert.equal(letterBadge('', ''), letterBadge('', ''));
  assert.doesNotMatch(latin, /<image|<script|href=/);
});

test('icons stay as badges on error or timeout, upgrade on success and share requests', async () => {
  const previousImage = globalThis.Image;
  const probes = [];
  globalThis.Image = class {
    constructor() { probes.push(this); this.naturalWidth = 32; }
    set src(value) {
      this.url = value;
      if (value.includes('/success')) queueMicrotask(() => this.onload?.());
      if (value.includes('/failure')) queueMicrotask(() => this.onerror?.());
    }
    removeAttribute() { this.cancelled = true; }
  };
  const visibleImage = () => ({
    src: '', handlers: {},
    getAttribute(name) { return this[name]; },
    addEventListener(event, callback) { this.handlers[event] = callback; }
  });
  try {
    const failed = visibleImage();
    await loadSiteIcon(failed, { url: 'http://local/', title: '内网', customIcon: 'https://icons.test/failure' });
    assert.equal(failed.src, letterBadge('http://local/', '内网'));
    const stalled = visibleImage();
    await loadSiteIcon(stalled, { url: 'https://slow.test', title: 'Slow', customIcon: 'https://icons.test/stalled' }, { timeoutMs: 5 });
    assert.equal(stalled.src, letterBadge('https://slow.test', 'Slow'));
    assert.equal(probes.at(-1).cancelled, true);
    assert.equal(probes.at(-1).onload, null);
    const first = visibleImage(), second = visibleImage();
    const link = { url: 'https://working.test', title: 'Working', customIcon: 'https://icons.test/success' };
    const before = probes.length;
    const pending = loadSiteIcon(first, link);
    assert.equal(first.src, letterBadge(link.url, link.title));
    await Promise.all([pending, loadSiteIcon(second, link)]);
    assert.equal(first.src, link.customIcon);
    assert.equal(second.src, link.customIcon);
    assert.equal(probes.length - before, 1);
    first.handlers.error();
    assert.equal(first.src, letterBadge(link.url, link.title));
  } finally { globalThis.Image = previousImage; }
});
