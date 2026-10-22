import { safeWebUrl, safeImageUrl } from './urls.js';

export const SEARCH_ENGINES = [
  { id: "bing", name: "Bing", homeUrl: "https://www.bing.com", searchUrl: "https://www.bing.com/search?q=", suggestUrl: "https://api.bing.com/osjson.aspx?query=" },
  { id: "baidu", name: "百度", homeUrl: "https://www.baidu.com", searchUrl: "https://www.baidu.com/s?wd=" },
  { id: "so360", name: "360 搜索", homeUrl: "https://www.so.com", searchUrl: "https://www.so.com/s?q=" },
  { id: "sogou", name: "搜狗", homeUrl: "https://www.sogou.com", searchUrl: "https://www.sogou.com/web?query=" },
  { id: "google", name: "Google", homeUrl: "https://www.google.com", searchUrl: "https://www.google.com/search?q=" },
  { id: "duckduckgo", name: "DuckDuckGo", homeUrl: "https://duckduckgo.com", searchUrl: "https://duckduckgo.com/?q=" },
  { id: "yahoo", name: "Yahoo", homeUrl: "https://search.yahoo.com", searchUrl: "https://search.yahoo.com/search?p=" },
  { id: "yandex", name: "Yandex", homeUrl: "https://yandex.com", searchUrl: "https://yandex.com/search/?text=" }
];

export const DEFAULT_DATA = {
  groups: [
    {
      id: "g1",
      name: "常用",
      collapsed: false,
      links: [
        { id: "l1", title: "哔哩哔哩", url: "https://www.bilibili.com" },
        { id: "l2", title: "知乎", url: "https://www.zhihu.com" },
        { id: "l3", title: "GitHub", url: "https://github.com" },
        { id: "l4", title: "QQ 邮箱", url: "https://mail.qq.com" }
      ]
    },
    {
      id: "g2",
      name: "AI 工具",
      collapsed: false,
      links: [
        { id: "l5", title: "DeepSeek", url: "https://chat.deepseek.com", customIcon: "https://fe-static.deepseek.com/chat/favicon.svg" },
        { id: "l6", title: "Kimi", url: "https://kimi.moonshot.cn" },
        { id: "l7", title: "豆包", url: "https://www.doubao.com" },
        { id: "l8", title: "通义千问", url: "https://tongyi.aliyun.com" },
        { id: "l9", title: "腾讯元宝", url: "https://yuanbao.tencent.com" }
      ]
    },
    {
      id: "g3",
      name: "学习与参考",
      collapsed: false,
      links: [
        { id: "l10", title: "中国知网", url: "https://www.cnki.net" },
        { id: "l11", title: "中国大学 MOOC", url: "https://www.icourse163.org" },
        { id: "l12", title: "有道词典", url: "https://dict.youdao.com" },
        { id: "l13", title: "Cambridge 词典", url: "https://dictionary.cambridge.org" }
      ]
    },
    {
      id: "g4",
      name: "设计工具",
      collapsed: false,
      links: [
        { id: "l14", title: "即时设计", url: "https://js.design" },
        { id: "l15", title: "Canva 可画", url: "https://www.canva.cn" },
        { id: "l16", title: "Iconfont", url: "https://iconfont.cn" },
        { id: "l17", title: "Figma", url: "https://figma.com" }
      ]
    },
    {
      id: "g5",
      name: "临时收藏",
      collapsed: false,
      links: []
    }
  ],
  settings: {
    groupColumns: "auto",
    compactMode: false,
    cardDisplayMode: "icon-text",
    iconSize: 24,
    openLinksInNewTab: false,
    searchEngine: "bing",
    enabledSearchEngines: ["bing", "baidu"],
    theme: "system",
    accentColor: "#6366f1",
    dockPosition: "bottom",
    dockEnabled: true,
    showDockAccountButton: true,
    showDockSettingsButton: true,
    showDockAddGroupButton: true,
    showDockAddSiteButton: true,
    showDockStoreButton: false,
    hiddenDockSpaces: [],
    showDockTabHint: true,
    showDockEditButton: true,
    wallpaper: null
  }
};

export const TEMPORARY_GROUP_NAME = "临时收藏";

export function createTemporaryGroup(index = 0) {
  return {
    id: `temporary-${Date.now()}-${index}`,
    name: TEMPORARY_GROUP_NAME,
    collapsed: false,
    links: []
  };
}

export function ensureTemporaryGroup(groups, index = 0) {
  if (!Array.isArray(groups)) return [createTemporaryGroup(index)];
  groups = groups.filter(group => group && typeof group === 'object' && !Array.isArray(group));
  const hasTemporaryGroup = groups.some(group => group.name === TEMPORARY_GROUP_NAME);
  return hasTemporaryGroup ? groups : [...groups, createTemporaryGroup(index)];
}

export function createDefaultSpaces(groups = []) {
  return [
    {
      id: "space-home",
      name: "主页",
      groups: ensureTemporaryGroup(groups, 0)
    },
    {
      id: "space-work",
      name: "工作",
      groups: [createTemporaryGroup(1)]
    },
    {
      id: "space-favorites",
      name: "收藏",
      groups: [createTemporaryGroup(2)]
    }
  ];
}

function areGroupListsEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (err) {
    return false;
  }
}

export function normalizeAppData(data) {
  if (data != null && (typeof data !== 'object' || Array.isArray(data))) {
    throw new TypeError('无效的配置数据');
  }
  const normalized = JSON.parse(JSON.stringify(data ?? DEFAULT_DATA));
  const topLevelGroups = Array.isArray(normalized.groups) ? normalized.groups : null;
  normalized.settings = {
    ...DEFAULT_DATA.settings,
    ...(normalized.settings || {})
  };
  if (![1, 2, 3, 4, 5, 6].includes(normalized.settings.groupColumns)) normalized.settings.groupColumns = 'auto';
  if (normalized.settings.dockPosition === 'hidden') {
    normalized.settings.dockEnabled = false;
    normalized.settings.dockPosition = 'bottom';
  }
  if (!['left', 'right', 'bottom'].includes(normalized.settings.dockPosition)) normalized.settings.dockPosition = 'bottom';
  normalized.settings.hiddenDockSpaces = Array.isArray(normalized.settings.hiddenDockSpaces)
    ? normalized.settings.hiddenDockSpaces.filter(id => typeof id === 'string') : [];
  normalized.settings.wallpaper = safeImageUrl(normalized.settings.wallpaper);
  const validEngineIds = new Set(SEARCH_ENGINES.map(engine => engine.id));
  normalized.settings.enabledSearchEngines = Array.isArray(normalized.settings.enabledSearchEngines)
    ? normalized.settings.enabledSearchEngines.filter(id => validEngineIds.has(id))
    : ["bing", "baidu"];
  if (normalized.settings.enabledSearchEngines.length === 0) {
    normalized.settings.enabledSearchEngines = ["bing", "baidu"];
  }
  if (!normalized.settings.enabledSearchEngines.includes(normalized.settings.searchEngine)) {
    normalized.settings.searchEngine = normalized.settings.enabledSearchEngines[0];
  }

  if (!Array.isArray(normalized.spaces) || normalized.spaces.length === 0) {
    normalized.spaces = createDefaultSpaces(normalized.groups || []);
  }

  const legacyDefaultIds = ["space-work", "space-leisure", "space-xx"];
  const isLegacyDefaultSet = normalized.spaces.length === 3
    && legacyDefaultIds.every((id, index) => normalized.spaces[index]?.id === id);
  if (isLegacyDefaultSet) {
    const migratedIds = ["space-home", "space-work", "space-favorites"];
    const migratedNames = ["主页", "工作", "收藏"];
    const activeIndex = legacyDefaultIds.indexOf(normalized.activeSpaceId);
    normalized.spaces.forEach((space, index) => {
      space.id = migratedIds[index];
      space.name = migratedNames[index];
    });
    if (activeIndex >= 0) normalized.activeSpaceId = migratedIds[activeIndex];
  }

  normalized.spaces = normalized.spaces.filter(space => space && typeof space === 'object' && !Array.isArray(space));
  if (!normalized.spaces.length) normalized.spaces = createDefaultSpaces(topLevelGroups || []);
  normalized.spaces.forEach((space, index) => {
    if (!space.id) space.id = `space-${Date.now()}-${index}`;
    if (!space.name) space.name = `空间 ${index + 1}`;
    if (!Array.isArray(space.groups)) space.groups = [];
    space.groups = ensureTemporaryGroup(space.groups.filter(group => group && typeof group === 'object' && !Array.isArray(group)), index);
  });

  if (!normalized.activeSpaceId || !normalized.spaces.some(space => space.id === normalized.activeSpaceId)) {
    normalized.activeSpaceId = normalized.spaces[0].id;
  }

  const activeSpace = normalized.spaces.find(space => space.id === normalized.activeSpaceId);
  if (topLevelGroups && !areGroupListsEqual(topLevelGroups, activeSpace.groups)) {
    const activeSpaceIndex = normalized.spaces.findIndex(space => space.id === activeSpace.id);
    activeSpace.groups = ensureTemporaryGroup(topLevelGroups.filter(group => group && typeof group === 'object' && !Array.isArray(group)), activeSpaceIndex);
  }
  normalized.spaces.forEach(space => {
    space.groups.forEach((group, groupIndex) => {
      group.id = String(group.id || `group-${space.id}-${groupIndex}`);
      group.name = String(group.name || '未命名分组');
      if (!Array.isArray(group.links)) group.links = [];
      group.links = group.links.flatMap((link, linkIndex) => {
        if (!link || typeof link !== 'object') return [];
        const url = safeWebUrl(link.url);
        if (!url) return [];
        const clean = { ...link, id: String(link.id || `link-${group.id}-${linkIndex}`),
          title: String(link.title || new URL(url).hostname), url };
        const customIcon = safeImageUrl(link.customIcon);
        delete clean.customIcon;
        if (customIcon) clean.customIcon = customIcon;
        return [clean];
      });
      delete group.browserBookmarksEnabled;
    });
  });
  normalized.groups = activeSpace.groups;
  return normalized;
}

