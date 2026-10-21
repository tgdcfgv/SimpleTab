import { appData, SEARCH_ENGINES } from './storage.js';
import { getFaviconUrl } from './utils.js';
import { safeWebUrl } from './urls.js';
import { findLinks, nextSelection } from './search-model.js';

export const searchInput = document.getElementById('searchInput');
export const searchResults = document.getElementById('searchResults');
let results = [];
let selected = -1;
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
  searchResults.classList.add('hidden');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
}

function updateSelection() {
  searchResults.querySelectorAll('[role="option"]').forEach((item, index) => {
    item.classList.toggle('active', index === selected);
    item.setAttribute('aria-selected', String(index === selected));
    if (index === selected) item.scrollIntoView({ block: 'nearest' });
  });
  if (selected < 0) searchInput.removeAttribute('aria-activedescendant');
  else searchInput.setAttribute('aria-activedescendant', `search-result-${selected}`);
}

function showResults() {
  if (!appData) return;
  const query = searchInput.value.trim();
  selected = -1;
  results = findLinks(appData, query);
  searchResults.replaceChildren();
  if (!query) return hideResults();
  results.forEach((link, index) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.id = `search-result-${index}`;
    item.dataset.index = index;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');
    item.title = `${link.spaceName} / ${link.groupName} · ${link.url}`;
    const image = document.createElement('img');
    image.src = link.customIcon || getFaviconUrl(link.url);
    image.alt = '';
    const title = document.createElement('span');
    title.className = 'site-title';
    title.textContent = `${link.title} · ${link.spaceName} / ${link.groupName}`;
    item.append(image, title);
    searchResults.append(item);
  });
  const hint = document.createElement('div');
  hint.className = 'search-result-item search-result-hint';
  const engine = SEARCH_ENGINES.find(item => item.id === appData.settings.searchEngine) || SEARCH_ENGINES[0];
  hint.textContent = `按回车使用 ${engine.name} 搜索；↑↓ 选择已保存的网站`;
  searchResults.append(hint);
  searchResults.classList.remove('hidden');
  searchInput.setAttribute('aria-expanded', 'true');
}

searchInput.addEventListener('input', showResults);
searchInput.addEventListener('focus', showResults);
searchInput.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229 || !appData) return;
  if (e.key === 'Escape') { hideResults(); return; }
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
    openUrl(selected >= 0 && !searchResults.classList.contains('hidden')
      ? results[selected].url : engine.searchUrl + encodeURIComponent(query));
    hideResults();
  }
});

document.addEventListener('click', e => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) hideResults();
});
searchResults.addEventListener('click', e => {
  const item = e.target.closest('[data-index]');
  if (item) { openUrl(results[Number(item.dataset.index)].url); hideResults(); }
});
// Clear stale URLs when switching accounts, importing or removing saved content.
document.addEventListener('simtab-render', hideResults);
