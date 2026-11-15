import { getLocale, t } from './i18n.js';
const chineseLinkStore = [
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
      { name: "ChatGPT", url: "https://chatgpt.com", section: "对话助手" },
      { name: "Claude", url: "https://claude.ai", section: "对话助手" },
      { name: "Gemini", url: "https://gemini.google.com", section: "对话助手" },
      { name: "Copilot", url: "https://copilot.microsoft.com", section: "对话助手" },
      { name: "Grok", url: "https://grok.com", section: "对话助手" },
      { name: "DeepSeek", url: "https://chat.deepseek.com", section: "对话助手" },
      { name: "Kimi", url: "https://kimi.moonshot.cn", section: "对话助手" },
      { name: "豆包", url: "https://www.doubao.com", section: "对话助手" },
      { name: "通义千问", url: "https://tongyi.aliyun.com", section: "对话助手" },
      { name: "腾讯元宝", url: "https://yuanbao.tencent.com", section: "对话助手" },
      { name: "智谱清言", url: "https://chatglm.cn", section: "对话助手" },
      { name: "海螺 AI", url: "https://hailuoai.com", section: "对话助手" },
      { name: "Mistral", url: "https://chat.mistral.ai", section: "对话助手" },
      { name: "Poe", url: "https://poe.com", section: "对话助手" },
      { name: "腾讯Workbuddy", url: "https://www.workbuddy.cn", section: "智能办公" },
      { name: "千问办公", url: "https://qwenwork.cn", section: "智能办公" },
      { name: "豆包工作", url: "https://www.doubao.com/work", section: "智能办公" },
      { name: "Google Notebook", url: "https://notebooklm.google.com", section: "智能办公" },
      { name: "Meta Muse", url: "https://www.meta.ai", section: "智能办公" },
      { name: "Perplexity", url: "https://www.perplexity.ai", section: "智能办公" },
      { name: "Manus", url: "https://manus.im", section: "智能办公" },
      { name: "Coze 扣子", url: "https://www.coze.cn", section: "智能办公" },
      { name: "Cursor", url: "https://www.cursor.com", section: "AI 编程" },
      { name: "Bolt.new", url: "https://bolt.new", section: "AI 编程" },
      { name: "v0 by Vercel", url: "https://v0.dev", section: "AI 编程" },
      { name: "Google AI Studio", url: "https://aistudio.google.com", section: "AI 编程" },
      { name: "Hugging Face", url: "https://huggingface.co", section: "AI 编程" },
      { name: "LMSYS Arena", url: "https://lmarena.ai", section: "AI 编程" },
      { name: "Artificial Analysis", url: "https://www.artificial-analysis.com", section: "AI 编程" },
      { name: "Midjourney", url: "https://www.midjourney.com", section: "创作生成" },
      { name: "Kling AI 可灵", url: "https://klingai.com", section: "创作生成" },
      { name: "Runway", url: "https://runwayml.com", section: "创作生成" },
      { name: "Luma Dream Machine", url: "https://lumalabs.ai", section: "创作生成" },
      { name: "ElevenLabs", url: "https://elevenlabs.io", section: "创作生成" },
      { name: "Suno", url: "https://suno.com", section: "创作生成" },
      { name: "Udio", url: "https://www.udio.com", section: "创作生成" }
    ]
  },
  {
    id: "productivity",
    name: "效率办公",
    links: [
      { name: "Notion", url: "https://www.notion.so", section: "文档笔记" },
      { name: "腾讯文档", url: "https://docs.qq.com", section: "文档笔记" },
      { name: "语雀", url: "https://www.yuque.com", section: "文档笔记" },
      { name: "石墨文档", url: "https://shimo.im", section: "文档笔记" },
      { name: "幕布", url: "https://mubu.com", section: "文档笔记" },
      { name: "飞书", url: "https://www.feishu.cn", section: "团队协作" },
      { name: "钉钉", url: "https://www.dingtalk.com", section: "团队协作" },
      { name: "企业微信", url: "https://work.weixin.qq.com", section: "团队协作" },
      { name: "Slack", url: "https://slack.com", section: "团队协作" },
      { name: "Linear", url: "https://linear.app", section: "项目管理" },
      { name: "Trello", url: "https://trello.com", section: "项目管理" },
      { name: "Todoist", url: "https://todoist.com", section: "项目管理" },
      { name: "ProcessOn", url: "https://www.processon.com", section: "思维白板" },
      { name: "Miro", url: "https://miro.com", section: "思维白板" },
      { name: "Excalidraw", url: "https://excalidraw.com", section: "思维白板" },
      { name: "Google 日历", url: "https://calendar.google.com", section: "邮箱日程" },
      { name: "Gmail", url: "https://mail.google.com", section: "邮箱日程" },
      { name: "Outlook", url: "https://outlook.live.com", section: "邮箱日程" },
      { name: "163 网易邮箱", url: "https://mail.163.com", section: "邮箱日程" },
      { name: "QQ 邮箱", url: "https://mail.qq.com", section: "邮箱日程" },
      { name: "DeepL 翻译", url: "https://www.deepl.com", section: "办公工具" },
      { name: "iLovePDF", url: "https://www.ilovepdf.com", section: "办公工具" }
    ]
  },
  {
    id: "dev",
    name: "开发技术",
    links: [
      { name: "GitHub", url: "https://github.com", section: "代码托管" },
      { name: "GitLab", url: "https://gitlab.com", section: "代码托管" },
      { name: "Gitee 码云", url: "https://gitee.com", section: "代码托管" },
      { name: "Vercel", url: "https://vercel.com", section: "云端部署" },
      { name: "Supabase", url: "https://supabase.com", section: "云端部署" },
      { name: "Cloudflare", url: "https://www.cloudflare.com", section: "云端部署" },
      { name: "Railway", url: "https://railway.app", section: "云端部署" },
      { name: "Neon", url: "https://neon.tech", section: "云端部署" },
      { name: "Docker Hub", url: "https://hub.docker.com", section: "云端部署" },
      { name: "AWS", url: "https://aws.amazon.com", section: "云端部署" },
      { name: "Google Cloud", url: "https://cloud.google.com", section: "云端部署" },
      { name: "Azure", url: "https://azure.microsoft.com", section: "云端部署" },
      { name: "DigitalOcean", url: "https://www.digitalocean.com", section: "云端部署" },
      { name: "Postman", url: "https://www.postman.com", section: "开发工具" },
      { name: "MDN Web Docs", url: "https://developer.mozilla.org", section: "开发工具" },
      { name: "npm", url: "https://www.npmjs.com", section: "开发工具" },
      { name: "Can I use", url: "https://caniuse.com", section: "开发工具" },
      { name: "CodePen", url: "https://codepen.io", section: "开发工具" },
      { name: "Replit", url: "https://replit.com", section: "开发工具" },
      { name: "Speedtest", url: "https://www.speedtest.net", section: "开发工具" },
      { name: "Stack Overflow", url: "https://stackoverflow.com", section: "技术社区" },
      { name: "V2EX", url: "https://www.v2ex.com", section: "技术社区" },
      { name: "Linux.do", url: "https://linux.do", section: "技术社区" },
      { name: "掘金", url: "https://juejin.cn", section: "技术社区" },
      { name: "LeetCode 力扣", url: "https://leetcode.cn", section: "技术社区" }
    ]
  },
  {
    id: "design",
    name: "设计创意",
    links: [
      { name: "Figma", url: "https://www.figma.com", section: "设计工具" },
      { name: "Framer", url: "https://www.framer.com", section: "设计工具" },
      { name: "Canva", url: "https://www.canva.com", section: "设计工具" },
      { name: "稿定设计", url: "https://www.gaoding.com", section: "设计工具" },
      { name: "Adobe Express", url: "https://www.adobe.com/express", section: "设计工具" },
      { name: "Eagle", url: "https://cn.eagle.cool", section: "设计工具" },
      { name: "Mobbin", url: "https://mobbin.com", section: "灵感社区" },
      { name: "Dribbble", url: "https://dribbble.com", section: "灵感社区" },
      { name: "Behance", url: "https://www.behance.net", section: "灵感社区" },
      { name: "Pinterest", url: "https://www.pinterest.com", section: "灵感社区" },
      { name: "Awwwards", url: "https://www.awwwards.com", section: "灵感社区" },
      { name: "花瓣网", url: "https://huaban.com", section: "灵感社区" },
      { name: "站酷", url: "https://www.zcool.com.cn", section: "灵感社区" }
    ]
  },
  {
    id: "assets",
    name: "图像素材",
    links: [
      { name: "Unsplash", url: "https://unsplash.com", section: "高清图库" },
      { name: "Pexels", url: "https://www.pexels.com", section: "高清图库" },
      { name: "Pixabay", url: "https://pixabay.com", section: "高清图库" },
      { name: "Freepik", url: "https://www.freepik.com", section: "高清图库" },
      { name: "Mixkit", url: "https://mixkit.co", section: "高清图库" },
      { name: "Iconfont", url: "https://www.iconfont.cn", section: "图标字体" },
      { name: "Lucide Icons", url: "https://lucide.dev", section: "图标字体" },
      { name: "Font Awesome", url: "https://fontawesome.com", section: "图标字体" },
      { name: "Google Fonts", url: "https://fonts.google.com", section: "图标字体" },
      { name: "SVGL", url: "https://svgl.app", section: "图标字体" },
      { name: "LottieFiles", url: "https://lottiefiles.com", section: "图标字体" },
      { name: "Coolors", url: "https://coolors.co", section: "图像处理" },
      { name: "TinyPNG", url: "https://tinypng.com", section: "图像处理" },
      { name: "Remove.bg", url: "https://www.remove.bg", section: "图像处理" }
    ]
  },
  {
    id: "community",
    name: "社交社区",
    links: [
      { name: "哔哩哔哩", url: "https://www.bilibili.com", section: "综合社区" },
      { name: "知乎", url: "https://www.zhihu.com", section: "综合社区" },
      { name: "豆瓣", url: "https://www.douban.com", section: "综合社区" },
      { name: "Reddit", url: "https://www.reddit.com", section: "综合社区" },
      { name: "YouTube", url: "https://www.youtube.com", section: "综合社区" },
      { name: "Product Hunt", url: "https://www.producthunt.com", section: "综合社区" },
      { name: "Medium", url: "https://medium.com", section: "综合社区" },
      { name: "小红书", url: "https://www.xiaohongshu.com", section: "社交动态" },
      { name: "微博", url: "https://weibo.com", section: "社交动态" },
      { name: "即刻", url: "https://web.okjike.com", section: "社交动态" },
      { name: "X", url: "https://x.com", section: "社交动态" },
      { name: "Threads", url: "https://www.threads.net", section: "社交动态" },
      { name: "Instagram", url: "https://www.instagram.com", section: "社交动态" },
      { name: "Telegram Web", url: "https://web.telegram.org", section: "即时通讯" },
      { name: "Discord", url: "https://discord.com", section: "即时通讯" }
    ]
  },
  {
    id: "music-video",
    name: "影音娱乐",
    links: [
      { name: "Spotify", url: "https://open.spotify.com", section: "音乐播客" },
      { name: "Apple Music", url: "https://music.apple.com", section: "音乐播客" },
      { name: "网易云音乐", url: "https://music.163.com", section: "音乐播客" },
      { name: "QQ 音乐", url: "https://y.qq.com", section: "音乐播客" },
      { name: "YouTube Music", url: "https://music.youtube.com", section: "音乐播客" },
      { name: "SoundCloud", url: "https://soundcloud.com", section: "音乐播客" },
      { name: "Bandcamp", url: "https://bandcamp.com", section: "音乐播客" },
      { name: "Netflix", url: "https://www.netflix.com", section: "影视视频" },
      { name: "爱奇艺", url: "https://www.iqiyi.com", section: "影视视频" },
      { name: "腾讯视频", url: "https://v.qq.com", section: "影视视频" },
      { name: "豆瓣电影", url: "https://movie.douban.com", section: "影视视频" },
      { name: "IMDb", url: "https://www.imdb.com", section: "影视视频" },
      { name: "CapCut", url: "https://www.capcut.com", section: "影视视频" },
      { name: "Steam", url: "https://store.steampowered.com", section: "游戏直播" },
      { name: "Twitch", url: "https://www.twitch.tv", section: "游戏直播" },
      { name: "Pitchfork", url: "https://pitchfork.com", section: "文化媒体" },
      { name: "Rolling Stone", url: "https://www.rollingstone.com", section: "文化媒体" },
      { name: "NME", url: "https://www.nme.com", section: "文化媒体" }
    ]
  },
  {
    id: "news",
    name: "科技资讯",
    links: [
      { name: "少数派", url: "https://sspai.com", section: "科技数码" },
      { name: "36氪", url: "https://36kr.com", section: "科技数码" },
      { name: "IT之家", url: "https://www.ithome.com", section: "科技数码" },
      { name: "Hacker News", url: "https://news.ycombinator.com", section: "科技数码" },
      { name: "TechCrunch", url: "https://techcrunch.com", section: "科技数码" },
      { name: "The Verge", url: "https://www.theverge.com", section: "科技数码" },
      { name: "Wired", url: "https://www.wired.com", section: "科技数码" },
      { name: "财新网", url: "https://www.caixin.com", section: "商业财经" },
      { name: "华尔街日报", url: "https://www.wsj.com", section: "商业财经" },
      { name: "Bloomberg", url: "https://www.bloomberg.com", section: "商业财经" },
      { name: "雪球", url: "https://xueqiu.com", section: "商业财经" },
      { name: "澎湃新闻", url: "https://www.thepaper.cn", section: "新闻媒体" },
      { name: "Reuters", url: "https://www.reuters.com", section: "新闻媒体" },
      { name: "BBC", url: "https://www.bbc.com", section: "新闻媒体" },
      { name: "The Guardian", url: "https://www.theguardian.com", section: "新闻媒体" },
      { name: "纽约时报", url: "https://www.nytimes.com", section: "新闻媒体" },
      { name: "AP News", url: "https://apnews.com", section: "新闻媒体" }
    ]
  },
  {
    id: "study",
    name: "学术教育",
    links: [
      { name: "Google Scholar", url: "https://scholar.google.com", section: "学术文献" },
      { name: "arXiv", url: "https://arxiv.org", section: "学术文献" },
      { name: "Connected Papers", url: "https://www.connectedpapers.com", section: "学术文献" },
      { name: "Semantic Scholar", url: "https://www.semanticscholar.org", section: "学术文献" },
      { name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov", section: "学术文献" },
      { name: "CNKI 中国知网", url: "https://www.cnki.net", section: "学术文献" },
      { name: "万方数据", url: "https://www.wanfangdata.com.cn", section: "学术文献" },
      { name: "维普网", url: "https://www.cqvip.com", section: "学术文献" },
      { name: "Zotero", url: "https://www.zotero.org", section: "学术文献" },
      { name: "Coursera", url: "https://www.coursera.org", section: "在线课程" },
      { name: "edX", url: "https://www.edx.org", section: "在线课程" },
      { name: "中国大学 MOOC", url: "https://www.icourse163.org", section: "在线课程" },
      { name: "Kaggle", url: "https://www.kaggle.com", section: "在线课程" },
      { name: "维基百科", url: "https://zh.wikipedia.org", section: "知识百科" },
      { name: "Wolfram Alpha", url: "https://www.wolframalpha.com", section: "知识百科" },
      { name: "Z-Library", url: "https://zlibrary.se", section: "知识百科" },
      { name: "MagazineLib", url: "https://magazinelib.com", section: "知识百科" }
    ]
  },
  {
    id: "cloud",
    name: "云盘存储",
    links: [
      { name: "百度网盘", url: "https://pan.baidu.com", section: "云端网盘" },
      { name: "阿里云盘", url: "https://www.alipan.com", section: "云端网盘" },
      { name: "夸克网盘", url: "https://pan.quark.cn", section: "云端网盘" },
      { name: "123云盘", url: "https://www.123pan.com", section: "云端网盘" },
      { name: "Google Drive", url: "https://drive.google.com", section: "云端网盘" },
      { name: "OneDrive", url: "https://onedrive.live.com", section: "云端网盘" },
      { name: "iCloud", url: "https://www.icloud.com", section: "云端网盘" },
      { name: "Dropbox", url: "https://www.dropbox.com", section: "云端网盘" },
      { name: "Proton Drive", url: "https://proton.me/drive", section: "云端网盘" },
      { name: "坚果云", url: "https://www.jianguoyun.com", section: "同步快传" },
      { name: "文叔叔", url: "https://www.wenshushu.cn", section: "同步快传" }
    ]
  },
  {
    id: "shopping",
    name: "购物生活",
    links: [
      { name: "淘宝", url: "https://www.taobao.com", section: "综合电商" },
      { name: "京东", url: "https://www.jd.com", section: "综合电商" },
      { name: "拼多多", url: "https://www.pinduoduo.com", section: "综合电商" },
      { name: "天猫", url: "https://www.tmall.com", section: "综合电商" },
      { name: "亚马逊", url: "https://www.amazon.com", section: "综合电商" },
      { name: "什么值得买", url: "https://www.smzdm.com", section: "好物导购" },
      { name: "闲鱼", url: "https://2.taobao.com", section: "好物导购" },
      { name: "得物", url: "https://www.dewu.com", section: "好物导购" },
      { name: "大众点评", url: "https://www.dianping.com", section: "本地生活" },
      { name: "美团", url: "https://www.meituan.com", section: "本地生活" },
      { name: "饿了么", url: "https://www.ele.me", section: "本地生活" },
      { name: "盒马", url: "https://www.freshippo.com", section: "本地生活" }
    ]
  },
  {
    id: "maps-travel",
    name: "地图出行",
    links: [
      { name: "高德地图", url: "https://www.amap.com", section: "地图导航" },
      { name: "百度地图", url: "https://map.baidu.com", section: "地图导航" },
      { name: "Google Maps", url: "https://maps.google.com", section: "地图导航" },
      { name: "腾讯地图", url: "https://map.qq.com", section: "地图导航" },
      { name: "滴滴出行", url: "https://www.didiglobal.com", section: "地图导航" },
      { name: "12306", url: "https://www.12306.cn", section: "旅行预订" },
      { name: "携程旅行", url: "https://www.ctrip.com", section: "旅行预订" },
      { name: "飞猪", url: "https://www.fliggy.com", section: "旅行预订" },
      { name: "Trip.com", url: "https://www.trip.com", section: "旅行预订" },
      { name: "Booking", url: "https://www.booking.com", section: "旅行预订" },
      { name: "Airbnb", url: "https://www.airbnb.com", section: "旅行预订" },
      { name: "Flightradar24", url: "https://www.flightradar24.com", section: "航班出行" },
      { name: "航旅纵横", url: "https://www.umetrip.com", section: "航班出行" }
    ]
  }
];

