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
      { name: "ChatGPT", url: "https://chatgpt.com", section: "对话与助手" },
      { name: "Claude", url: "https://claude.ai", section: "对话与助手" },
      { name: "Gemini", url: "https://gemini.google.com", section: "对话与助手" },
      { name: "Copilot", url: "https://copilot.microsoft.com", section: "对话与助手" },
      { name: "Grok", url: "https://grok.com", section: "对话与助手" },
      { name: "DeepSeek", url: "https://chat.deepseek.com", section: "对话与助手" },
      { name: "Kimi", url: "https://kimi.moonshot.cn", section: "对话与助手" },
      { name: "豆包", url: "https://www.doubao.com", section: "对话与助手" },
      { name: "通义千问", url: "https://tongyi.aliyun.com", section: "对话与助手" },
      { name: "腾讯元宝", url: "https://yuanbao.tencent.com", section: "对话与助手" },
      { name: "智谱清言", url: "https://chatglm.cn", section: "对话与助手" },
      { name: "海螺 AI", url: "https://hailuoai.com", section: "对话与助手" },
      { name: "Mistral", url: "https://chat.mistral.ai", section: "对话与助手" },
      { name: "Poe", url: "https://poe.com", section: "对话与助手" },
      { name: "腾讯Workbuddy", url: "https://www.workbuddy.cn", section: "AI 办公与智能体" },
      { name: "千问办公", url: "https://qwenwork.cn", section: "AI 办公与智能体" },
      { name: "豆包工作", url: "https://www.doubao.com/work", section: "AI 办公与智能体" },
      { name: "Google Notebook", url: "https://notebooklm.google.com", section: "AI 办公与智能体" },
      { name: "Meta Muse", url: "https://www.meta.ai", section: "AI 办公与智能体" },
      { name: "Perplexity", url: "https://www.perplexity.ai", section: "AI 办公与智能体" },
      { name: "Manus", url: "https://manus.im", section: "AI 办公与智能体" },
      { name: "Coze 扣子", url: "https://www.coze.cn", section: "AI 办公与智能体" },
      { name: "Cursor", url: "https://www.cursor.com", section: "AI 编程与开发" },
      { name: "Bolt.new", url: "https://bolt.new", section: "AI 编程与开发" },
      { name: "v0 by Vercel", url: "https://v0.dev", section: "AI 编程与开发" },
      { name: "Google AI Studio", url: "https://aistudio.google.com", section: "AI 编程与开发" },
      { name: "Hugging Face", url: "https://huggingface.co", section: "AI 编程与开发" },
      { name: "LMSYS Arena", url: "https://lmarena.ai", section: "AI 编程与开发" },
      { name: "Artificial Analysis", url: "https://www.artificial-analysis.com", section: "AI 编程与开发" },
      { name: "Midjourney", url: "https://www.midjourney.com", section: "视觉与音频生成" },
      { name: "Kling AI 可灵", url: "https://klingai.com", section: "视觉与音频生成" },
      { name: "Runway", url: "https://runwayml.com", section: "视觉与音频生成" },
      { name: "Luma Dream Machine", url: "https://lumalabs.ai", section: "视觉与音频生成" },
      { name: "ElevenLabs", url: "https://elevenlabs.io", section: "视觉与音频生成" },
      { name: "Suno", url: "https://suno.com", section: "视觉与音频生成" },
      { name: "Udio", url: "https://www.udio.com", section: "视觉与音频生成" }
    ]
  },
  {
    id: "productivity",
    name: "效率与办公",
    links: [
      { name: "Notion", url: "https://www.notion.so", section: "文档与笔记" },
      { name: "腾讯文档", url: "https://docs.qq.com", section: "文档与笔记" },
      { name: "语雀", url: "https://www.yuque.com", section: "文档与笔记" },
      { name: "石墨文档", url: "https://shimo.im", section: "文档与笔记" },
      { name: "幕布", url: "https://mubu.com", section: "文档与笔记" },
      { name: "飞书", url: "https://www.feishu.cn", section: "团队协作与沟通" },
      { name: "钉钉", url: "https://www.dingtalk.com", section: "团队协作与沟通" },
      { name: "企业微信", url: "https://work.weixin.qq.com", section: "团队协作与沟通" },
      { name: "Slack", url: "https://slack.com", section: "团队协作与沟通" },
      { name: "Linear", url: "https://linear.app", section: "任务与项目管理" },
      { name: "Trello", url: "https://trello.com", section: "任务与项目管理" },
      { name: "Todoist", url: "https://todoist.com", section: "任务与项目管理" },
      { name: "ProcessOn", url: "https://www.processon.com", section: "白板与流程图" },
      { name: "Miro", url: "https://miro.com", section: "白板与流程图" },
      { name: "Excalidraw", url: "https://excalidraw.com", section: "白板与流程图" },
      { name: "Google 日历", url: "https://calendar.google.com", section: "邮箱与日程" },
      { name: "Gmail", url: "https://mail.google.com", section: "邮箱与日程" },
      { name: "Outlook", url: "https://outlook.live.com", section: "邮箱与日程" },
      { name: "163 网易邮箱", url: "https://mail.163.com", section: "邮箱与日程" },
      { name: "QQ 邮箱", url: "https://mail.qq.com", section: "邮箱与日程" },
      { name: "DeepL 翻译", url: "https://www.deepl.com", section: "办公实用工具" },
      { name: "iLovePDF", url: "https://www.ilovepdf.com", section: "办公实用工具" }
    ]
  },
  {
    id: "dev",
    name: "开发与技术",
    links: [
      { name: "GitHub", url: "https://github.com", section: "代码托管与协作" },
      { name: "GitLab", url: "https://gitlab.com", section: "代码托管与协作" },
      { name: "Gitee 码云", url: "https://gitee.com", section: "代码托管与协作" },
      { name: "Vercel", url: "https://vercel.com", section: "云服务与部署" },
      { name: "Supabase", url: "https://supabase.com", section: "云服务与部署" },
      { name: "Cloudflare", url: "https://www.cloudflare.com", section: "云服务与部署" },
      { name: "Railway", url: "https://railway.app", section: "云服务与部署" },
      { name: "Neon", url: "https://neon.tech", section: "云服务与部署" },
      { name: "Docker Hub", url: "https://hub.docker.com", section: "云服务与部署" },
      { name: "AWS", url: "https://aws.amazon.com", section: "云服务与部署" },
      { name: "Google Cloud", url: "https://cloud.google.com", section: "云服务与部署" },
      { name: "Azure", url: "https://azure.microsoft.com", section: "云服务与部署" },
      { name: "DigitalOcean", url: "https://www.digitalocean.com", section: "云服务与部署" },
      { name: "Postman", url: "https://www.postman.com", section: "开发工具与文档" },
      { name: "MDN Web Docs", url: "https://developer.mozilla.org", section: "开发工具与文档" },
      { name: "npm", url: "https://www.npmjs.com", section: "开发工具与文档" },
      { name: "Can I use", url: "https://caniuse.com", section: "开发工具与文档" },
      { name: "CodePen", url: "https://codepen.io", section: "开发工具与文档" },
      { name: "Replit", url: "https://replit.com", section: "开发工具与文档" },
      { name: "Speedtest", url: "https://www.speedtest.net", section: "开发工具与文档" },
      { name: "Stack Overflow", url: "https://stackoverflow.com", section: "技术社区与题库" },
      { name: "V2EX", url: "https://www.v2ex.com", section: "技术社区与题库" },
      { name: "Linux.do", url: "https://linux.do", section: "技术社区与题库" },
      { name: "掘金", url: "https://juejin.cn", section: "技术社区与题库" },
      { name: "LeetCode 力扣", url: "https://leetcode.cn", section: "技术社区与题库" }
    ]
  },
  {
    id: "design",
    name: "设计与灵感",
    links: [
      { name: "Figma", url: "https://www.figma.com", section: "设计工具与原型" },
      { name: "Framer", url: "https://www.framer.com", section: "设计工具与原型" },
      { name: "Canva", url: "https://www.canva.com", section: "设计工具与原型" },
      { name: "稿定设计", url: "https://www.gaoding.com", section: "设计工具与原型" },
      { name: "Adobe Express", url: "https://www.adobe.com/express", section: "设计工具与原型" },
      { name: "Eagle", url: "https://cn.eagle.cool", section: "设计工具与原型" },
      { name: "Mobbin", url: "https://mobbin.com", section: "灵感与作品社区" },
      { name: "Dribbble", url: "https://dribbble.com", section: "灵感与作品社区" },
      { name: "Behance", url: "https://www.behance.net", section: "灵感与作品社区" },
      { name: "Pinterest", url: "https://www.pinterest.com", section: "灵感与作品社区" },
      { name: "Awwwards", url: "https://www.awwwards.com", section: "灵感与作品社区" },
      { name: "花瓣网", url: "https://huaban.com", section: "灵感与作品社区" },
      { name: "站酷", url: "https://www.zcool.com.cn", section: "灵感与作品社区" }
    ]
  },
  {
    id: "assets",
    name: "图片与素材",
    links: [
      { name: "Unsplash", url: "https://unsplash.com", section: "高清图库与视频" },
      { name: "Pexels", url: "https://www.pexels.com", section: "高清图库与视频" },
      { name: "Pixabay", url: "https://pixabay.com", section: "高清图库与视频" },
      { name: "Freepik", url: "https://www.freepik.com", section: "高清图库与视频" },
      { name: "Mixkit", url: "https://mixkit.co", section: "高清图库与视频" },
      { name: "Iconfont", url: "https://www.iconfont.cn", section: "图标、字体与动效" },
      { name: "Lucide Icons", url: "https://lucide.dev", section: "图标、字体与动效" },
      { name: "Font Awesome", url: "https://fontawesome.com", section: "图标、字体与动效" },
      { name: "Google Fonts", url: "https://fonts.google.com", section: "图标、字体与动效" },
      { name: "SVGL", url: "https://svgl.app", section: "图标、字体与动效" },
      { name: "LottieFiles", url: "https://lottiefiles.com", section: "图标、字体与动效" },
      { name: "Coolors", url: "https://coolors.co", section: "配色与图像处理" },
      { name: "TinyPNG", url: "https://tinypng.com", section: "配色与图像处理" },
      { name: "Remove.bg", url: "https://www.remove.bg", section: "配色与图像处理" }
    ]
  },
  {
    id: "community",
    name: "社交与社区",
    links: [
      { name: "哔哩哔哩", url: "https://www.bilibili.com", section: "热门社区" },
      { name: "知乎", url: "https://www.zhihu.com", section: "热门社区" },
      { name: "小红书", url: "https://www.xiaohongshu.com", section: "热门社区" },
      { name: "微博", url: "https://weibo.com", section: "热门社区" },
      { name: "豆瓣", url: "https://www.douban.com", section: "热门社区" },
      { name: "即刻", url: "https://web.okjike.com", section: "热门社区" },
      { name: "X", url: "https://x.com", section: "国际社交与论坛" },
      { name: "Reddit", url: "https://www.reddit.com", section: "国际社交与论坛" },
      { name: "Threads", url: "https://www.threads.net", section: "国际社交与论坛" },
      { name: "Instagram", url: "https://www.instagram.com", section: "国际社交与论坛" },
      { name: "YouTube", url: "https://www.youtube.com", section: "国际社交与论坛" },
      { name: "Product Hunt", url: "https://www.producthunt.com", section: "国际社交与论坛" },
      { name: "Medium", url: "https://medium.com", section: "国际社交与论坛" },
      { name: "Telegram Web", url: "https://web.telegram.org", section: "即时通讯与频道" },
      { name: "Discord", url: "https://discord.com", section: "即时通讯与频道" }
    ]
  },
  {
    id: "music-video",
    name: "影音与娱乐",
    links: [
      { name: "Spotify", url: "https://open.spotify.com", section: "音乐与播客" },
      { name: "Apple Music", url: "https://music.apple.com", section: "音乐与播客" },
      { name: "网易云音乐", url: "https://music.163.com", section: "音乐与播客" },
      { name: "QQ 音乐", url: "https://y.qq.com", section: "音乐与播客" },
      { name: "YouTube Music", url: "https://music.youtube.com", section: "音乐与播客" },
      { name: "SoundCloud", url: "https://soundcloud.com", section: "音乐与播客" },
      { name: "Bandcamp", url: "https://bandcamp.com", section: "音乐与播客" },
      { name: "Netflix", url: "https://www.netflix.com", section: "视频、影视与创作" },
      { name: "爱奇艺", url: "https://www.iqiyi.com", section: "视频、影视与创作" },
      { name: "腾讯视频", url: "https://v.qq.com", section: "视频、影视与创作" },
      { name: "豆瓣电影", url: "https://movie.douban.com", section: "视频、影视与创作" },
      { name: "IMDb", url: "https://www.imdb.com", section: "视频、影视与创作" },
      { name: "CapCut", url: "https://www.capcut.com", section: "视频、影视与创作" },
      { name: "Steam", url: "https://store.steampowered.com", section: "游戏与直播" },
      { name: "Twitch", url: "https://www.twitch.tv", section: "游戏与直播" },
      { name: "Pitchfork", url: "https://pitchfork.com", section: "音乐与文化媒体" },
      { name: "Rolling Stone", url: "https://www.rollingstone.com", section: "音乐与文化媒体" },
      { name: "NME", url: "https://www.nme.com", section: "音乐与文化媒体" }
    ]
  },
  {
    id: "news",
    name: "科技与资讯",
    links: [
      { name: "少数派", url: "https://sspai.com", section: "科技与数码" },
      { name: "36氪", url: "https://36kr.com", section: "科技与数码" },
      { name: "IT之家", url: "https://www.ithome.com", section: "科技与数码" },
      { name: "Hacker News", url: "https://news.ycombinator.com", section: "科技与数码" },
      { name: "TechCrunch", url: "https://techcrunch.com", section: "科技与数码" },
      { name: "The Verge", url: "https://www.theverge.com", section: "科技与数码" },
      { name: "Wired", url: "https://www.wired.com", section: "科技与数码" },
      { name: "财新网", url: "https://www.caixin.com", section: "财经与商业" },
      { name: "华尔街日报", url: "https://www.wsj.com", section: "财经与商业" },
      { name: "Bloomberg", url: "https://www.bloomberg.com", section: "财经与商业" },
      { name: "雪球", url: "https://xueqiu.com", section: "财经与商业" },
      { name: "澎湃新闻", url: "https://www.thepaper.cn", section: "综合新闻与国际媒体" },
      { name: "Reuters", url: "https://www.reuters.com", section: "综合新闻与国际媒体" },
      { name: "BBC", url: "https://www.bbc.com", section: "综合新闻与国际媒体" },
      { name: "The Guardian", url: "https://www.theguardian.com", section: "综合新闻与国际媒体" },
      { name: "纽约时报", url: "https://www.nytimes.com", section: "综合新闻与国际媒体" },
      { name: "AP News", url: "https://apnews.com", section: "综合新闻与国际媒体" }
    ]
  },
  {
    id: "study",
    name: "学习与学术",
    links: [
      { name: "Google Scholar", url: "https://scholar.google.com", section: "论文检索与文献" },
      { name: "arXiv", url: "https://arxiv.org", section: "论文检索与文献" },
      { name: "Connected Papers", url: "https://www.connectedpapers.com", section: "论文检索与文献" },
      { name: "Semantic Scholar", url: "https://www.semanticscholar.org", section: "论文检索与文献" },
      { name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov", section: "论文检索与文献" },
      { name: "CNKI 中国知网", url: "https://www.cnki.net", section: "论文检索与文献" },
      { name: "万方数据", url: "https://www.wanfangdata.com.cn", section: "论文检索与文献" },
      { name: "维普网", url: "https://www.cqvip.com", section: "论文检索与文献" },
      { name: "Zotero", url: "https://www.zotero.org", section: "论文检索与文献" },
      { name: "Coursera", url: "https://www.coursera.org", section: "在线课程与数据科学" },
      { name: "edX", url: "https://www.edx.org", section: "在线课程与数据科学" },
      { name: "中国大学 MOOC", url: "https://www.icourse163.org", section: "在线课程与数据科学" },
      { name: "Kaggle", url: "https://www.kaggle.com", section: "在线课程与数据科学" },
      { name: "维基百科", url: "https://zh.wikipedia.org", section: "百科、计算与电子书" },
      { name: "Wolfram Alpha", url: "https://www.wolframalpha.com", section: "百科、计算与电子书" },
      { name: "Z-Library", url: "https://zlibrary.se", section: "百科、计算与电子书" },
      { name: "MagazineLib", url: "https://magazinelib.com", section: "百科、计算与电子书" }
    ]
  },
  {
    id: "cloud",
    name: "云盘与存储",
    links: [
      { name: "百度网盘", url: "https://pan.baidu.com", section: "国内网盘与快传" },
      { name: "阿里云盘", url: "https://www.alipan.com", section: "国内网盘与快传" },
      { name: "夸克网盘", url: "https://pan.quark.cn", section: "国内网盘与快传" },
      { name: "坚果云", url: "https://www.jianguoyun.com", section: "国内网盘与快传" },
      { name: "123云盘", url: "https://www.123pan.com", section: "国内网盘与快传" },
      { name: "文叔叔", url: "https://www.wenshushu.cn", section: "国内网盘与快传" },
      { name: "Google Drive", url: "https://drive.google.com", section: "国际云端存储" },
      { name: "OneDrive", url: "https://onedrive.live.com", section: "国际云端存储" },
      { name: "iCloud", url: "https://www.icloud.com", section: "国际云端存储" },
      { name: "Dropbox", url: "https://www.dropbox.com", section: "国际云端存储" },
      { name: "Proton Drive", url: "https://proton.me/drive", section: "国际云端存储" }
    ]
  },
  {
    id: "shopping",
    name: "购物与生活",
    links: [
      { name: "淘宝", url: "https://www.taobao.com", section: "综合电商与海淘" },
      { name: "京东", url: "https://www.jd.com", section: "综合电商与海淘" },
      { name: "拼多多", url: "https://www.pinduoduo.com", section: "综合电商与海淘" },
      { name: "天猫", url: "https://www.tmall.com", section: "综合电商与海淘" },
      { name: "亚马逊", url: "https://www.amazon.com", section: "综合电商与海淘" },
      { name: "什么值得买", url: "https://www.smzdm.com", section: "导购、潮流与二手" },
      { name: "闲鱼", url: "https://2.taobao.com", section: "导购、潮流与二手" },
      { name: "得物", url: "https://www.dewu.com", section: "导购、潮流与二手" },
      { name: "大众点评", url: "https://www.dianping.com", section: "本地生活与外卖" },
      { name: "美团", url: "https://www.meituan.com", section: "本地生活与外卖" },
      { name: "饿了么", url: "https://www.ele.me", section: "本地生活与外卖" },
      { name: "盒马", url: "https://www.freshippo.com", section: "本地生活与外卖" }
    ]
  },
  {
    id: "maps-travel",
    name: "地图与出行",
    links: [
      { name: "高德地图", url: "https://www.amap.com", section: "地图与打车" },
      { name: "百度地图", url: "https://map.baidu.com", section: "地图与打车" },
      { name: "Google Maps", url: "https://maps.google.com", section: "地图与打车" },
      { name: "腾讯地图", url: "https://map.qq.com", section: "地图与打车" },
      { name: "滴滴出行", url: "https://www.didiglobal.com", section: "地图与打车" },
      { name: "12306", url: "https://www.12306.cn", section: "机酒预订与票务" },
      { name: "携程旅行", url: "https://www.ctrip.com", section: "机酒预订与票务" },
      { name: "飞猪", url: "https://www.fliggy.com", section: "机酒预订与票务" },
      { name: "Trip.com", url: "https://www.trip.com", section: "机酒预订与票务" },
      { name: "Booking", url: "https://www.booking.com", section: "机酒预订与票务" },
      { name: "Airbnb", url: "https://www.airbnb.com", section: "机酒预订与票务" },
      { name: "Flightradar24", url: "https://www.flightradar24.com", section: "航班与行程服务" },
      { name: "航旅纵横", url: "https://www.umetrip.com", section: "航班与行程服务" }
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
  add('shopping', [
    ['Amazon', language === 'ja' ? 'https://www.amazon.co.jp' : 'https://www.amazon.com', '综合电商与海淘'],
    ['eBay', 'https://www.ebay.com', '综合电商与海淘'],
    ['Etsy', 'https://www.etsy.com', '综合电商与海淘']
  ]);
  add('study', [
    ['Wikipedia', language === 'ja' ? 'https://ja.wikipedia.org' : language === 'zh_TW' ? 'https://zh.wikipedia.org/zh-tw/' : 'https://en.wikipedia.org', '百科、计算与电子书']
  ]);
  if (language === 'ja') {
    add('community', [
      ['Yahoo! Japan', 'https://www.yahoo.co.jp', '国际社交与论坛'],
      ['note', 'https://note.com', '国际社交与论坛']
    ]);
    add('shopping', [
      ['Rakuten', 'https://www.rakuten.co.jp', '综合电商与海淘']
    ]);
  }
  return international;
}
export const linkStore = catalogForLocale();
