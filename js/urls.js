// Shared by imports, cloud restoration, forms and search.
export function safeWebUrl(value, { allowBare = false } = {}) {
  if (typeof value !== 'string') return null;
  let input = value.trim();
  if (!input || /[\u0000-\u001f\u007f]/.test(input)) return null;
  if (allowBare && !/^[a-z][a-z\d+.-]*:/i.test(input)) input = `https://${input}`;
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

export function safeImageUrl(value) {
  return safeWebUrl(value) || (typeof value === 'string' &&
    /^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z\d+/=\s]+$/i.test(value) ? value : null);
}
