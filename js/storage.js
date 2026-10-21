import { render, applySettings } from './render.js';

export const SEARCH_ENGINES = [
  { id: "google", name: "Google", homeUrl: "https://www.google.com", searchUrl: "https://www.google.com/search?q=" },
  { id: "bing", name: "Bing", homeUrl: "https://www.bing.com", searchUrl: "https://www.bing.com/search?q=" },
  { id: "baidu", name: "百度", homeUrl: "https://www.baidu.com", searchUrl: "https://www.baidu.com/s?wd=" },
  { id: "duckduckgo", name: "DuckDuckGo", homeUrl: "https://duckduckgo.com", searchUrl: "https://duckduckgo.com/?q=" },
  { id: "so360", name: "360 搜索", homeUrl: "https://www.so.com", searchUrl: "https://www.so.com/s?q=" },
  { id: "sogou", name: "搜狗", homeUrl: "https://www.sogou.com", searchUrl: "https://www.sogou.com/web?query=" },
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
        { id: "l1", title: "Gmail", url: "https://mail.google.com" },
        { id: "l2", title: "YouTube", url: "https://youtube.com" },
        { id: "l3", title: "GitHub", url: "https://github.com" },
        { id: "l4", title: "Bilibili", url: "https://bilibili.com" }
      ]
    },
    {
      id: "g2",
      name: "AI 工具",
      collapsed: false,
      links: [
        { id: "l5", title: "ChatGPT", url: "https://chatgpt.com" },
        { id: "l6", title: "Claude", url: "https://claude.ai" },
        { id: "l7", title: "Gemini", url: "https://gemini.google.com" },
        { id: "l8", title: "DeepSeek", url: "https://chat.deepseek.com", customIcon: "https://fe-static.deepseek.com/chat/favicon.svg" },
        { id: "l9", title: "Kimi", url: "https://kimi.moonshot.cn" }
      ]
    },
    {
      id: "g3",
      name: "学习",
      collapsed: false,
      links: [
        { id: "l10", title: "Google Scholar", url: "https://scholar.google.com" },
        { id: "l11", title: "Wikipedia", url: "https://wikipedia.org" },
        { id: "l12", title: "Cambridge Dictionary", url: "https://dictionary.cambridge.org" }
      ]
    },
    {
      id: "g4",
      name: "设计工具",
      collapsed: false,
      links: [
        { id: "l13", title: "Figma", url: "https://figma.com" },
        { id: "l14", title: "Canva", url: "https://canva.com" },
        { id: "l15", title: "Iconfont", url: "https://iconfont.cn" }
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
    compactMode: false,
    cardDisplayMode: "icon-text",
    iconSize: 24,
    openLinksInNewTab: false,
    searchEngine: "google",
    enabledSearchEngines: ["google", "bing"],
    theme: "system",
    accentColor: "#6366f1",
    dockPosition: "bottom",
    showDockTabHint: true,
    showDockEditButton: true,
    wallpaper: null
  }
};

export let appData = null;
export function setAppData(data) { appData = data; }

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

function areGroupListsEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (err) {
    return false;
  }
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

