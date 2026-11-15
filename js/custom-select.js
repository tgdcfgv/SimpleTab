import { getLocale, t } from './i18n.js';
import { icon } from './icons.js';
import { getFaviconUrl } from './utils.js';

function getCustomSelectIconMarkup(option, size = 16) {
  const icons = {
    "current-tab": "app-window",
    "new-tab": "external-link",
    "icon-text": "panel-top",
    "icon-only": "grid-2x2",
    "light": "sun",
    "dark": "moon",
    "system": "monitor",
    "dock-left": "panel-left",
    "dock-right": "panel-right",
    "dock-bottom": "panel-bottom",
    "dock-hidden": "eye-off"
  };

  const iconName = icons[option.dataset.iconName];
  if (iconName) return icon(iconName, size, 'select-option-icon');

  const iconSrc = option.dataset.url ? getFaviconUrl(option.dataset.url) : option.dataset.icon;
  return iconSrc ? `<img src="${iconSrc}" width="${size}" height="${size}" style="border-radius:4px" alt="">` : '';
}

function sizeSettingSelectFromOptions(select, container) {
  if (!select.classList.contains('setting-select') && !select.classList.contains('info-language')) return;
  const trigger = container.querySelector('.custom-select-trigger-global');
  const computed = getComputedStyle(trigger);
  const canvas = sizeSettingSelectFromOptions.canvas ||
    (sizeSettingSelectFromOptions.canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  context.font = computed.font || `${computed.fontSize} ${computed.fontFamily}`;

  const widestText = Array.from(select.options).reduce(
    (width, option) => Math.max(width, context.measureText(option.text).width),
    0
  );
  const hasIcons = Array.from(select.options).some(option =>
    option.dataset.iconName || option.dataset.icon || option.dataset.url
  );
  const iconWidth = hasIcons ? 24 : 0;
  const arrowAndSpacingWidth = 34;
  const horizontalPadding =
    (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
  const preferredWidth = Math.ceil(widestText + iconWidth + arrowAndSpacingWidth + horizontalPadding);

  container.style.width = `${Math.max(112, preferredWidth)}px`;
}

function ensureOutsideClickListener() {
  if (typeof window === 'undefined' || window.customSelectListenerAdded) return;
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-container.open').forEach(container => setSelectOpen(container, false));
  });
  window.customSelectListenerAdded = true;
}

export function setSelectOpen(container, open) {
  const options = container.querySelector('.custom-select-options-global');
  container.classList.toggle('open', open);
  options.classList.toggle('hidden', !open);
  options.inert = !open;
  container.querySelector('.custom-select-trigger-global').setAttribute('aria-expanded', String(open));
  if (container.previousElementSibling?.id === 'searchEngineSelect') {
    document.querySelector('.search-container')?.classList.toggle('engine-select-open', open);
  }
}

export function updateCustomSelectOptions(select) {
  if (select.dataset.native === 'true') return;
  ensureOutsideClickListener();
  let container = select.nextElementSibling;
  if (!container || !container.classList.contains('custom-select-container')) {
    container = document.createElement('div');
    container.className = 'custom-select-container';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.disabled = select.disabled;
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || document.querySelector(`label[for="${select.id}"]`)?.textContent || t('选择搜索引擎'));
    trigger.className = 'custom-select-trigger-global';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<div class="selected-content"></div>${icon('chevron-down', 14)}`;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options-global hidden';
    optionsContainer.inert = true;
    const optionsContent = document.createElement('div');
    optionsContent.className = 'custom-select-options-content';
    optionsContainer.appendChild(optionsContent);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (select.disabled) return;
      const open = !container.classList.contains('open');
      document.querySelectorAll('.custom-select-container.open').forEach(other => {
        if (other !== container) setSelectOpen(other, false);
      });
      setSelectOpen(container, open);
    });

    // Engine switching is part of typing. Keep the caret and virtual keyboard
    // in place instead of blurring the input on pointer-down.
    container.addEventListener('pointerdown', event => {
      const searchInput = document.getElementById('searchInput');
      if (select.id === 'searchEngineSelect' && !select.disabled && event.button === 0 &&
          document.activeElement === searchInput && event.target.closest('button')) event.preventDefault();
    });

    const keyboardScope = select.id === 'searchEngineSelect' ? select.closest('.search-container') : container;
    keyboardScope.addEventListener('keydown', event => {
      if (event.key === 'Escape' && container.classList.contains('open')) {
        event.preventDefault();
        event.stopPropagation();
        const searchInput = document.getElementById('searchInput');
        if (document.activeElement !== searchInput) trigger.focus({ preventScroll: true });
        setSelectOpen(container, false);
      }
    });
    container.appendChild(trigger);
    container.appendChild(optionsContainer);
    select.style.display = 'none';
    select.parentNode.insertBefore(container, select.nextSibling);

    select.addEventListener('change', () => updateCustomSelectTrigger(select));
  }

  const optionsContainer = container.querySelector('.custom-select-options-global');
  const optionsContent = optionsContainer.querySelector('.custom-select-options-content');
  optionsContent.replaceChildren();

  Array.from(select.options).forEach((option, index) => {
    const optDiv = document.createElement('button');
    optDiv.type = 'button';
    optDiv.className = `custom-option-global ${index === select.selectedIndex ? 'active' : ''}`;

    const iconMarkup = getCustomSelectIconMarkup(option);
    if (iconMarkup) {
      optDiv.innerHTML = `${iconMarkup}<span>${option.text}</span>`;
    } else {
      optDiv.textContent = option.text;
    }

    optDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      select.selectedIndex = index;
      // Restore focus before hiding/inerting a focused option. Doing this in
      // reverse briefly drops :focus-within and restarts the header transition.
      const nextFocus = select.id === 'searchEngineSelect'
        ? (document.getElementById('searchInput') || container.querySelector('.custom-select-trigger-global'))
        : container.querySelector('.custom-select-trigger-global');
      nextFocus.focus({ preventScroll: true });
      setSelectOpen(container, false);
      select.dispatchEvent(new Event('change'));
    });
    optionsContent.appendChild(optDiv);
  });

  updateCustomSelectTrigger(select);
  sizeSettingSelectFromOptions(select, container);
}

export function updateCustomSelectTrigger(select) {
  const container = select.nextElementSibling;
  if (!container || !container.classList.contains('custom-select-container')) return;

  const trigger = container.querySelector('.custom-select-trigger-global');
  const ariaLabel = select.getAttribute('aria-label');
  if (trigger && ariaLabel) trigger.setAttribute('aria-label', ariaLabel);
  if (trigger) trigger.disabled = select.disabled;

  const content = container.querySelector('.selected-content');
  const option = select.options[select.selectedIndex];
  if (!option) return;

  const isIconOnly = select.dataset.iconOnly === 'true';

  const iconMarkup = getCustomSelectIconMarkup(option, isIconOnly ? 18 : 16);
  if (iconMarkup) {
    if (isIconOnly) {
      content.innerHTML = iconMarkup;
    } else {
      content.innerHTML = `${iconMarkup}<span>${option.text}</span>`;
    }
  } else {
    content.textContent = option.text;
  }

  const optionsContainer = container.querySelector('.custom-select-options-global');
  optionsContainer.querySelectorAll('.custom-option-global').forEach((el, i) => {
    el.classList.toggle('active', i === select.selectedIndex);
  });
}

export function initAllCustomSelects() {
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) languageSelect.value = getLocale();
  document.querySelectorAll('select').forEach(updateCustomSelectOptions);
  ensureOutsideClickListener();
}
