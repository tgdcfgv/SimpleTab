// A bounded region list is shared by the page, extension worker, and web proxy.
export function searchRegion(language) {
  return ({
    zh_CN: 'cn', zh_TW: 'tw', ja: 'jp', ko: 'kr',
    es: 'es', de: 'de', pt_BR: 'br', fr: 'fr', en: 'us'
  })[language] || 'us';
}
