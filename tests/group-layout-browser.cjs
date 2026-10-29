const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SIMTAB_TEST_URL || 'http://127.0.0.1:8091/newtab.html');
    await page.waitForFunction(async () => (await import('./js/storage.js')).syncManager.ready);
    await page.evaluate(async () => {
      const { appData } = await import('./js/storage.js');
      appData.groups.splice(0, appData.groups.length, ...Array.from({ length: 6 }, (_, index) => ({
        id: `layout-${index}`, name: index === 0 ? '工作' : '很长的分组名称用于检查窄列布局和标题显示效果',
        linksPerRow: 'auto', collapsed: false,
        links: Array.from({ length: 6 }, (_, link) => ({
          id: `link-${index}-${link}`, title: '网站名称很长 VeryLongUnbrokenWebsiteTitleForOverflow',
          url: `https://example.com/${index}/${link}`
        }))
      })));
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const compact of [false, true]) {
        for (const columns of ['auto', 2, 3, 4, 5, 6, 2]) {
          await page.evaluate(async ({ columns, compact }) => {
            const { appData } = await import('./js/storage.js');
            const { render, applySettings } = await import('./js/render.js');
            appData.settings.compactMode = compact;
            appData.settings.groupColumns = 3;
            appData.groups.forEach(group => { group.linksPerRow = columns; });
            applySettings();
            render();
          }, { columns, compact });
          const problems = await page.evaluate(() => {
            const problems = [];
            for (const grid of document.querySelectorAll('.sites-grid')) {
              if (grid.scrollWidth > grid.clientWidth + 1) problems.push('grid overflow');
              for (const button of grid.querySelectorAll('.site-btn')) {
                const bounds = button.getBoundingClientRect();
                const icon = button.querySelector('img').getBoundingClientRect();
                if (bounds.right > grid.getBoundingClientRect().right + 1) problems.push('cell overflow');
                if (icon.left < bounds.left || icon.right > bounds.right) problems.push('clipped icon');
                if (Math.abs(icon.width - parseFloat(getComputedStyle(button).getPropertyValue('--favicon-size'))) > 0.1) problems.push('shrunk icon');
                if (!button.title || !button.getAttribute('aria-label')) problems.push('missing full title');
              }
            }
            for (const header of document.querySelectorAll('.group-header')) {
              if (header.scrollWidth > header.clientWidth + 1) problems.push('header overflow');
              const title = header.querySelector('.group-title');
              if (getComputedStyle(title).maskImage !== 'none') problems.push('faded group title');
              if (title.textContent === '工作' && title.scrollWidth > title.clientWidth) problems.push('clipped short group title');
            }
            return problems;
          });
          assert.deepEqual(problems, [], `${width}px, compact=${compact}, columns=${columns}`);
          if (width === 1440 && !compact && columns === 4) {
            await page.screenshot({ path: '/tmp/simtab-group-layout.png', animations: 'disabled' });
          }
        }
      }
      // Collapsed previews and controls must fit even with long group names.
      await page.evaluate(async () => {
        const { appData } = await import('./js/storage.js');
        appData.groups.forEach(group => { group.collapsed = true; });
        (await import('./js/render.js')).render();
      });
      assert.equal(await page.locator('.group-header').evaluateAll(headers => headers.every(header => header.scrollWidth <= header.clientWidth + 1)), true);
      await page.evaluate(async () => {
        const { appData } = await import('./js/storage.js');
        appData.groups.forEach(group => { group.collapsed = false; });
      });
    }
    // Keep the existing pure-icon layout usable after the text layout changes.
    await page.evaluate(async () => {
      const { appData } = await import('./js/storage.js');
      appData.settings.cardDisplayMode = 'icon-only';
      const { applySettings, render } = await import('./js/render.js');
      applySettings(); render();
    });
    assert.equal(await page.locator('.site-title').first().isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS: column switching, long labels, full-size icons, collapsed headers, compact/mobile layouts and pure-icon mode.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
