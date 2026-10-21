import { appData, SEARCH_ENGINES } from './storage.js';
import { getFaviconUrl, escapeHTML } from './utils.js';


export const searchInput = document.getElementById('searchInput');
export const searchResults = document.getElementById('searchResults');

function openUrl(url) {
  if (appData.settings.openLinksInNewTab) {
    window.open(url, '_blank', 'noopener');
  } else {
    window.location.href = url;
  }
}

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    searchResults.classList.add('hidden');
    return;
  }

  const results = [];
  appData.groups.forEach(g => {
    g.links.forEach(l => {
      if (l.title.toLowerCase().includes(query) || l.url.toLowerCase().includes(query)) {
        results.push(l);
      }
    });
  });

  if (results.length > 0) {
    searchResults.innerHTML = results.slice(0, 8).map((l, index) => `
      <div class="search-result-item ${index === 0 ? 'active' : ''}" data-url="${escapeHTML(l.url)}" title="${escapeHTML(l.title)}">
        <img src="${escapeHTML(l.customIcon || getFaviconUrl(l.url))}" alt="">
        <span class="site-title">${escapeHTML(l.title)}</span>
      </div>
    `).join('');
    searchResults.classList.remove('hidden');
  } else {
    searchResults.innerHTML = `
      <div class="search-result-item" style="cursor:default;">
        <span class="site-title" style="color: var(--text-secondary)">
          按回车使用 ${escapeHTML(appData.settings.searchEngine)} 搜索 "${escapeHTML(query)}"
        </span>
      </div>`;
    searchResults.classList.remove('hidden');
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (!query) return;

    const firstResult = searchResults.querySelector('.search-result-item[data-url]');
    if (firstResult && !searchResults.classList.contains('hidden')) {
      openUrl(firstResult.dataset.url);
    } else {
      // Search Web
      const engine = SEARCH_ENGINES.find(item => item.id === appData.settings.searchEngine) || SEARCH_ENGINES[0];
      const url = engine.searchUrl + encodeURIComponent(query);
      openUrl(url);
    }
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    // Basic keyboard nav for search results (can be enhanced)
    e.preventDefault();
  }
});

document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.classList.add('hidden');
  }
});

searchResults.addEventListener('click', (e) => {
  const item = e.target.closest('.search-result-item[data-url]');
  if (item) {
    openUrl(item.dataset.url);
  }
});


