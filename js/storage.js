import { render, applySettings } from './render.js';
import { cloud } from './cloud.js';

import { DEFAULT_DATA, normalizeAppData } from './data.js';
import { migrateWallpaper, portableSnapshot } from './wallpaper.js';
import { fingerprint, writeLocalSnapshot } from './local-store.js';
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
  localVersion: 'null',

  updateStatusUI() {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const labels = { local: '本地已保存', saved: '云端已保存', unsynced: '有未保存更改', syncing: '云端同步中…',
      signedout: '请登录以使用云端数据', error: this.conflict ? '存在同步冲突 · 点击处理' : (this.mode === 'local' ? '本地保存失败 · 点击重试' : '同步失败 · 点击重试') };
    el.querySelector('.status-dot').className = ['saved', 'local'].includes(this.status) ? 'status-dot' : 'status-dot unsynced';
    el.querySelector('.status-text').textContent = labels[this.status];
    el.title = this.error || (this.mode === 'local' ? '数据保存在此浏览器，登录后切换到云端内容' : '点击同步云端数据');
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
      this.error = `读取本地数据或迁移壁纸失败：${error.message}。原数据未被清理，请检查浏览器存储后刷新。`;
      this.status = 'error';
    }
    this.ready = this.status !== 'error';
    this.updateStatusUI();
  },

  async loadData() {
    this.ready = false;
    appData = normalizeAppData(null);
    try {
      if (!await cloud.restore()) return await this.loadLocal();
      if (cloud.session.needs_choice) return await this.loadLocal();
      await this.loadCloud();
    } catch (error) {
      if (!cloud.session || cloud.session.needs_choice) return await this.loadLocal();
      this.mode = 'cloud';
      this.error = error.message;
      this.status = 'error';
    } finally { this.updateStatusUI(); }
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
    this.pending = null;
    this.conflict = false;
    this.error = '';
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
          const revision = await cloud.write(snapshot, this.revision);
          if (generation !== this.generation) return false;
          this.revision = revision;
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
    try {
      const generation = this.generation;
      const revision = this.revision;
      const row = await cloud.read();
      // A local edit may have happened while the read was in flight.
      if (generation !== this.generation || this.pending || this.saving || this.revision !== revision) return true;
      if (!row) throw new Error('云端记录已移除，请退出后重新登录。');
      const data = normalizeAppData(row.data);
      await migrateWallpaper(data);
      if (generation !== this.generation || this.pending || this.saving || this.revision !== revision) return true;
      appData = data;
      this.revision = row.revision;
      this.status = 'saved';
      this.error = '';
      this.updateStatusUI();
      applySettings();
      render();
      return true;
    } catch (error) {
      this.error = error.message;
      this.status = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  exportData() {
    const dataStr = JSON.stringify(portableSnapshot(appData), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `simtab_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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
          if (!saved) alert('内容已导入，但保存失败。请保持页面打开并重试保存或导出备份。');
        } else {
          alert('无效的备份文件！');
        }
      } catch (err) {
        alert(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
  }
};

// ==========================================
