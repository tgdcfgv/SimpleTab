import { syncManager } from './storage.js';
import { applySettings, initSpaceShortcuts, render } from './render.js';
import { initAllCustomSelects } from './modals.js';


export async function init() {
  await syncManager.loadData();
  applySettings();
  render();
  initAllCustomSelects();
  initSpaceShortcuts();
}

init();