export function normalizeAppData(data) {
  const normalized = data || JSON.parse(JSON.stringify(DEFAULT_DATA));
  const topLevelGroups = Array.isArray(normalized.groups) ? normalized.groups : null;
  normalized.settings = {
    ...DEFAULT_DATA.settings,
    ...(normalized.settings || {})
  };
  const validEngineIds = new Set(SEARCH_ENGINES.map(engine => engine.id));
  normalized.settings.enabledSearchEngines = Array.isArray(normalized.settings.enabledSearchEngines)
    ? normalized.settings.enabledSearchEngines.filter(id => validEngineIds.has(id))
    : ["google", "bing"];
  if (normalized.settings.enabledSearchEngines.length === 0) {
    normalized.settings.enabledSearchEngines = ["google", "bing"];
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

  normalized.spaces.forEach((space, index) => {
    if (!space.id) space.id = `space-${Date.now()}-${index}`;
    if (!space.name) space.name = `空间 ${index + 1}`;
    if (!Array.isArray(space.groups)) space.groups = [];
    space.groups = ensureTemporaryGroup(space.groups, index);
  });

  if (!normalized.activeSpaceId || !normalized.spaces.some(space => space.id === normalized.activeSpaceId)) {
    normalized.activeSpaceId = normalized.spaces[0].id;
  }

  const activeSpace = normalized.spaces.find(space => space.id === normalized.activeSpaceId);
  if (topLevelGroups && !areGroupListsEqual(topLevelGroups, activeSpace.groups)) {
    const activeSpaceIndex = normalized.spaces.findIndex(space => space.id === activeSpace.id);
    activeSpace.groups = ensureTemporaryGroup(topLevelGroups, activeSpaceIndex);
  }
  normalized.spaces.forEach(space => {
    space.groups.forEach(group => {
      if (!Array.isArray(group.links)) group.links = [];
      delete group.browserBookmarksEnabled;
    });
  });
  normalized.groups = activeSpace.groups;
  return normalized;
}

export const linkStore = [
  {
    id: "browser-bookmarks",
    name: "我的收藏夹",
    dynamicType: "browser-bookmarks",
    links: []
  },
  {
    id: "ai",
    name: "AI 工具",
    links: [
      { name: "ChatGPT", url: "https://chatgpt.com" },
      { name: "Claude", url: "https://claude.ai" },
      { name: "Gemini", url: "https://gemini.google.com" },
      { name: "Perplexity", url: "https://www.perplexity.ai" },
      { name: "Kimi", url: "https://kimi.moonshot.cn" },
      { name: "通义千问", url: "https://tongyi.aliyun.com" },
      { name: "豆包", url: "https://www.doubao.com" },
      { name: "DeepSeek", url: "https://www.deepseek.com" },
      { name: "元宝", url: "https://yuanbao.tencent.com" },
      { name: "Suno", url: "https://suno.com" },
      { name: "Udio", url: "https://www.udio.com" },
      { name: "Copilot", url: "https://copilot.microsoft.com/" },
      { name: "Arena", url: "https://arena.ai/" },
      { name: "Meta AI", url: "https://www.meta.ai/" },
      { name: "Hugging Face", url: "https://huggingface.co" },
      { name: "Artificial Analysis", url: "https://www.artificial-analysis.com" },
      { name: "Manus", url: "https://www.manus.com" },
      { name: "Mistral Chat", url: "https://www.mistral.chat" },
      { name: "MiniMax", url: "https://www.minimax.com" },
      { name: "Grok", url: "https://www.grok.com" },
      { name: "Google AI Studio", url: "https://aistudio.google.com" }
    ]
  },
  {
    id: "design",
    name: "设计与灵感",
    links: [
      { name: "Figma", url: "https://www.figma.com" },
      { name: "Canva", url: "https://www.canva.com" },
      { name: "Adobe Express", url: "https://www.adobe.com/express" },
      { name: "Framer", url: "https://www.framer.com" },
      { name: "Dribbble", url: "https://dribbble.com" },
      { name: "Behance", url: "https://www.behance.net" },
      { name: "Pinterest", url: "https://www.pinterest.com" },
      { name: "花瓣网", url: "https://huaban.com" },
      { name: "站酷", url: "https://www.zcool.com.cn" },
      { name: "稿定设计", url: "https://www.gaoding.com" }
    ]
  },
  {
    id: "assets",
    name: "图片与素材",
    links: [
      { name: "Unsplash", url: "https://unsplash.com" },
      { name: "Pexels", url: "https://www.pexels.com" },
      { name: "Pixabay", url: "https://pixabay.com" },
      { name: "Freepik", url: "https://www.freepik.com" },
      { name: "Iconfont", url: "https://www.iconfont.cn" },
      { name: "Font Awesome", url: "https://fontawesome.com" },
      { name: "Google Fonts", url: "https://fonts.google.com" },
      { name: "Mixkit", url: "https://mixkit.co" },
      { name: "LottieFiles", url: "https://lottiefiles.com" },
      { name: "Remove.bg", url: "https://www.remove.bg" }
    ]
  },
  {
    id: "dev",
    name: "开发与建站",
    links: [
      { name: "GitHub", url: "https://github.com" },
      { name: "GitLab", url: "https://gitlab.com" },
      { name: "Stack Overflow", url: "https://stackoverflow.com" },
      { name: "MDN Web Docs", url: "https://developer.mozilla.org" },
      { name: "npm", url: "https://www.npmjs.com" },
      { name: "Vercel", url: "https://vercel.com" },
      { name: "Netlify", url: "https://www.netlify.com" },
      { name: "Cloudflare", url: "https://www.cloudflare.com" },
      { name: "CodePen", url: "https://codepen.io" },
      { name: "Replit", url: "https://replit.com" },
      { name: "Google Cloud", url: "https://cloud.google.com" },
      { name: "AWS", url: "https://aws.amazon.com" },
      { name: "Azure", url: "https://azure.microsoft.com" },
      { name: "Heroku", url: "https://www.heroku.com" },
      { name: "DigitalOcean", url: "https://www.digitalocean.com" }
    ]
  },
  {
    id: "productivity",
    name: "效率与文档",
    links: [
      { name: "Notion", url: "https://www.notion.com" },
      { name: "飞书", url: "https://www.feishu.cn" },
      { name: "腾讯文档", url: "https://docs.qq.com" },
      { name: "钉钉", url: "https://www.dingtalk.com" },
      { name: "语雀", url: "https://www.yuque.com" },
      { name: "石墨文档", url: "https://shimo.im" },
      { name: "Trello", url: "https://trello.com" },
      { name: "Todoist", url: "https://todoist.com" },
      { name: "ProcessOn", url: "https://www.processon.com" },
      { name: "幕布", url: "https://mubu.com" }
    ]
  },
  {
    id: "cloud",
    name: "云盘与文件",
    links: [
      { name: "Google Drive", url: "https://drive.google.com" },
      { name: "OneDrive", url: "https://onedrive.live.com" },
      { name: "Dropbox", url: "https://www.dropbox.com" },
      { name: "百度网盘", url: "https://pan.baidu.com" },
      { name: "阿里云盘", url: "https://www.alipan.com" },
      { name: "夸克网盘", url: "https://pan.quark.cn" },
      { name: "坚果云", url: "https://www.jianguoyun.com" },
      { name: "iCloud", url: "https://www.icloud.com/" },

    ]
  },
  {
    id: "study",
    name: "学习与论文",
    links: [
      { name: "Google Scholar", url: "https://scholar.google.com" },
      { name: "Semantic Scholar", url: "https://www.semanticscholar.org" },
      { name: "arXiv", url: "https://arxiv.org" },
      { name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov" },
      { name: "CNKI 中国知网", url: "https://www.cnki.net" },
      { name: "万方数据", url: "https://www.wanfangdata.com.cn" },
      { name: "维普网", url: "https://www.cqvip.com" },
      { name: "Zotero", url: "https://www.zotero.org" },
      { name: "Coursera", url: "https://www.coursera.org" },
      { name: "edX", url: "https://www.edx.org" },
      { name: "Z-Library", url: "https://zlibrary.se" },
      { name: "MagazineLib", url: "https://magazinelib.com" }
    ]
  },
  {
    id: "community",
    name: "社区与内容",
    links: [
      { name: "知乎", url: "https://www.zhihu.com" },
      { name: "小红书", url: "https://www.xiaohongshu.com" },
      { name: "哔哩哔哩", url: "https://www.bilibili.com" },
      { name: "微博", url: "https://weibo.com" },
      { name: "豆瓣", url: "https://www.douban.com" },
      { name: "即刻", url: "https://web.okjike.com" },
      { name: "Reddit", url: "https://www.reddit.com" },
      { name: "X", url: "https://x.com" },
      { name: "Threads", url: "https://www.threads.com/" },
      { name: "YouTube", url: "https://www.youtube.com" },
      { name: "Medium", url: "https://medium.com" }
    ]
  },
  {
    id: "news",
    name: "新闻与资讯",
    links: [
      { name: "澎湃新闻", url: "https://www.thepaper.cn" },
      { name: "BBC", url: "https://www.bbc.com" },
      { name: "Reuters", url: "https://www.reuters.com" },
      { name: "AP News", url: "https://apnews.com" },
      { name: "The Verge", url: "https://www.theverge.com" },
      { name: "Wired", url: "https://www.wired.com" },
      { name: "The Guardian", url: "https://www.theguardian.com" },
      { name: "纽约时报", url: "https://www.nytimes.com" },
      { name: "华尔街日报", url: "https://www.wsj.com" },
      { name: "路透社", url: "https://cn.reuters.com" },
      { name: "财新网", url: "https://www.caixin.com" },
      { name: "Pitchfork", url: "https://pitchfork.com/" },
      { name: "NME", url: "https://www.nme.com/" },
      { name: "Rolling Stone", url: "https://www.rollingstone.com/" }
    ]
  },
  {
    id: "shopping",
    name: "购物与生活",
    links: [
      { name: "淘宝", url: "https://www.taobao.com" },
      { name: "天猫", url: "https://www.tmall.com" },
      { name: "京东", url: "https://www.jd.com" },
      { name: "拼多多", url: "https://www.pinduoduo.com" },
      { name: "亚马逊", url: "https://www.amazon.com" },
      { name: "什么值得买", url: "https://www.smzdm.com" },
      { name: "美团", url: "https://www.meituan.com" },
      { name: "饿了么", url: "https://www.ele.me" },
      { name: "携程", url: "https://www.ctrip.com" },
      { name: "12306", url: "https://www.12306.cn" }
    ]
  },
  {
    id: "maps-travel",
    name: "地图与出行",
    links: [
      { name: "高德地图", url: "https://www.amap.com" },
      { name: "百度地图", url: "https://map.baidu.com" },
      { name: "Google Maps", url: "https://maps.google.com" },
      { name: "腾讯地图", url: "https://map.qq.com" },
      { name: "滴滴出行", url: "https://www.didiglobal.com" },
      { name: "飞猪", url: "https://www.fliggy.com" },
      { name: "Trip.com", url: "https://www.trip.com" },
      { name: "Booking", url: "https://www.booking.com" }
    ]
  },
  {
    id: "music-video",
    name: "音乐与视频创作",
    links: [
      { name: "Spotify", url: "https://open.spotify.com" },
      { name: "Apple Music", url: "https://music.apple.com" },
      { name: "网易云音乐", url: "https://music.163.com" },
      { name: "QQ 音乐", url: "https://y.qq.com" },
      { name: "YouTube Music", url: "https://music.youtube.com" },
      { name: "SoundCloud", url: "https://soundcloud.com" },
      { name: "Bandcamp", url: "https://bandcamp.com" },
      { name: "Suno", url: "https://suno.com" },
      { name: "Udio", url: "https://www.udio.com" },
      { name: "CapCut", url: "https://www.capcut.com" }
    ]
  },
  {
    id: "vpn",
    name: "VPN 与网络工具",
    links: [
      { name: "挂梯子", url: "https://guatizi.com" },
      { name: "茶波博客", url: "https://naichabobo.com" },
      { name: "二毛 / 二猫子测评", url: "https://www.ermao.net" },
      { name: "二毛翻墙机场严选", url: "https://ermao.org" },
      { name: "墙妈妈", url: "https://www.wallmama.com" },
      { name: "毒药机场推荐", url: "https://www.duyaoss.com" },
      { name: "Net.Coffee IP 查询", url: "https://ip.net.coffee/" }
    ]
  }
];

// ==========================================
// Sync Manager Module

export const syncManager = {
  status: 'saved', // 'saved', 'unsynced', 'syncing', 'error'
  
  updateStatusUI() {
    const el = document.getElementById('syncStatus');
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');
    
    if (this.status === 'saved') {
      dot.className = 'status-dot';
      text.textContent = '本地已保存';
    } else if (this.status === 'unsynced') {
      dot.className = 'status-dot unsynced';
      text.textContent = '有未同步更改';
    } else if (this.status === 'syncing') {
      dot.className = 'status-dot unsynced'; 
      text.textContent = '同步中...';
    } else {
      dot.className = 'status-dot unsynced';
      text.textContent = '同步失败';
    }
  },

  async loadData() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get(['appData']);
      if (data.appData) {
        appData = normalizeAppData(data.appData);
      } else {
        appData = normalizeAppData(JSON.parse(JSON.stringify(DEFAULT_DATA)));
        this.saveData(true);
      }
    } else {
      // Fallback for local dev without extension environment
      const data = localStorage.getItem('appData');
      if (data) {
        appData = normalizeAppData(JSON.parse(data));
      } else {
        appData = normalizeAppData(JSON.parse(JSON.stringify(DEFAULT_DATA)));
        this.saveData(true);
      }
    }
    this.status = 'saved';
    this.updateStatusUI();
  },

  async saveData(isInit = false) {
    syncActiveGroupsToSpace();
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ appData });
    } else {
      localStorage.setItem('appData', JSON.stringify(appData));
    }
    
    if (!isInit) {
      this.status = 'unsynced';
      this.updateStatusUI();
      // Simulate sync delay
      setTimeout(() => {
        this.status = 'saved';
        this.updateStatusUI();
      }, 800);
    }
  },

  async syncNow() {
    // TODO: Implement actual cloud sync (e.g., chrome.storage.sync, Supabase, etc.)
    this.status = 'syncing';
    this.updateStatusUI();
    setTimeout(() => {
      this.status = 'saved';
      this.updateStatusUI();
    }, 1000);
  },

  exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `simtab_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  },

  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if ((importedData.groups || importedData.spaces) && importedData.settings) {
          appData = normalizeAppData(importedData);
          this.saveData();
          applySettings();
          render();
        } else {
          alert('无效的备份文件！');
        }
      } catch (err) {
        alert('解析文件失败！');
      }
    };
    reader.readAsText(file);
  }
};

// ==========================================
