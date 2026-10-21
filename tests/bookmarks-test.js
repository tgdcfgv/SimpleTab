import { parseBookmarkHTML } from '../js/extension.js';
import { escapeHTML } from '../js/utils.js';
const output = document.createElement('pre');
output.id = 'test-result';
output.style.cssText = 'position:fixed;inset:20px;z-index:99999;background:white;color:black;padding:30px;white-space:pre-wrap';
document.body.appendChild(output);
try {
  const links = parseBookmarkHTML(await (await fetch('./tests/bookmarks.html')).text());
  if (links.length !== 2) throw new Error('Expected two unique safe URLs');
  if (links[0].title !== 'Example & test') throw new Error('Entity decoding failed');
  if (links[1].title !== '<img src=x onerror=alert(1)>') throw new Error('Title preservation failed');
  const sandbox = document.createElement('div');
  sandbox.innerHTML = `<span>${escapeHTML(links[1].title)}</span>`;
  if (sandbox.querySelector('img') || sandbox.textContent !== links[1].title) throw new Error('Unsafe title rendering');
  if (parseBookmarkHTML('<p>No bookmarks</p>').length !== 0) throw new Error('Empty file handling');
  output.textContent = 'PASS: duplicate URLs removed; javascript and invalid URLs rejected; HTML titles escaped; empty files handled.';
} catch (error) { output.textContent = `FAIL: ${error.message}`; }
