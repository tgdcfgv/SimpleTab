const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'simtab-icons-'));
  const extensionPath = path.resolve(__dirname, '..');
  let executablePath = process.env.SIMTAB_CHROMIUM_PATH || chromium.executablePath();
  if (!fs.existsSync(executablePath)) {
    const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
    const revision = fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().at(-1);
    executablePath = path.join(cache, revision, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  }
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    const realIcon = fs.readFileSync(path.join(extensionPath, 'icons/icon-16.png'));
    await context.route('https://**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'favicon-fixture.test') return route.abort();
      return url.pathname === '/favicon.png'
        ? route.fulfill({ contentType: 'image/png', body: realIcon })
        : route.fulfill({ contentType: 'text/html', body: '<html><head><link rel="icon" href="/favicon.png"></head><body>Icon fixture</body></html>' });
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await context.addInitScript(() => {
      const NativeImage = window.Image;
      window.iconProbes = [];
      window.Image = function (...args) {
        const image = new NativeImage(...args);
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        Object.defineProperty(image, 'src', {
          get() { return descriptor.get.call(image); },
          set(value) { window.iconProbes.push(value); descriptor.set.call(image, value); }
        });
        return image;
      };
      window.Image.prototype = NativeImage.prototype;
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/newtab.html`);
    await page.waitForFunction(() => !document.querySelector('.app-container').inert);
    const result = await page.evaluate(async () => {
      const { loadSiteIcon, letterBadge } = await import('./js/site-icons.js');
      const link = { url: 'https://never-visited.simtab-test.invalid/', title: '内部文档' };
      const image = document.createElement('img');
      document.body.append(image);
      await loadSiteIcon(image, link);
      await image.decode();
      return { src: image.src, expected: letterBadge(link.url, link.title), width: image.naturalWidth };
    });
    assert.equal(result.src, result.expected, 'a missing native favicon must retain the letter badge');
    assert.equal(result.width, 64);

    const fixture = await context.newPage();
    const faviconLoaded = fixture.waitForResponse('https://favicon-fixture.test/favicon.png');
    await fixture.goto('https://favicon-fixture.test/');
    await faviconLoaded;
    // Wait until Chromium has committed the visited site's favicon to its cache.
    await page.waitForFunction(async () => {
      const { getFaviconUrl } = await import('./js/utils.js');
      const native = new Image(), expected = new Image();
      native.src = getFaviconUrl('https://favicon-fixture.test/');
      expected.src = chrome.runtime.getURL('icons/icon-16.png');
      await Promise.all([native.decode(), expected.decode()]);
      const signature = image => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        canvas.getContext('2d').drawImage(image, 0, 0, 32, 32);
        return canvas.toDataURL();
      };
      return signature(native) === signature(expected);
    });
    assert.equal(await page.evaluate(async () => {
      const { loadSiteIcon } = await import('./js/site-icons.js');
      const link = { url: 'https://favicon-fixture.test/', title: 'Real 16px icon' };
      const image = document.createElement('img');
      await loadSiteIcon(image, link);
      await image.decode();
      return image.src.startsWith('data:image/png;base64,');
    }), true, 'real cached 16px icons must still replace the badge');
    const nextPage = await context.newPage();
    await nextPage.goto(page.url());
    await nextPage.waitForFunction(() => !document.querySelector('.app-container').inert);
    const cached = await nextPage.evaluate(async () => {
      const { loadSiteIcon, letterBadge, invalidateSiteIcon } = await import('./js/site-icons.js');
      const { getFaviconUrl } = await import('./js/utils.js');
      const real = { url: 'https://favicon-fixture.test/', title: 'Real 16px icon' };
      const missing = { url: 'https://never-visited.simtab-test.invalid/', title: '内部文档' };
      const before = window.iconProbes.length;
      const goodImage = document.createElement('img'), badImage = document.createElement('img');
      const goodPending = loadSiteIcon(goodImage, real);
      const firstSource = goodImage.src;
      await Promise.all([goodPending, loadSiteIcon(badImage, missing)]);
      const noProbes = window.iconProbes.length === before;
      const noSwitch = firstSource === goodImage.src;
      const goodSource = goodImage.src;
      const badgeRetained = badImage.src === letterBadge(missing.url, missing.title);
      const stored = (await chrome.storage.local.get('simtab.site-icons.v1'))['simtab.site-icons.v1'];
      const failedLifetime = stored[getFaviconUrl(missing.url)].expiresAt - Date.now();
      await invalidateSiteIcon(missing.url);
      const beforeRetry = window.iconProbes.length;
      await loadSiteIcon(document.createElement('img'), missing);
      return { noProbes, noSwitch, goodSource, badgeRetained, failedLifetime,
        retried: window.iconProbes.slice(beforeRetry).includes(getFaviconUrl(missing.url)) };
    });
    assert.equal(cached.noProbes, true, 'a new tab reuses positive and negative disk entries without new probes');
    assert.equal(cached.noSwitch, true, 'a cached image is displayed synchronously without switching sources');
    assert.match(cached.goodSource, /^data:image\/png;base64,/);
    assert.equal(cached.badgeRetained, true);
    assert(cached.failedLifetime > 23 * 60 * 60 * 1000);
    assert.equal(cached.retried, true, 'explicit refetch bypasses the failure cache');
    assert.deepEqual(errors, []);
    console.log('PASS: actual extension handles missing/real 16px icons, reuses success and failure caches across tabs without probes or source flicker, and supports explicit refetch.');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exit(1); });
