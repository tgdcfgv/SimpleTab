import { initDockDrop } from './dock.js';
import './organize.js';
import './extension.js';
import { initCapture } from './capture.js';
import { initAccount } from './account.js';
import { syncManager } from './storage.js';
import { applySettings, initSpaceShortcuts, render, renderSpaceDock } from './render.js';
import { initAllCustomSelects, openSiteModal } from './modals.js';
import { initExternalLinkDrop } from './drag.js';
import { initSiteIcons } from './site-icons.js';


export async function init() {
  await Promise.all([syncManager.loadData({ preferCache: true }), initSiteIcons()]);
  applySettings();
  render();
  initAllCustomSelects();
  initSpaceShortcuts();
  initDockDrop(renderSpaceDock);
  initExternalLinkDrop(({ url, title, groupId }) => {
    openSiteModal(null, groupId, { url, title });
  });
  initAccount();
  await initCapture();
}

init();