// Keep domestic recommendations for Simplified Chinese; international profiles
// show global services without changing bookmarks already saved by the user.
export function catalogForLocale(language = getLocale()) {
  if (language === 'zh_CN') {
    return chineseLinkStore.map(category => ({
      ...category,
      name: t(category.name),
      links: category.links.map(link => ({
        ...link,
        ...(link.section ? { section: t(link.section) } : {})
      }))
    }));
  }
  const international = chineseLinkStore.map(category => ({
    ...category,
    name: t(category.name),
    links: category.links
      .filter(link => !/[\u3400-\u9fff]/.test(link.name))
      .map(link => ({
        ...link,
        ...(link.section ? { section: t(link.section) } : {})
      }))
  }));
  const add = (id, links) => {
    const category = international.find(item => item.id === id);
    for (const [name, url, section] of links) {
      if (!category.links.some(link => link.url === url)) {
        category.links.push({ name, url, ...(section ? { section: t(section) } : {}) });
      }
    }
  };
  const amazonUrls = {
    ja: 'https://www.amazon.co.jp',
    es: 'https://www.amazon.es',
    de: 'https://www.amazon.de',
    pt_BR: 'https://www.amazon.com.br',
    fr: 'https://www.amazon.fr'
  };
  const wikipediaUrls = {
    zh_TW: 'https://zh.wikipedia.org/zh-tw/',
    ja: 'https://ja.wikipedia.org',
    ko: 'https://ko.wikipedia.org',
    es: 'https://es.wikipedia.org',
    de: 'https://de.wikipedia.org',
    pt_BR: 'https://pt.wikipedia.org',
    fr: 'https://fr.wikipedia.org'
  };
  add('shopping', [
    ['Amazon', amazonUrls[language] || 'https://www.amazon.com', '综合电商'],
    ['eBay', 'https://www.ebay.com', '综合电商'],
    ['Etsy', 'https://www.etsy.com', '综合电商']
  ]);
  add('study', [
    ['Wikipedia', wikipediaUrls[language] || 'https://en.wikipedia.org', '知识百科']
  ]);
  if (language === 'ja') {
    add('community', [
      ['Yahoo! Japan', 'https://www.yahoo.co.jp', '综合社区'],
      ['note', 'https://note.com', '综合社区']
    ]);
    add('shopping', [
      ['Rakuten', 'https://www.rakuten.co.jp', '综合电商']
    ]);
  }
  return international;
}
export const linkStore = catalogForLocale();
