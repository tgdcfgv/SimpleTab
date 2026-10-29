// A bounded region list is shared by the page, extension worker, and web proxy.
export function searchRegion(language) {
  return ({ zh_CN: 'cn', zh_TW: 'tw', ja: 'jp', en: 'us' })[language] || 'us';
}
