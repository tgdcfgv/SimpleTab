import { t } from './i18n.js';
import { render, applySettings } from './render.js';
import { cloud } from './cloud.js';

import { DEFAULT_DATA, normalizeAppData } from './data.js';
import { migrateWallpaper, portableSnapshot, exportWallpaper } from './wallpaper.js';
import { fingerprint, writeLocalSnapshot } from './local-store.js';
import { readCloudCache, writeCloudCache } from './cloud-cache.js';
export { SEARCH_ENGINES, DEFAULT_DATA, TEMPORARY_GROUP_NAME, createTemporaryGroup, ensureTemporaryGroup, createDefaultSpaces, normalizeAppData } from './data.js';

export let appData = null;
export function setAppData(data) { appData = data; }

export function getActiveSpace() {
  if (!appData) return null;
  return appData.spaces.find(space => space.id === appData.activeSpaceId) || appData.spaces[0] || null;
}

export function setActiveSpace(spaceId) {
  const space = appData.spaces.find(item => item.id === spaceId);
  if (!space) return false;
  appData.activeSpaceId = space.id;
  appData.groups = space.groups;
  return true;
}

export function syncActiveGroupsToSpace(data = appData) {
  if (!data || !Array.isArray(data.spaces) || data.spaces.length === 0) return;

  const activeSpace = data.spaces.find(space => space.id === data.activeSpaceId) || data.spaces[0];
  if (!activeSpace) return;

  if (Array.isArray(data.groups)) {
    activeSpace.groups = data.groups;
  } else {
    data.groups = activeSpace.groups;
  }

  data.activeSpaceId = activeSpace.id;
  data.groups = activeSpace.groups;
}

// ==========================================
// Sync Manager Module

