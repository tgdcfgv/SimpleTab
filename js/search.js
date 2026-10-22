import { appData, SEARCH_ENGINES } from './storage.js';
import { loadSiteIcon } from './site-icons.js';
import { safeWebUrl } from './urls.js';
import { icon } from './icons.js';
import { findLinks, nextSelection, fetchBingSuggestions } from './search-model.js';

export const searchInput = document.getElementById('searchInput');
export const searchResults = document.getElementById('searchResults');
let results = [];
let selected = -1;
let debounceTimer = null;
let currentController = null;
let activeQueryId = 0;

searchInput.setAttribute('role', 'combobox');
searchInput.setAttribute('aria-autocomplete', 'list');
searchInput.setAttribute('aria-controls', searchResults.id);
searchInput.setAttribute('aria-expanded', 'false');
searchResults.setAttribute('role', 'listbox');

function openUrl(value) {
  const url = safeWebUrl(value);
  if (!url) return;
  if (appData.settings.openLinksInNewTab) window.open(url, '_blank', 'noopener');
  else window.location.href = url;
}

function hideResults() {
  selected = -1;
  results = [];
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
  searchResults.classList.add('hidden');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
}

function updateSelection() {
  const options = searchResults.querySelectorAll('[role="option"]');
  options.forEach((item, index) => {
    const isActive = index === selected;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
    if (isActive) item.scrollIntoView({ block: 'nearest' });
  });
  if (selected < 0) searchInput.removeAttribute('aria-activedescendant');
  else searchInput.setAttribute('aria-activedescendant', `search-result-${selected}`);
}

function renderDropdown(links, suggestions, query) {
  if (!appData) return;
  const engine = SEARCH_ENGINES.find(item => item.id === appData.settings.searchEngine) || SEARCH_ENGINES[0];

  results = [
    ...links.map(link => ({ type: 'link', ...link })),
    ...suggestions.map(text => ({
      type: 'suggestion',
      text,
      url: engine.searchUrl + encodeURIComponent(text)
    }))
  ];

  searchResults.replaceChildren();
  if (!query) return hideResults();

  let index = 0;

  if (links.length > 0) {
    links.forEach(link => {
      const itemIndex = index++;
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.id = `search-result-${itemIndex}`;
      item.dataset.index = itemIndex;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.title = `${link.spaceName} / ${link.groupName} · ${link.url}`;

      const image = document.createElement('img');
      loadSiteIcon(image, link);
      image.alt = '';

      const title = document.createElement('span');
      title.className = 'site-title';
      title.textContent = `${link.title} · ${link.spaceName} / ${link.groupName}`;

      item.append(image, title);
      searchResults.append(item);
    });
  }

  if (suggestions.length > 0) {
    suggestions.forEach(text => {
      const itemIndex = index++;
      const item = document.createElement('div');
      item.className = 'search-result-item search-suggestion-item';
      item.id = `search-result-${itemIndex}`;
      item.dataset.index = itemIndex;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');

      const iconWrap = document.createElement('span');
      iconWrap.className = 'search-suggest-icon-wrap';
      iconWrap.innerHTML = icon('arrow-up-right', 16);

      const title = document.createElement('span');
      title.className = 'site-title search-suggest-title';
      title.textContent = text;

      item.append(iconWrap, title);
      searchResults.append(item);
    });
  }

  if (results.length === 0) {
    searchResults.classList.add('hidden');
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    return;
  }

  searchResults.classList.remove('hidden');
  searchInput.setAttribute('aria-expanded', 'true');
  updateSelection();
}

function showResults() {
  if (!appData) return;
  const query = searchInput.value.trim();
  if (!query) {
    hideResults();
    return;
  }

  selected = -1;
  const links = findLinks(appData, query, 5);
  renderDropdown(links, [], query);

  if (debounceTimer) clearTimeout(debounceTimer);
  if (currentController) currentController.abort();

  const queryId = ++activeQueryId;
  debounceTimer = setTimeout(async () => {
    currentController = new AbortController();
    const suggestions = await fetchBingSuggestions(query, currentController.signal, 6);
    if (queryId === activeQueryId && searchInput.value.trim() === query) {
      const filtered = suggestions.filter(s => s.trim().toLowerCase() !== query.toLowerCase());
      renderDropdown(links, filtered.length ? filtered : suggestions, query);
    }
  }, 160);
}

searchInput.addEventListener('input', showResults);
searchInput.addEventListener('focus', showResults);
searchInput.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229 || !appData) return;
  if (e.key === 'Escape') { hideResults(); return; }

  if (e.key === 'Tab') {
    if (selected >= 0 && results[selected]?.type === 'suggestion') {
      e.preventDefault();
      searchInput.value = results[selected].text;
      showResults();
      return;
    }
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (searchResults.classList.contains('hidden')) showResults();
    selected = nextSelection(selected, e.key === 'ArrowDown' ? 1 : -1, results.length);
    updateSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    const engine = SEARCH_ENGINES.find(item => item.id === appData.settings.searchEngine) || SEARCH_ENGINES[0];
    openUrl(selected >= 0 && !searchResults.classList.contains('hidden') && results[selected]
      ? results[selected].url : engine.searchUrl + encodeURIComponent(query));
    hideResults();
  }
});

document.addEventListener('click', e => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) hideResults();
});

searchResults.addEventListener('click', e => {
  const item = e.target.closest('[data-index]');
  if (item && results[Number(item.dataset.index)]) {
    openUrl(results[Number(item.dataset.index)].url);
    hideResults();
    return;
  }

});

// Clear stale URLs when switching accounts, importing or removing saved content.
document.addEventListener('simtab-render', hideResults);

