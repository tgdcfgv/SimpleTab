import './organize.js';
import './extension.js';
import { initCapture } from './capture.js';
import { initAccount } from './account.js';
import { syncManager } from './storage.js';
import { applySettings, initSpaceShortcuts, render } from './render.js';
import { initAllCustomSelects } from './modals.js';


export async function init() {
  await syncManager.loadData();
  applySettings();
  render();
  initAllCustomSelects();
  initSpaceShortcuts();
  initAccount();
  await initCapture();
}

init();