export const syncManager = {
  status: 'local',
  mode: 'local',
  generation: 0,
  revision: null,
  ready: false,
  pending: null,
  saving: null,
  conflict: false,
  error: '',
  cloudUnavailable: false,
  localVersion: 'null',
  refreshing: null,

  updateStatusUI() {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const labels = { local: this.cloudUnavailable ? t('云端不可用 · 本地已保存') : t('本地已保存'), saved: t('云端已保存'), unsynced: t('有未保存更改'), syncing: t('云端同步中…'),
      signedout: t('请登录以使用云端数据'), error: this.conflict ? t('存在同步冲突 · 点击处理') : (this.mode === 'local' ? t('本地保存失败 · 点击重试') : t('同步失败 · 点击重试')) };
    let dotClass = 'status-dot';
    if (this.status === 'syncing') dotClass = 'status-dot syncing';
    else if (this.status === 'error') dotClass = 'status-dot error';
    else if (this.conflict) dotClass = 'status-dot conflict';
    else if (this.status === 'unsynced') dotClass = 'status-dot unsynced';
    el.querySelector('.status-dot').className = dotClass;
    el.querySelector('.status-text').textContent = labels[this.status];
    el.title = this.error || (this.cloudUnavailable ? t('当前使用本地内容，点击重试读取云端内容') : this.mode === 'local' ? t('数据保存在此浏览器，登录后切换到云端内容') : t('点击同步云端数据'));
    document.dispatchEvent(new Event('simtab-sync'));
  },

  async readLocal() {
    return globalThis.chrome?.storage?.local
      ? (await chrome.storage.local.get('appData')).appData
      : JSON.parse(localStorage.getItem('appData') || 'null');
  },

  async writeLocal(snapshot) {
    return writeLocalSnapshot({
      read: () => this.readLocal(), expected: this.localVersion, snapshot,
      write: value => globalThis.chrome?.storage?.local
        ? chrome.storage.local.set({ appData: value })
        : Promise.resolve().then(() => localStorage.setItem('appData', JSON.stringify(value)))
    });
  },

  async loadLocal() {
    this.generation++;
    this.ready = false;
    this.mode = 'local';
    this.pending = null;
    this.revision = null;
    this.conflict = false;
    this.error = '';
    this.cloudUnavailable = false;
    try {
      const stored = await this.readLocal();
      this.localVersion = fingerprint(stored);
      appData = normalizeAppData(stored);
      if (await migrateWallpaper(appData)) {
        const snapshot = portableSnapshot(appData);
        this.localVersion = await this.writeLocal(snapshot);
      }
      this.status = 'local';
    } catch (error) {
      appData ??= normalizeAppData(null);
      this.error = t`读取本地数据或迁移壁纸失败：${error.message}。原数据未被清理，请检查浏览器存储后刷新。`;
      this.status = 'error';
    }
    this.ready = this.status !== 'error';
    this.updateStatusUI();
  },

  async loadData({ preferCache = false } = {}) {
    this.ready = false;
    appData = normalizeAppData(null);
    // Only startup uses SWR. Explicit account/recovery actions await their result.
    let session;
    try { session = JSON.parse(localStorage.getItem('simtab.auth') || 'null'); } catch {}
    const callback = /(?:[?#&])(?:access_token|token_hash|token|error|error_description)=/.test(location.href);
    if (preferCache && session?.user?.id && session.access_token && session.refresh_token && !session.needs_choice && !callback) {
      const cached = await readCloudCache(session.user.id);
      let currentSession;
      try { currentSession = JSON.parse(localStorage.getItem('simtab.auth') || 'null'); } catch {}
      if (cached && currentSession?.user?.id === session.user.id && !currentSession.needs_choice) {
        session = currentSession;
        cloud.session = session;
        const generation = ++this.generation;
        appData = normalizeAppData(cached.data);
        this.mode = 'cloud';
        this.revision = cached.revision;
        this.pending = null;
        this.conflict = false;
        this.error = '';
        this.cloudUnavailable = false;
        this.ready = true;
        this.status = 'syncing';
        this.updateStatusUI();
        // Defer networking until the caller can render and attach UI listeners.
        this.refreshing = new Promise(resolve => setTimeout(resolve, 0)).then(async () => {
          try {
            await cloud.restore();
            if (generation !== this.generation) return;
            if (!cloud.session || cloud.session.user?.id !== session.user.id) {
              await this.handleSessionLoss();
              return;
            }
            await this.syncNow();
          } catch (error) {
            if (generation !== this.generation) return;
            if (!cloud.session) {
              await this.handleSessionLoss();
            } else {
              this.status = 'error';
              this.error = t`暂时无法同步，当前显示上次同步的账户缓存。${error.message}`;
              this.updateStatusUI();
            }
          }
        }).finally(() => { this.refreshing = null; });
        return;
      }
    }
    try {
      if (!await cloud.restore()) return await this.loadLocal();
      if (cloud.session.needs_choice) return await this.loadLocal();
      await this.loadCloud();
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) cloud.storeSession(null);
      if (!cloud.session || cloud.session.needs_choice) return await this.loadLocal();
      await this.useLocalAfterCloudFailure(error);
    } finally { this.updateStatusUI(); }
  },

  async handleSessionLoss() {
    // Preserve edits for export when a session expires during background validation.
    if (this.pending || this.saving) {
      this.ready = false;
      this.status = 'error';
      this.error = t('登录已失效。请先导出未保存的内容，再刷新页面重新登录。');
      this.updateStatusUI();
      return;
    }
    await this.loadLocal(); applySettings(); render();
  },

  async useLocalAfterCloudFailure(error) {
    // Keep local and account data separate while allowing the page to stay usable.
    await this.loadLocal();
    this.cloudUnavailable = true;
    this.error = t`云端暂时不可用，当前使用此浏览器的本地内容。可点击同步重试。${error.message}${this.error ? `；${this.error}` : ''}`;
    this.updateStatusUI();
  },

  async loadCloud(currentData = null) {
    const generation = ++this.generation;
    this.mode = 'cloud';
    this.ready = false;
    this.status = 'syncing';
    this.updateStatusUI();
    const row = await cloud.read();
    if (generation !== this.generation) return;
    const data = normalizeAppData(currentData ? JSON.parse(JSON.stringify(currentData)) : (row ? row.data : JSON.parse(JSON.stringify(DEFAULT_DATA))));
    await migrateWallpaper(data);
    if (generation !== this.generation) return;
    this.revision = row?.revision ?? null;
    // Only initialize after a successful read confirmed the account is empty.
    if (currentData || !row) this.revision = await cloud.write(portableSnapshot(data), this.revision);
    if (generation !== this.generation) return;
    appData = data;
    await writeCloudCache(cloud.session?.user?.id, portableSnapshot(data), this.revision);
    if (generation !== this.generation) return;
    this.pending = null;
    this.conflict = false;
    this.error = '';
    this.cloudUnavailable = false;
    this.ready = true;
    this.status = 'saved';
    this.updateStatusUI();
  },

  async saveData() {
    if (!this.ready || (this.mode === 'cloud' && !cloud.session)) return false;
    if (appData.settings.wallpaper?.startsWith('data:')) {
      const generation = this.generation;
      try { await migrateWallpaper(appData); }
      catch (error) {
        this.error = error.message;
        this.status = 'error';
        this.updateStatusUI();
        return false;
      }
      if (generation !== this.generation) return false;
    }
    syncActiveGroupsToSpace();
    this.pending = portableSnapshot(appData);
    if (this.conflict) return false;
    if (this.saving) return this.saving;
    this.saving = Promise.resolve().then(() => this.flush());
    try { return await this.saving; }
    finally { this.saving = null; }
  },

  async flush() {
    const generation = this.generation;
    const mode = this.mode;
    this.status = mode === 'local' ? 'unsynced' : 'syncing';
    this.updateStatusUI();
    try {
      while (this.pending) {
        const snapshot = this.pending;
        if (mode === 'local') {
          const localVersion = await this.writeLocal(snapshot);
          if (generation !== this.generation) return false;
          this.localVersion = localVersion;
        } else {
          const userId = cloud.session.user.id;
          const revision = await cloud.write(snapshot, this.revision);
          if (generation !== this.generation) return false;
          this.revision = revision;
          await writeCloudCache(userId, snapshot, revision);
        }
        if (generation !== this.generation) return false;
        if (this.pending === snapshot) this.pending = null;
      }
      this.status = mode === 'local' ? 'local' : 'saved';
      this.error = '';
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.conflict = Boolean(error.conflict);
      this.error = error.message;
      this.status = 'error';
      return false;
    } finally { this.updateStatusUI(); }
  },

  async syncNow() {
    if (!this.ready) return false;
    if (this.pending || this.saving) return this.saveData();
    if (this.mode === 'local') {
      try {
        const generation = this.generation;
        const stored = await this.readLocal();
        if (generation !== this.generation || this.pending || this.saving) return true;
        if (fingerprint(stored) !== this.localVersion) {
          const data = normalizeAppData(stored);
          await migrateWallpaper(data);
          if (generation !== this.generation || this.pending || this.saving) return true;
          appData = data;
          this.localVersion = fingerprint(stored);
          applySettings(); render();
        }
        return true;
      } catch (error) {
        this.error = error.message;
        this.status = 'error';
        this.updateStatusUI();
        return false;
      }
    }
    const generation = this.generation;
    try {
      const revision = this.revision;
      const row = await cloud.read();
      // A local edit may have happened while the read was in flight.
      if (generation !== this.generation || this.pending || this.saving || this.revision !== revision) return true;
      if (!row) throw new Error(t('云端记录已移除，请退出后重新登录。'));
      if (row.revision === revision) {
        this.status = 'saved';
        this.error = '';
        this.updateStatusUI();
        return true;
      }
      const data = normalizeAppData(row.data);
      await migrateWallpaper(data);
      if (generation !== this.generation || this.pending || this.saving || this.revision !== revision) return true;
      appData = data;
      this.revision = row.revision;
      this.status = 'saved';
      this.error = '';
      await writeCloudCache(cloud.session?.user?.id, portableSnapshot(data), row.revision);
      if (generation !== this.generation) return true;
      this.updateStatusUI();
      applySettings();
      render();
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      if ([401, 403].includes(error.status)) {
        cloud.storeSession(null);
        await this.handleSessionLoss();
        return false;
      }
      this.error = error.message;
      this.status = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  async exportData() {
    const snapshot = portableSnapshot(appData);
    snapshot.settings.wallpaper = await exportWallpaper();
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `simtab_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  importData(file) {
    if (!this.ready) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if ((importedData.groups || importedData.spaces) && importedData.settings) {
          const data = normalizeAppData(importedData);
          const generation = this.generation;
          await migrateWallpaper(data);
          if (generation !== this.generation) return;
          appData = data;
          const saved = await this.saveData();
          applySettings();
          render();
          if (!saved) alert(t('内容已导入，但保存失败。请保持页面打开并重试保存或导出备份。'));
        } else {
          alert(t('无效的备份文件！'));
        }
      } catch (err) {
        alert(t`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
  }
};

// ==========================================
