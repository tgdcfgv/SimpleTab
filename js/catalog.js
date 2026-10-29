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
      { name: "ChatGPT", url: "https://chatgpt.com" },
      { name: "Claude", url: "https://claude.ai" },
      { name: "Gemini", url: "https://gemini.google.com" },
      { name: "Copilot", url: "https://copilot.microsoft.com" },
      { name: "Grok", url: "https://grok.com" },
      { name: "Perplexity", url: "https://www.perplexity.ai" },
      { name: "DeepSeek", url: "https://chat.deepseek.com" },
      { name: "Kimi", url: "https://kimi.moonshot.cn" },
      { name: "豆包", url: "https://www.doubao.com" },
      { name: "通义千问", url: "https://tongyi.aliyun.com" },
      { name: "腾讯元宝", url: "https://yuanbao.tencent.com" },
      { name: "智谱清言", url: "https://chatglm.cn" },
      { name: "海螺 AI", url: "https://hailuoai.com" },
      { name: "Cursor", url: "https://www.cursor.com" },
      { name: "Bolt.new", url: "https://bolt.new" },
      { name: "v0 by Vercel", url: "https://v0.dev" },
      { name: "Manus", url: "https://manus.im" },
      { name: "Coze 扣子", url: "https://www.coze.cn" },
      { name: "Poe", url: "https://poe.com" },
      { name: "LMSYS Arena", url: "https://lmarena.ai" },
      { name: "Hugging Face", url: "https://huggingface.co" },
      { name: "Google AI Studio", url: "https://aistudio.google.com" },
      { name: "Artificial Analysis", url: "https://www.artificial-analysis.com" },
      { name: "Mistral", url: "https://chat.mistral.ai" },
      { name: "Midjourney", url: "https://www.midjourney.com" },
      { name: "Kling AI 可灵", url: "https://klingai.com" },
      { name: "Runway", url: "https://runwayml.com" },
      { name: "Luma Dream Machine", url: "https://lumalabs.ai" },
      { name: "ElevenLabs", url: "https://elevenlabs.io" },
      { name: "Suno", url: "https://suno.com" },
      { name: "Udio", url: "https://www.udio.com" }
    ]
  },
  {
    id: "productivity",
    name: "效率与办公",
    links: [
      { name: "Notion", url: "https://www.notion.so" },
      { name: "飞书", url: "https://www.feishu.cn" },
      { name: "钉钉", url: "https://www.dingtalk.com" },
      { name: "企业微信", url: "https://work.weixin.qq.com" },
      { name: "Slack", url: "https://slack.com" },
      { name: "Linear", url: "https://linear.app" },
      { name: "腾讯文档", url: "https://docs.qq.com" },
      { name: "语雀", url: "https://www.yuque.com" },
      { name: "石墨文档", url: "https://shimo.im" },
      { name: "幕布", url: "https://mubu.com" },
      { name: "Trello", url: "https://trello.com" },
      { name: "Todoist", url: "https://todoist.com" },
      { name: "ProcessOn", url: "https://www.processon.com" },
      { name: "Miro", url: "https://miro.com" },
      { name: "Excalidraw", url: "https://excalidraw.com" },
      { name: "DeepL 翻译", url: "https://www.deepl.com" },
      { name: "iLovePDF", url: "https://www.ilovepdf.com" },
      { name: "Google 日历", url: "https://calendar.google.com" },
      { name: "Gmail", url: "https://mail.google.com" },
      { name: "Outlook", url: "https://outlook.live.com" },
      { name: "163 网易邮箱", url: "https://mail.163.com" },
      { name: "QQ 邮箱", url: "https://mail.qq.com" }
    ]
  },
  {
    id: "dev",
    name: "开发与技术",
    links: [
      { name: "GitHub", url: "https://github.com" },
      { name: "GitLab", url: "https://gitlab.com" },
      { name: "Gitee 码云", url: "https://gitee.com" },
      { name: "Docker Hub", url: "https://hub.docker.com" },
      { name: "Postman", url: "https://www.postman.com" },
      { name: "MDN Web Docs", url: "https://developer.mozilla.org" },
      { name: "Stack Overflow", url: "https://stackoverflow.com" },
      { name: "V2EX", url: "https://www.v2ex.com" },
      { name: "Linux.do", url: "https://linux.do" },
      { name: "掘金", url: "https://juejin.cn" },
      { name: "npm", url: "https://www.npmjs.com" },
      { name: "LeetCode 力扣", url: "https://leetcode.cn" },
      { name: "Can I use", url: "https://caniuse.com" },
      { name: "CodePen", url: "https://codepen.io" },
      { name: "Replit", url: "https://replit.com" },
      { name: "Speedtest", url: "https://www.speedtest.net" },
      { name: "Vercel", url: "https://vercel.com" },
      { name: "Supabase", url: "https://supabase.com" },
      { name: "Cloudflare", url: "https://www.cloudflare.com" },
      { name: "Railway", url: "https://railway.app" },
      { name: "Neon", url: "https://neon.tech" },
      { name: "AWS", url: "https://aws.amazon.com" },
      { name: "Google Cloud", url: "https://cloud.google.com" },
      { name: "Azure", url: "https://azure.microsoft.com" },
      { name: "DigitalOcean", url: "https://www.digitalocean.com" }
    ]
  },
  {
    id: "design",
    name: "设计与灵感",
    links: [
      { name: "Figma", url: "https://www.figma.com" },
      { name: "Framer", url: "https://www.framer.com" },
      { name: "Mobbin", url: "https://mobbin.com" },
      { name: "Canva", url: "https://www.canva.com" },
      { name: "稿定设计", url: "https://www.gaoding.com" },
      { name: "Adobe Express", url: "https://www.adobe.com/express" },
      { name: "Eagle", url: "https://cn.eagle.cool" },
      { name: "Dribbble", url: "https://dribbble.com" },
      { name: "Behance", url: "https://www.behance.net" },
      { name: "Pinterest", url: "https://www.pinterest.com" },
      { name: "Awwwards", url: "https://www.awwwards.com" },
      { name: "花瓣网", url: "https://huaban.com" },
      { name: "站酷", url: "https://www.zcool.com.cn" }
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
      { name: "Mixkit", url: "https://mixkit.co" },
      { name: "TinyPNG", url: "https://tinypng.com" },
      { name: "Iconfont", url: "https://www.iconfont.cn" },
      { name: "Lucide Icons", url: "https://lucide.dev" },
      { name: "Font Awesome", url: "https://fontawesome.com" },
      { name: "Google Fonts", url: "https://fonts.google.com" },
      { name: "Coolors", url: "https://coolors.co" },
      { name: "SVGL", url: "https://svgl.app" },
      { name: "LottieFiles", url: "https://lottiefiles.com" },
      { name: "Remove.bg", url: "https://www.remove.bg" }
    ]
  },
  {
    id: "community",
    name: "社交与社区",
    links: [
      { name: "哔哩哔哩", url: "https://www.bilibili.com" },
      { name: "知乎", url: "https://www.zhihu.com" },
      { name: "小红书", url: "https://www.xiaohongshu.com" },
      { name: "微博", url: "https://weibo.com" },
      { name: "豆瓣", url: "https://www.douban.com" },
      { name: "即刻", url: "https://web.okjike.com" },
      { name: "Product Hunt", url: "https://www.producthunt.com" },
      { name: "X", url: "https://x.com" },
      { name: "Reddit", url: "https://www.reddit.com" },
      { name: "Threads", url: "https://www.threads.net" },
      { name: "Instagram", url: "https://www.instagram.com" },
      { name: "YouTube", url: "https://www.youtube.com" },
      { name: "Telegram Web", url: "https://web.telegram.org" },
      { name: "Discord", url: "https://discord.com" },
      { name: "Medium", url: "https://medium.com" }
    ]
  },
  {
    id: "music-video",
    name: "影音与娱乐",
    links: [
      { name: "Spotify", url: "https://open.spotify.com" },
      { name: "Apple Music", url: "https://music.apple.com" },
      { name: "网易云音乐", url: "https://music.163.com" },
      { name: "QQ 音乐", url: "https://y.qq.com" },
      { name: "YouTube Music", url: "https://music.youtube.com" },
      { name: "SoundCloud", url: "https://soundcloud.com" },
      { name: "Bandcamp", url: "https://bandcamp.com" },
      { name: "Steam", url: "https://store.steampowered.com" },
      { name: "Twitch", url: "https://www.twitch.tv" },
      { name: "Netflix", url: "https://www.netflix.com" },
      { name: "豆瓣电影", url: "https://movie.douban.com" },
      { name: "IMDb", url: "https://www.imdb.com" },
      { name: "爱奇艺", url: "https://www.iqiyi.com" },
      { name: "腾讯视频", url: "https://v.qq.com" },
      { name: "Pitchfork", url: "https://pitchfork.com" },
      { name: "Rolling Stone", url: "https://www.rollingstone.com" },
      { name: "NME", url: "https://www.nme.com" },
      { name: "CapCut", url: "https://www.capcut.com" }
    ]
  },
  {
    id: "news",
    name: "科技与资讯",
    links: [
      { name: "少数派", url: "https://sspai.com" },
      { name: "36氪", url: "https://36kr.com" },
      { name: "IT之家", url: "https://www.ithome.com" },
      { name: "Hacker News", url: "https://news.ycombinator.com" },
      { name: "TechCrunch", url: "https://techcrunch.com" },
      { name: "The Verge", url: "https://www.theverge.com" },
      { name: "Wired", url: "https://www.wired.com" },
      { name: "财新网", url: "https://www.caixin.com" },
      { name: "华尔街日报", url: "https://www.wsj.com" },
      { name: "Bloomberg", url: "https://www.bloomberg.com" },
      { name: "雪球", url: "https://xueqiu.com" },
      { name: "澎湃新闻", url: "https://www.thepaper.cn" },
      { name: "Reuters", url: "https://www.reuters.com" },
      { name: "BBC", url: "https://www.bbc.com" },
      { name: "The Guardian", url: "https://www.theguardian.com" },
      { name: "纽约时报", url: "https://www.nytimes.com" },
      { name: "AP News", url: "https://apnews.com" }
    ]
  },
  {
    id: "study",
    name: "学习与学术",
    links: [
      { name: "Google Scholar", url: "https://scholar.google.com" },
      { name: "arXiv", url: "https://arxiv.org" },
      { name: "Connected Papers", url: "https://www.connectedpapers.com" },
      { name: "Semantic Scholar", url: "https://www.semanticscholar.org" },
      { name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov" },
      { name: "CNKI 中国知网", url: "https://www.cnki.net" },
      { name: "万方数据", url: "https://www.wanfangdata.com.cn" },
      { name: "维普网", url: "https://www.cqvip.com" },
      { name: "Zotero", url: "https://www.zotero.org" },
      { name: "Wolfram Alpha", url: "https://www.wolframalpha.com" },
      { name: "维基百科", url: "https://zh.wikipedia.org" },
      { name: "Kaggle", url: "https://www.kaggle.com" },
      { name: "Coursera", url: "https://www.coursera.org" },
      { name: "edX", url: "https://www.edx.org" },
      { name: "中国大学 MOOC", url: "https://www.icourse163.org" },
      { name: "Z-Library", url: "https://zlibrary.se" },
      { name: "MagazineLib", url: "https://magazinelib.com" }
    ]
  },
  {
    id: "cloud",
    name: "云盘与存储",
    links: [
      { name: "百度网盘", url: "https://pan.baidu.com" },
      { name: "阿里云盘", url: "https://www.alipan.com" },
      { name: "夸克网盘", url: "https://pan.quark.cn" },
      { name: "坚果云", url: "https://www.jianguoyun.com" },
      { name: "123云盘", url: "https://www.123pan.com" },
      { name: "文叔叔", url: "https://www.wenshushu.cn" },
      { name: "Google Drive", url: "https://drive.google.com" },
      { name: "OneDrive", url: "https://onedrive.live.com" },
      { name: "iCloud", url: "https://www.icloud.com" },
      { name: "Dropbox", url: "https://www.dropbox.com" },
      { name: "Proton Drive", url: "https://proton.me/drive" }
    ]
  },
  {
    id: "shopping",
    name: "购物与生活",
    links: [
      { name: "淘宝", url: "https://www.taobao.com" },
      { name: "京东", url: "https://www.jd.com" },
      { name: "拼多多", url: "https://www.pinduoduo.com" },
      { name: "天猫", url: "https://www.tmall.com" },
      { name: "亚马逊", url: "https://www.amazon.com" },
      { name: "什么值得买", url: "https://www.smzdm.com" },
      { name: "闲鱼", url: "https://2.taobao.com" },
      { name: "大众点评", url: "https://www.dianping.com" },
      { name: "美团", url: "https://www.meituan.com" },
      { name: "饿了么", url: "https://www.ele.me" },
      { name: "盒马", url: "https://www.freshippo.com" },
      { name: "得物", url: "https://www.dewu.com" }
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
      { name: "12306", url: "https://www.12306.cn" },
      { name: "携程旅行", url: "https://www.ctrip.com" },
      { name: "飞猪", url: "https://www.fliggy.com" },
      { name: "Trip.com", url: "https://www.trip.com" },
      { name: "Booking", url: "https://www.booking.com" },
      { name: "Airbnb", url: "https://www.airbnb.com" },
      { name: "Flightradar24", url: "https://www.flightradar24.com" },
      { name: "航旅纵横", url: "https://www.umetrip.com" }
    ]
  }
];

