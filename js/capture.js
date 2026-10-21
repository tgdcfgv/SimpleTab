import { appData, setActiveSpace, syncManager } from './storage.js';
import { cloud } from './cloud.js';
import { render } from './render.js';
import { CAPTURE_PREFIX, addCapturedLink, validDraft } from './capture-model.js';
import { safeWebUrl } from './urls.js';

export async function initCapture() {
  if (!globalThis.chrome?.runtime?.id || !chrome.storage?.session) return;
  const token = new URLSearchParams(location.hash.slice(1)).get('capture');
  if (!token || !/^[\da-f-]{36}$/i.test(token)) return;
  const key = CAPTURE_PREFIX + token;
  const dialog = document.getElementById('captureDialog');
  const form = document.getElementById('captureForm');
  const fields = document.getElementById('captureFields');
  const spaceSelect = document.getElementById('captureSpace');
  const groupSelect = document.getElementById('captureGroup');
  const message = document.getElementById('captureMessage');
  const cancel = document.getElementById('captureCancel');
  const submit = document.getElementById('captureSave');
  const settings = document.getElementById('settingsModal');
  let draft;
  let loaded = false;
  let busy = false;
  let completed = false;
  let opened = false;
  let sourceGeneration;
  let targetSpace;
  let unsaved = false;

  async function discard() {
    try { await chrome.storage.session.remove(key); }
    catch (error) { console.warn('无法清理收藏草稿', error); }
    history.replaceState(null, '', location.pathname + location.search);
  }

  function groups(preferred) {
    groupSelect.replaceChildren();
    const space = appData.spaces.find(item => item.id === spaceSelect.value);
    for (const group of space?.groups || []) groupSelect.add(new Option(group.name, group.id));
    if ([...groupSelect.options].some(option => option.value === preferred)) groupSelect.value = preferred;
    submit.disabled = !groupSelect.value;
  }

  function destinations() {
    const preferredSpace = spaceSelect.value || appData.activeSpaceId;
    const preferredGroup = groupSelect.value;
    spaceSelect.replaceChildren();
    for (const space of appData.spaces) spaceSelect.add(new Option(space.name, space.id));
    if (appData.spaces.some(space => space.id === preferredSpace)) spaceSelect.value = preferredSpace;
    groups(preferredGroup);
    document.getElementById('captureDestination').textContent = syncManager.mode === 'local'
      ? '保存到此浏览器的本地内容' : `保存到云端账户 ${cloud.session?.user?.email || ''}`;
    sourceGeneration = syncManager.generation;
  }

  function show() {
    if (!loaded || completed || !settings.classList.contains('hidden') || !syncManager.ready || (cloud.session?.needs_choice)) return;
    if (!opened) {
      opened = true;
      if (!validDraft(draft)) {
        form.hidden = true;
        submit.hidden = true;
        message.textContent = '收藏草稿已过期，请回到原页面重新收藏。';
      } else if (!safeWebUrl(draft.url)) {
        form.hidden = true;
        submit.hidden = true;
        message.textContent = '当前页面无法收藏，请在 HTTP 或 HTTPS 网页上使用此功能。';
      } else {
        document.getElementById('captureUrl').value = draft.url;
        document.getElementById('captureTitle').value = draft.title;
        destinations();
      }
      dialog.showModal();
    } else if (!busy && sourceGeneration !== syncManager.generation && !form.hidden) {
      destinations();
      message.textContent = '内容来源已更改，请确认目标空间和分组后保存。';
    }
  }

  spaceSelect.addEventListener('change', () => groups());
  document.addEventListener('simtab-sync', show);
  document.addEventListener('simtab-settings-close', show);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (!busy) cancel.click();
  });
  cancel.addEventListener('click', async () => {
    if (busy) return;
    if (!unsaved) await discard();
    completed = true;
    dialog.close();
    if (targetSpace) { setActiveSpace(targetSpace); render(); }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || completed) return;
    const request = { spaceId: spaceSelect.value, groupId: groupSelect.value,
      title: document.getElementById('captureTitle').value,
      url: document.getElementById('captureUrl').value };
    busy = true;
    fields.disabled = true;
    submit.disabled = true;
    cancel.disabled = true;
    message.textContent = '正在保存…';
    try {
      const retryingSave = unsaved;
      const generation = syncManager.generation;
      if (!syncManager.ready || generation !== sourceGeneration || cloud.session?.needs_choice) {
        throw new Error('内容来源已更改，请重新确认保存位置。');
      }
      // Retry any failed prior save before treating an existing URL as persisted.
      if ((syncManager.pending || syncManager.saving) && !await syncManager.saveData()) {
        throw new Error(syncManager.error || '尚有未保存内容，请重试同步。');
      }
      if (!await syncManager.syncNow()) throw new Error(syncManager.error || '无法读取最新内容，请重试。');
      if (generation !== syncManager.generation) throw new Error('内容来源已更改，请重新确认保存位置。');
      unsaved = false;
      const result = addCapturedLink(appData, request, crypto.randomUUID());
      if (result.added) {
        unsaved = true;
        if (!await syncManager.saveData()) throw new Error(syncManager.error || '保存失败，请重试。');
        unsaved = false;
      }
      targetSpace = result.space.id;
      message.textContent = result.added || retryingSave
        ? `已保存到「${result.space.name} / ${result.group.name}」。`
        : `此网址已在「${result.space.name} / ${result.group.name}」中，无需重复添加。`;
      form.hidden = true;
      submit.hidden = true;
      cancel.textContent = '查看已保存的网站';
      await discard();
      render();
    } catch (error) {
      message.textContent = `${error.message}${unsaved ? ' 更改仍在当前页面，请保持页面打开并重试。' : ''}`;
      destinations();
      cancel.textContent = unsaved ? '保留页面，稍后处理' : '取消';
    } finally {
      busy = false;
      fields.disabled = false;
      submit.disabled = !groupSelect.value;
      cancel.disabled = false;
    }
  });

  try { draft = (await chrome.storage.session.get(key))[key]; }
  catch { draft = null; }
  loaded = true;
  show();
}
