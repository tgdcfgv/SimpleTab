<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="SimTab Logo">
</p>

<h1 align="center">SimTab · 极简新标签页</h1>

<p align="center">
  <b>简洁、高密度、可自定的新标签页与常用网站导航</b><br>
  多空间分组 · 智能联想搜索 · 全局快捷收藏 · 本地优先与 Supabase 云端独立同步
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue.svg?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Web-blueviolet.svg?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Version-1.0.5-emerald.svg?style=flat-square" alt="Version 1.0.5">
  <img src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-orange.svg?style=flat-square" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/Backend-Supabase-green.svg?style=flat-square" alt="Supabase">
</p>

---

## 📖 项目简介

**SimTab** 是一款专为 Chromium 内核浏览器打造的极简新标签页扩展，同时可作为静态网页（PWA / Web App）独立部署与访问。

告别杂乱冗余的新闻流、天气推送和营销推广，SimTab 回归新标签页的本质：**快速直达、高效整理、轻快专注**。你可以通过工作区空间、自定义分组和卡片整理常用链接，通过智能联想搜索和全局快捷键随时随地收藏网页，并在需要时通过 Supabase 实现跨设备无缝同步。

---

## ✨ 核心特性

### 🗂️ 1. 多空间与多分组架构
- **空间隔离**：为“工作”、“学习”、“生活”或不同项目创建独立空间，点击程序坞或按下 `Tab` 键即可快速切换。
- **自定义分组**：空间内自由新建分组，可单独调节每个分组一行显示的卡片数量（或设为自动响应式）。
- **流畅拖拽排序**：支持分组标题与网站卡片的拖拽重排，随心定制专属导航布局。

### 🔍 2. 跨空间智能搜索与 Bing 联想建议
- **全局快捷筛选**：在顶部搜索框输入关键字，即时查找所有已保存的网站。
- **Bing 实时搜索建议**：输入时自动获取 Bing 联想推荐，支持输入防抖、请求中止、键盘 `↑` / `↓` 快速选择及 `Tab` 键自动补全。
- **多引擎一键搜索**：未选择本地快捷方式时，按回车直接使用配置的搜索引擎（Google / Bing）查询互联网。

### ⚡ 3. 随时随地快捷收藏（Quick Capture）
- **多入口触发**：在任意网页通过快捷键 `Alt + Shift + S`、浏览器工具栏图标或右键菜单“保存当前页面到 SimTab”。
- **自动解析与去重**：自动抓取当前标签页标题与网址，支持手动选择目标空间和分组，重复添加时自动提示避免冗余。
- **会话级草稿保护**：基于 `chrome.storage.session` 暂存收藏草稿，网络抖动或误关弹窗后仍可重试，绝不丢失数据。

### 🌐 4. 丰富网站库与全能书签导入
- **精选网站库**：内置开发、设计、效率、资讯等多分类热门服务，支持勾选批量快速添加。
- **按需读取浏览器收藏夹**：使用扩展版可一键申请读取 Edge / Chrome 原生书签，按需选择并添加（只读权限，绝不擅自修改或删除浏览器原始收藏夹）。
- **标准 HTML 书签导入**：网页版与扩展版均支持导入各浏览器导出的书签 HTML 文件，自动生成分组。

### 🎨 5. 原生设计系统与外观定制
- **macOS 风格设计语言**：全新设计的 System Settings 风格控制面板，操作直观优雅。
- **色彩模式**：支持浅色模式（Light）、深色模式（Dark）及跟随操作系统自动切换。
- **WCAG 智能高对比度**：自定义强调色（Accent Color），系统自动基于相对亮度算法计算文本前景色（白字/黑字），确保阅读对比度合规。
- **本地壁纸存储**：支持上传高清壁纸（基于 IndexedDB Blob 存储，最高 10MB），壁纸仅保留在当前设备本地，隐私安全且不占用云端带宽。
- **模块化程序坞（Dock）**：支持设置在底部、左侧或右侧显示；账户、设置、添加分组、添加网站、网站库、空间列表等每个按钮均可独立开启或隐藏。

