// All SimTab pages use the same lock and compare the original stored snapshot.
// A stale tab must never silently overwrite a newer tab's changes.
export function fingerprint(data) { return JSON.stringify(data ?? null); }

export async function writeLocalSnapshot({ read, write, expected, snapshot, locks = globalThis.navigator?.locks }) {
  const commit = async () => {
    if (fingerprint(await read()) !== expected) {
      throw new Error('其他标签页已更新本地内容。请先导出当前更改，再刷新页面后重试，避免覆盖新收藏。');
    }
    await write(snapshot);
    return fingerprint(snapshot);
  };
  if (!locks) throw new Error('当前浏览器不支持安全的多标签页保存，请使用新版浏览器。');
  return locks.request('simtab-local-save', commit);
}