// Keep domestic recommendations for Simplified Chinese; international profiles
// show global services without changing bookmarks already saved by the user.
export function catalogForLocale(language = getLocale()) {
  if (language === 'zh_CN') return chineseLinkStore.map(category => ({ ...category, name: t(category.name) }));
  const international = chineseLinkStore.map(category => ({ ...category, name: t(category.name),
    links: category.links.filter(link => !/[\u3400-\u9fff]/.test(link.name)) }));
  const add = (id, links) => {
    const category = international.find(item => item.id === id);
    for (const [name, url] of links) if (!category.links.some(link => link.url === url)) category.links.push({ name, url });
  };
  add('shopping', [['Amazon', language === 'ja' ? 'https://www.amazon.co.jp' : 'https://www.amazon.com'], ['eBay', 'https://www.ebay.com'], ['Etsy', 'https://www.etsy.com']]);
  add('study', [['Wikipedia', language === 'ja' ? 'https://ja.wikipedia.org' : language === 'zh_TW' ? 'https://zh.wikipedia.org/zh-tw/' : 'https://en.wikipedia.org']]);
  if (language === 'ja') {
    add('community', [['Yahoo! Japan', 'https://www.yahoo.co.jp'], ['note', 'https://note.com']]);
    add('shopping', [['Rakuten', 'https://www.rakuten.co.jp']]);
  }
  return international;
}
export const linkStore = catalogForLocale();