### ☁️ 6. 本地优先与安全云端同步
- **开箱即用（访客模式）**：无需注册或登录即可直接使用，所有分组与偏好保存在浏览器本地（扩展使用 `chrome.storage.local`，网页使用 `localStorage`）。
- **邮箱验证码免密登录 (Email OTP)**：输入邮箱接收 8 位验证码即可完成注册与登录，告别传统密码遗忘与泄露风险。
- **本地与云端严格隔离**：未登录数据与云端数据物理隔离，登录后无缝切换云端视图，退出登录即刻还原本地内容，两端数据绝不会被未经许可自动覆盖。
- **账户缓存快速加载**：网站和扩展先显示当前账户上次同步成功的内容，再在后台检查云端版本；版本相同时不重绘，后台读取不会覆盖正在编辑或保存的内容。缓存与未登录本地内容隔离，退出或切换账户时清理。
- **云端故障恢复**：有账户缓存时继续显示缓存并提示同步失败；没有缓存时恢复此浏览器的本地内容，点击同步可重试。缓存仅保存同步成功的快照，离线修改在同步成功前仍需保持页面打开或导出备份。
- **主动数据复制**：登录后可在账户面板中主动将本地内容复制至云端，替换账户内容并保留本地副本。
- **并发乐观锁（Revision Lock）**：多标签页或跨设备同时编辑时具备版本校验机制，防止意外冲突覆盖。
- **全量 JSON 备份与还原**：支持一键导出完整的配置备份（含本地壁纸），支持随时恢复到任意浏览器。

---

### 程序坞排列与网站快捷方式

把分组中的网站或浏览器中的网页链接拖到程序坞，即可直接显示网站图标。原分组中的网站会保留，相同网址不会重复添加。把程序坞图标拖回任意分组，即可移出程序坞并放入该分组；分组里已有同一网址时不会重复创建。图标支持点击打开，右键或聚焦后按 Delete 可移除；快捷方式会自动保存，并在所有空间中显示。程序坞位于底部且空间不足时，可以横向滚动。

程序坞中的网站、空间、账户、设置等按钮均支持浏览器原生拖拽，可自由混合排列，顺序会自动保存。拖动时显示“拖出程序坞移除”，移到外侧后显示“松开移除”；按 Esc 取消。空间和操作按钮移除后只会隐藏，可以在设置的程序坞选项中恢复。移除设置按钮后，页面仍保留独立的设置入口。

## 多语言

在「设置 → 常规 → 语言」中选择简体中文（`zh_CN`）、English（`en`）、繁體中文（`zh_TW`）或日本語（`ja`）。首次使用跟随浏览器语言，其他语言回退到英语。更改会先保存，再重新载入页面；语言偏好保存在当前浏览器，已有网站、分组名称和搜索选择不会被自动翻译或替换。

- 新用户在简中环境默认使用 Bing，英语、繁中、日语默认使用 Google；日语默认快捷引擎包含 Yahoo! Japan。DuckDuckGo、Naver 等也可在常规设置中启用。
- 非简中环境使用全球站点预设与推荐库，日语加入日本本地站点。搜索建议携带对应地区，百度建议回退仅用于简中。
- 界面词条统一维护在 `_locales/*/messages.json`。四份目录使用相同键，`description` 保存简中源文案，`message` 保存译文；动态参数使用 `{0}`、`{1}` 等占位符。`js/i18n.js` 在插入用户内容前完成翻译，避免翻译用户自定义名称。
- 页面由 `js/bootstrap.js` 先加载语言目录再初始化。网站构建和扩展打包均包含 `_locales`。
- 当前仓库的 `js/organize.js` 实现批量编辑，没有 AI 分类请求或提示词。后续接入 AI 时，应把 `getLocale()` 的语言传给服务端，并要求生成对应语言的分组名。

验证：`node --test tests/*.test.mjs`；启动本地预览后运行 `node tests/i18n-browser.cjs`（需要 Playwright 与 Chrome）。浏览器测试覆盖四种语言启动、动态编辑器文案、切换语言后的数据保留及扩展语言偏好。

---

## ⌨️ 常用快捷键

| 快捷键 | 功能说明 | 适用场景 |
| --- | --- | --- |
| `Alt + Shift + S` | 快速保存当前网页到 SimTab | 浏览任何网页时（浏览器扩展） |
| `Tab` | 快速循环切换工作区空间 | 新标签页主界面 |
| `↑` / `↓` | 在搜索联想词或已保存的网站列表中导航 | 聚焦顶部搜索框时 |
| `Tab` | 采纳当前高亮的搜索联想词到输入框 | 聚焦顶部搜索框时 |
| `Enter` | 打开高亮网站，或通过搜索引擎搜索网络 | 聚焦顶部搜索框时 |
| `Esc` | 关闭搜索联想面板 / 关闭当前模态弹窗 | 全局 |

> **提示**：若 `Alt + Shift + S` 快捷键与其他软件冲突，可在浏览器的快捷键管理页（Chrome: `chrome://extensions/shortcuts`，Edge: `edge://extensions/shortcuts`）中自定义修改。

