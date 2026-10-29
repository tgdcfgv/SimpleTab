import { LANGUAGES, getLocale, loadLocale, t } from './i18n.js';

/**
 * SimTab Info Pages Utilities (install.html & privacy.html)
 * Lightweight, CSP-compliant, zero external dependencies.
 */

(async () => {
  'use strict';

  // Capture only these static information pages, never user-authored app content.
  // Keep the original nodes so switching language preserves links, code and icons.
  const textNodes = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('script, style, select') && node.textContent.trim()) {
      textNodes.push([node, node.textContent]);
    }
  }
  const attributes = [];
  document.querySelectorAll('[title], [aria-label]').forEach(element => {
    for (const name of ['title', 'aria-label']) {
      if (element.hasAttribute(name)) attributes.push([element, name, element.getAttribute(name)]);
    }
  });
  const languageSelect = document.getElementById('infoLanguage');
  let catalogLoaded = false;
  function renderLanguage() {
    for (const [node, source] of textNodes) node.textContent = t(source);
    for (const [element, name, source] of attributes) element.setAttribute(name, t(source));
    document.querySelectorAll('[data-copy]').forEach(button => {
      button.textContent = t(button.classList.contains('copied') ? '已复制' : '复制');
    });
    if (languageSelect) languageSelect.value = catalogLoaded ? getLocale() : 'zh_CN';
    document.documentElement.lang = catalogLoaded ? getLocale().replace('_', '-') : 'zh-CN';
  }
  let language = getLocale();
  try {
    if (globalThis.chrome?.storage?.local) {
      const stored = await chrome.storage.local.get(['appData', 'simtab-language']);
      language = stored['simtab-language'] || localStorage.getItem('simtab-language') || stored.appData?.settings?.language || language;
    }
    await loadLocale(language);
    catalogLoaded = true;
  } catch (error) {
    console.error('Could not load information page language', error);
    // Static source remains usable if the catalog cannot be loaded.
    document.documentElement.lang = 'zh-CN';
  }
  renderLanguage();

  // --- Theme Management ---
  function getSavedThemePreference() {
    try {
      const explicit = localStorage.getItem('simtab-theme');
      if (explicit === 'dark' || explicit === 'light') return explicit;

      const appDataRaw = localStorage.getItem('appData');
      if (appDataRaw) {
        const appData = JSON.parse(appDataRaw);
        if (appData?.settings?.theme) {
          const t = appData.settings.theme;
          if (t === 'dark' || t === 'light') return t;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return 'system';
  }

  function resolveTheme(preference) {
    if (preference === 'dark' || preference === 'light') return preference;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.dataset.theme = resolved;
    updateThemeToggleUI(resolved);
  }

  function updateThemeToggleUI(activeTheme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    if (activeTheme === 'dark') {
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun" aria-hidden="true" style="--ui-icon-size: 18px"><circle cx="12" cy="12" r="4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="m17.66 17.66 1.41 1.41" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.34 17.66-1.41 1.41" /> <path d="m19.07 4.93-1.41 1.41" /></svg>`;
      btn.title = t('切换为浅色模式');
      btn.setAttribute('aria-label', t('切换为浅色模式'));
    } else {
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon" aria-hidden="true" style="--ui-icon-size: 18px"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></svg>`;
      btn.title = t('切换为深色模式');
      btn.setAttribute('aria-label', t('切换为深色模式'));
    }
  }

  let currentPreference = getSavedThemePreference();
  applyTheme(currentPreference);

  // Listen to system theme changes if no explicit theme is forced
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentPreference === 'system') {
      applyTheme('system');
    }
  });

  // --- Initialize interactive features on DOM ready ---
  function initialize() {
    languageSelect?.addEventListener('change', async () => {
      const next = languageSelect.value;
      if (!LANGUAGES.some(item => item.id === next)) return;
      languageSelect.disabled = true;
      try {
        await loadLocale(next);
        catalogLoaded = true;
        renderLanguage();
        applyTheme(currentPreference);
        if (globalThis.chrome?.storage?.local) {
          await chrome.storage.local.set({ 'simtab-language': next });
        }
      } catch (error) {
        languageSelect.value = getLocale();
        console.error('Could not change information page language', error);
      } finally {
        languageSelect.disabled = false;
      }
    });
    // 1. Theme toggle button click
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const active = document.documentElement.dataset.theme;
        const next = active === 'dark' ? 'light' : 'dark';
        currentPreference = next;
        try {
          localStorage.setItem('simtab-theme', next);
        } catch {}
        applyTheme(next);
      });
    }

    // 2. One-click code copy buttons
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const textToCopy = btn.getAttribute('data-copy');
        if (!textToCopy) return;

        try {
          await navigator.clipboard.writeText(textToCopy);
        } catch {
          const input = document.createElement('textarea');
          input.value = textToCopy;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          input.remove();
        }
        btn.classList.add('copied');
        btn.textContent = t('已复制');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = t('复制');
        }, 2000);
      });
    });

    // 3. Table of Contents Scrollspy (for privacy.html)
    const tocPills = document.querySelectorAll('.toc-link, .toc-pill');
    if (tocPills.length > 0) {
      const sections = Array.from(tocPills).map(pill => {
        const id = pill.getAttribute('href')?.replace('#', '');
        return id ? document.getElementById(id) : null;
      }).filter(Boolean);

      if ('IntersectionObserver' in window && sections.length > 0) {
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const activeId = entry.target.id;
              tocPills.forEach(pill => {
                if (pill.getAttribute('href') === `#${activeId}`) {
                  pill.classList.add('active');
                } else {
                  pill.classList.remove('active');
                }
              });
            }
          });
        }, {
          rootMargin: '-80px 0px -70% 0px',
          threshold: 0
        });

        sections.forEach(sec => observer.observe(sec));
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
