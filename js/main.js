import './organize.js';
import './extension.js';
import { initCapture } from './capture.js';
import { initAccount } from './account.js';
import { syncManager } from './storage.js';
import { applySettings, initSpaceShortcuts, render } from './render.js';
import { initAllCustomSelects, openSiteModal } from './modals.js';
import { initExternalLinkDrop } from './drag.js';


export async function init() {
  await syncManager.loadData();
  applySettings();
  render();
  initAllCustomSelects();
  initSpaceShortcuts();
  initExternalLinkDrop(({ url, title, groupId }) => {
    openSiteModal(null, groupId, { url, title });
  });
  initAccount();
  await initCapture();
}

init();