---

## 📦 安装与使用指南

### 方式一：从 Microsoft Edge 商店安装（推荐）

SimTab 已在 [Microsoft Edge 加载项商店](https://microsoftedge.microsoft.com/addons/detail/ahlkdagbagbfcjiapfndghdbjjahdpep) 上线。点击「获取」即可安装，后续版本由浏览器自动更新。

### 方式二：从 GitHub Releases 手动安装

1. 前往仓库右侧的 [Releases](https://github.com/tgdcfgv/SimpleTab/releases) 页面；
2. 下载最新版本的打包文件 `SimTab-*.zip` 并解压到你电脑上的固定文件夹中；
3. 打开浏览器的扩展管理页面：
   - **Chrome**: 地址栏访问 `chrome://extensions/`
   - **Edge**: 地址栏访问 `edge://extensions/`
4. 打开页面右上角的 **“开发者模式”**（Developer Mode）；
5. 点击 **“加载已解压的扩展程序”**（Load unpacked）；
6. 选择解压出的 SimTab 文件夹即可完成安装。

> ⚠️ **注意**：安装后请勿删除或移动解压后的文件夹，否则浏览器将无法继续加载该扩展。

### 方式三：从源码加载运行

```bash
# 1. 克隆本仓库到本地
git clone https://github.com/tgdcfgv/SimpleTab.git

# 2. 进入浏览器扩展管理页面，开启“开发者模式”，选择克隆的仓库根目录加载
```

本项目采用纯原生 HTML5、CSS3、ES Modules 构建，**无需 Node.js 安装或繁琐的打包构建流程**，即改即生效。

### 方式四：部署为在线网站（Cloudflare Pages）

SimTab 可完全作为独立纯静态站点运行，支持通过 Cloudflare Pages 实现与 GitHub 仓库的代码推送自动构建：

1. 将仓库 Fork 或推送至你自己的 GitHub；
2. 登录 Cloudflare 控制台，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**；
3. 选取本仓库，填写以下构建配置：

| 设置项 | 推荐值 | 说明 |
| :--- | :--- | :--- |
| **生产分支 (Production branch)** | `main` | 主分支触发自动部署 |
| **框架预设 (Framework preset)** | `None` | 原生静态站点 |
| **构建命令 (Build command)** | `sh scripts/build-pages.sh` | 自动输出静态资源并配置重定向 |
| **构建输出目录 (Build output directory)** | `.pages-output` | 生成的发布文件目录 |
| **根目录 (Root directory)** | 留空（项目根路径） | |

4. 部署完成后，可通过 Cloudflare 提供的 `*.pages.dev` 访问，也可以在 **Custom domains** 中绑定你的自定义域名；
5. 本地预览构建产物：
   ```bash
   sh scripts/build-pages.sh
   python3 -m http.server 8080 --directory .pages-output
   # 浏览器访问 http://localhost:8080
   ```

---

## 📂 项目结构

```text
SimpleTab/
├── manifest.json              # 浏览器扩展清单文件 (Manifest V3)
├── newtab.html                # 新标签页核心视图
├── install.html               # 扩展安装指引页面
├── privacy.html               # 官方隐私政策条款
├── css/                       # 样式目录
│   ├── base.css               # 全局样式变量与基础重置
│   ├── responsive.css         # 响应式栅格与移动端适配
│   ├── info.css               # 文档页（安装/隐私）专用样式
│   └── components/            # 模块化组件样式（Dock、表单、弹窗、设置等）
├── js/                        # 前端核心业务逻辑（ES Modules）
│   ├── main.js                # 应用入口与生命周期调度
│   ├── data.js                # 数据规范化、默认模版与存储管理
│   ├── cloud.js               # Supabase 交互与云端同步层
│   ├── auth-modal.js          # 极简邮箱验证码登录与注册模态框
│   ├── search.js              # 搜索建议、Bing 联想与键盘导航
│   ├── capture.js             # 快捷收藏弹窗交互
│   ├── capture-model.js       # 快捷收藏数据校验与去重
│   ├── background.js          # MV3 Service Worker（后台快捷键与右键菜单）
│   ├── wallpaper.js           # 基于 IndexedDB 的本地壁纸管理器
│   ├── catalog.js             # 预设热门网站库目录
│   └── local-store.js         # 本地跨标签页数据防冲突并发保护
├── scripts/                   # 自动化运维与构建脚本
│   ├── build-pages.sh         # Cloudflare Pages 静态产物打包脚本
│   └── package-extension.py   # 浏览器商店无杂质安装包打包脚本
├── store-assets/              # 扩展商店上架物料与说明规范
├── supabase/                  # 后端配置与数据库资产
│   ├── account-data.sql       # 数据库表结构与 RLS 行级安全策略
│   ├── EMAIL-OTP.md           # 邮箱验证码与 SMTP (Resend) 配置说明
│   └── templates/             # 品牌化邮件验证码 HTML 模板
└── tests/                     # 自动化单元测试与 Playwright 浏览器回归用例
```

---

## ⚙️ 后端配置与云同步搭建 (Supabase)

如果你希望自行部署或配置独立的 Supabase 后端，可参考以下简易步骤：

1. **新建 Supabase 项目**：在 [Supabase](https://supabase.com/) 中创建新项目（默认推荐新加坡节点）；
2. **初始化数据表与 RLS 权限**：
   在 Supabase 控制台的 **SQL Editor** 中执行 [`supabase/account-data.sql`](supabase/account-data.sql)；
   - 创建 `public.account_data` 数据表；
   - 启用 Row Level Security (RLS) 策略，确保每个用户仅能读写自己的私有数据。
3. **配置邮箱验证码 (Email OTP)**：
   - 进入 **Authentication** -> **SMTP Settings**，配置自定义 SMTP（如接入 [Resend](https://resend.com/)，详见 [`supabase/EMAIL-OTP.md`](supabase/EMAIL-OTP.md)）；
   - 在 **Email Templates** 中，将 **Confirm sign up** 与 **Magic link / OTP** 替换为包含 `{{ .Token }}` 的验证码模板；
   - 用户登录时将直接收到 8 位数字验证码，无需复杂的确认链接跳转。
4. **前端配置替换**：
   在 [`js/cloud.js`](js/cloud.js) 中填入你自己的 Supabase URL 及 Publishable `anon` 密钥。

---

## 🔒 隐私声明与权限透明度

SimTab 严格遵循“最小必要权限”与“隐私优先”原则，不加载任何远程执行代码：

| 权限名称 | 用途说明 | 必要性 |
| :--- | :--- | :--- |
| `storage` | 用于在本地存储未登录时的分组、网站、排版与外观偏好 | 核心功能，必须 |
| `favicon` | 通过浏览器原生安全接口拉取网站图标 | 核心展示，必须 |
| `activeTab` | 仅在用户主动触发收藏快捷键或右键时，临时读取当前页面标题与 URL | 快捷收藏，必须 |
| `contextMenus`| 在网页右键菜单中提供“保存当前页面到 SimTab”入口 | 快捷收藏，必须 |
| `bookmarks` | **按需申请**。仅在用户点击“导入我的收藏夹”时向浏览器发起申请，绝不修改或删除原书签 | 可选权限 |

- **无网页爬虫**：后台 Service Worker 绝不会扫描、爬取或读取你的浏览历史和网页正文内容。
- **壁纸本地留存**：上传的高清自定义壁纸仅以 Blob 形式保存在当前浏览器的 IndexedDB 中，不会随云端同步上传至服务器。
- 详细条款请参阅 [`privacy.html`](privacy.html)。

---

## 🧪 开发与测试

### 本地测试与代码规范

运行 Node.js 原生测试套件（需 Node.js 18+）：

```bash
# 运行核心数据与云同步逻辑单元测试
node --test tests/*.test.mjs
```

### 浏览器端自动化回归测试（Playwright）

针对登录弹窗、多标签页并发存储及快捷收藏功能的端到端测试：

```bash
# 1. 在本地启动轻量静态服务器
python3 -m http.server 8091 --bind 127.0.0.1

# 2. 运行自动化端到端测试
node tests/auth-browser.cjs
node tests/capture-browser.cjs
node tests/controls-browser.cjs
node tests/settings-browser.cjs
node tests/cloud-cache-browser.cjs
node tests/site-icons-browser.cjs
node tests/search-engine-focus-browser.cjs
node tests/sync-fallback-browser.cjs
node tests/i18n-browser.cjs
```

### 扩展打包

通过官方打包脚本生成符合 Chromium 扩展商店规范的发布包（自动滤除个人数据与非必要文件）：

```bash
python3 scripts/package-extension.py
# 输出产物位于 dist/SimTab-1.0.5-edge.zip
```

---

## 📝 版本更新记录

### v1.0.5 · 2026-10-29

- 新增简体中文、英语、繁体中文与日语，可在「设置 → 常规」下拉切换；首次使用跟随浏览器语言，保留已有网站、分组及搜索选择。
- 按语言提供默认搜索引擎、全球站点预设及推荐库；海外语言默认 Google，日语加入 Yahoo! Japan，并提供 DuckDuckGo、Naver 等选项；搜索建议跟随地区。
- 程序坞支持从分组或网页拖入网站快捷方式，支持拖回分组、混合排列网站／空间／操作按钮、拖出移除及隐藏按钮后的设置入口。
- 批量编辑支持单击选择、双击编辑、桌面原生拖拽和触屏长按整理；统一新增网站／分组入口，支持暂存新空间、多选跨空间移动、删除撤销及未保存更改保护。
- 重整设置导航与控件布局，优化弹窗内菜单、下拉滚动条、分组投放提示、窄屏布局和键盘焦点。
- 云端内容先读取当前账户缓存，再后台检查更新；云端故障时可继续显示缓存或回退本地内容，避免覆盖正在编辑的数据。
- 网站图标与失败结果跨标签页缓存，保留加载中的旧图标，识别浏览器占位图和透明空图，减少反复探测与闪烁。
- 账户新增邮箱验证注销入口；保留验证码免密登录，改进 Emoji 头像直接输入、替换及资料弹窗布局。
- 修复切换搜索引擎丢失输入焦点、分组列溢出、长标题遮挡和网站图标与文字间距。
- 更新 Edge 商店正式安装入口、安装说明与发布资料。

### v1.0.4

- 设置重组为常规、外观、布局、账户、数据、关于六类，默认进入常规，支持默认搜索和分组列数设置。
- 批量编辑采用左侧空间／列／分组导航与右侧网站明细的双栏布局；空空间自动隐藏，空间仅支持折叠与展开。
- 支持网站名称与网址行内编辑、分组改名与新建、多选跨组／跨空间拖放、排序、删除及撤销，并保留网站图标和安全网址校验。
- 程序坞原编辑空间按钮统一进入管理弹窗，移除重复入口和旧空间编辑窗口。
- 提供 Edge、Chrome、Safari 迁移教程，书签 HTML 导入后先预览整理，再统一保存；保留 JSON 备份与恢复。
- 修复分组拖动背景变黑，优化紧凑布局、图标操作、深色可读性、键盘焦点和窄屏显示。

### v1.0.2

- 移除按钮上浮，优化分组、空间和搜索栏交互，统一关闭按钮显示。
- 设置分区使用灰色悬停背景，其他控件悬停边框跟随强调色，“更改即时生效”采用胶囊显示。
- 网站图标加载失败或超时时使用本地生成的彩色字母／汉字徽标，覆盖网页列表、折叠分组、搜索和网站库。
- 更新隐私与安装说明，统一版本号并补充 Chrome、Edge 及其他 Chromium 浏览器说明。

### v1.0.1

- 统一设置界面之外的悬停效果，使用灰色背景并移除悬停边框、阴影和缩放。
- 文本输入框激活后仅加深背景，移除聚焦边框、光圈与阴影。
- Emoji 头像与程序坞图标统一尺寸并居中对齐。
- 优化设置布局、账户资料编辑和相关提示文案。

### v1.0.0

- 🎨 **全新设计系统**：统一 Button、Input、Select、Switch、Menu、Dialog 等控件规范，重做 macOS 风格设置中心，优化高对比度配色逻辑。
- 🔍 **搜索增强**：集成 Bing 实时联想建议、输入防抖与 Tab 补全能力，支持键盘方向键顺畅定位。
- ⚡ **快速收藏 (Quick Capture)**：新增工具栏图标、网页右键上下文菜单及全局 `Alt+Shift+S` 快捷键，支持会话级草稿暂存。
- 📧 **邮箱验证码登录**：重构认证体验，采用 6 位邮件数字验证码替代传统密码登录，无感完成注册与登录。
- 🔒 **本地与云端架构解耦**：彻底隔离未登录本地数据与云端 Supabase 独立数据，支持多端防冲突乐观锁。
- 🖼️ **壁纸与性能优化**：重构壁纸系统为 IndexedDB Blob 本地独立存储，降低主配置体积并保护用户隐私。

---

## 🤝 反馈与参与贡献

欢迎提交 Issue 或 Pull Request 来帮助 SimTab 变得更好！

在提交 Issue 时，请尽可能提供以下上下文信息：
1. 浏览器类型及版本（如 Chrome 120 / Edge 120）；
2. SimTab 的安装形式（扩展版 / 网页版）；
3. 详细的复现步骤与控制台错误截图（如有）。

---

## 📄 许可证

Copyright © 2026 SimTab Authors.

保留所有权利。当前尚未指定公共开源许可证；未经许可，请勿用于商业闭源再分发。
