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
    const reused = visibleImage();
    const reusePending = loadSiteIcon(reused, link);
    assert.equal(reused.src, link.customIcon, 'cached success is shown immediately');
    await reusePending;
    assert.equal(probes.length - before, 1);
    first.handlers.error();
    assert.equal(first.src, letterBadge(link.url, link.title));
  } finally { globalThis.Image = previousImage; }
});

test('failed icons retry on a later load after 24 hours, without polling', async () => {
  const previousImage = globalThis.Image;
  const previousNow = Date.now;
  let now = 1000;
  let attempts = 0;
  Date.now = () => now;
  globalThis.Image = class {
    naturalWidth = 32;
    set src(value) {
      attempts++;
      queueMicrotask(() => attempts === 1 ? this.onerror?.() : this.onload?.());
    }
    removeAttribute() {}
  };
  const image = {
    src: '', getAttribute(name) { return this[name]; }, addEventListener() {}
  };
  const link = { url: 'https://retry.test', customIcon: 'https://icons.test/retry' };
  try {
    await loadSiteIcon(image, link);
    now += 24 * 60 * 60 * 1000 - 1;
    await loadSiteIcon(image, link);
    assert.equal(attempts, 1);
    now++;
    assert.equal(attempts, 1, 'expiration alone does not start a request');
    await loadSiteIcon(image, link);
    assert.equal(attempts, 2);
    assert.equal(image.src, link.customIcon);
  } finally {
    globalThis.Image = previousImage;
    Date.now = previousNow;
  }
});

test('an older icon request cannot overwrite an edited link with the same title', async () => {
  const previousImage = globalThis.Image;
  const probes = [];
  globalThis.Image = class {
    naturalWidth = 32;
    constructor() { probes.push(this); }
    set src(value) { this.url = value; }
    removeAttribute() {}
  };
  const image = {
    src: '', handlers: {}, getAttribute(name) { return this[name]; },
    addEventListener(event, callback) { this.handlers[event] = callback; }
  };
  try {
    const link = { url: 'https://edited.test', title: 'Same title', customIcon: 'https://icons.test/old' };
    const oldPending = loadSiteIcon(image, link);
    const newPending = loadSiteIcon(image, { ...link, customIcon: 'https://icons.test/new' });
    probes[1].onload();
    await newPending;
    probes[0].onload();
    await oldPending;
    assert.equal(image.src, 'https://icons.test/new');
    const oldError = image.handlers.error;
    const latestPending = loadSiteIcon(image, { ...link, customIcon: 'https://icons.test/latest' });
    probes[2].onload();
    await latestPending;
    oldError();
    assert.equal(image.src, 'https://icons.test/latest');
  } finally { globalThis.Image = previousImage; }
});

test('native placeholder and transparent icons keep the badge while real 16px icons survive', async () => {
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  let fallbackProbes = 0;
  globalThis.Image = class {
    naturalWidth = 16;
    set src(value) {
      this.signature = value.includes('real-16') ? 'real-icon' : value.includes('transparent') ? '' : 'browser-default';
      if (value.includes('simtab-missing-favicon.invalid')) fallbackProbes++;
      queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  };
  globalThis.document = { createElement: () => {
    const context = {
      measureText: () => ({ actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 24, actualBoundingBoxDescent: 0 }),
      drawImage(image) { this.signature = image.signature; },
      getImageData() { return { data: new Uint8ClampedArray([0, 0, 0, this.signature ? 255 : 0]) }; }
    };
    return { getContext: () => context, toDataURL: () => context.signature };
  } };
  const image = () => ({ src: '', addEventListener() {} });
  try {
    for (const kind of ['missing', 'transparent', 'real-16']) {
      const link = { url: `https://${kind}.test`, title: 'Native icon',
        customIcon: `chrome-extension://native-test/_favicon/?pageUrl=https://${kind}.test&size=64` };
      const visible = image();
      await loadSiteIcon(visible, link);
      assert.equal(visible.src, kind === 'real-16' ? link.customIcon : letterBadge(link.url, link.title));
    }
    assert.equal(fallbackProbes, 1, 'one native placeholder reference is shared across sites');
  } finally {
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
  }
});

test('expired successful icons stay visible while a background refresh fails', async () => {
  const previousImage = globalThis.Image;
  const previousNow = Date.now;
  let now = 1000, attempts = 0;
  Date.now = () => now;
  globalThis.Image = class {
    naturalWidth = 32;
    set src(value) {
      attempts++;
      queueMicrotask(() => attempts === 1 ? this.onload?.() : this.onerror?.());
    }
    removeAttribute() {}
  };
  const image = () => ({ src: '', addEventListener() {} });
  const link = { url: 'https://stale-icon.test/', customIcon: 'https://icons.test/stale-good' };
  try {
    await loadSiteIcon(image(), link);
    now += 7 * 24 * 60 * 60 * 1000 + 1;
    const next = image();
    const pending = loadSiteIcon(next, link);
    assert.equal(next.src, link.customIcon, 'show the old successful image immediately');
    await pending;
    assert.equal(attempts, 2);
    assert.equal(next.src, link.customIcon, 'a refresh outage must not replace it with a badge');
  } finally { globalThis.Image = previousImage; Date.now = previousNow; }
});
