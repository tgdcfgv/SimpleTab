# SimTab

一个简洁、高密度、可自定义的浏览器新标签页扩展。

SimTab 用空间、分组和网站卡片整理常用链接，并提供搜索、拖拽排序、浏览器书签导入、主题设置及云端同步及 JSON 备份等功能。项目基于 Manifest V3 开发，适用于 Chrome、Microsoft Edge 等 Chromium 浏览器。

## 功能特点

- 多空间管理，可为工作、学习和生活创建独立空间
- 网站分组与自定义每行显示数量
- 拖拽调整分组及网站顺序
- 搜索已保存的网站，或使用选定的搜索引擎直接搜索
- 添加、编辑和删除自定义网站
- 从热门网站库快速添加常用服务
- 按需读取浏览器书签并添加到 SimTab
- 浅色、深色及跟随系统主题
- 自定义壁纸、强调色和显示效果（上传壁纸仅保存在当前浏览器）
- 自定义程序坞按钮及显示方式
- 使用 JSON 文件导入、导出网站和设置（不含本机上传的壁纸）
- 响应式布局，适配不同尺寸的浏览器窗口

## 安装

### 从 GitHub Release 安装

1. 打开本仓库右侧的 **Releases** 页面。
2. 下载最新版本的 `SimTab-*.zip`。
3. 将 ZIP 文件解压到一个固定目录。
4. 在 Chrome 中打开 `chrome://extensions/`，或在 Edge 中打开 `edge://extensions/`。
5. 开启页面右上角的 **开发者模式**。
6. 点击 **加载已解压的扩展程序**。
7. 选择刚才解压的目录。

安装完成后，打开一个新标签页即可使用 SimTab。

> 请勿在安装后删除或移动解压目录，否则浏览器可能无法继续加载扩展。

### 从源码安装

```bash
git clone https://github.com/tgdcfgv/SimpleTab.git
```

然后在浏览器扩展管理页面开启开发者模式，并选择仓库根目录进行加载。

## 发布为网站（Cloudflare Pages + GitHub）

此项目也能作为普通网站使用。Cloudflare Pages 连接 GitHub 后，每次向生产分支推送代码都会自动构建并发布。

1. 将网页源码推送至 GitHub 仓库。
2. 在 Cloudflare 控制台进入 **Workers & Pages**，创建 **Pages** 项目并选择连接 Git 仓库。
3. 选择 `tgdcfgv/SimpleTab`，填写以下设置：

| 设置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | `None` |
| 构建命令 | `sh scripts/build-pages.sh` |
| 构建输出目录 | `.pages-output` |
| 根目录 | 留空（仓库根目录） |

4. 部署成功后，先通过 Cloudflare 提供的 `*.pages.dev` 地址验证页面。
5. 在该项目的 **Custom domains → Set up a domain** 中添加自己的域名。已在 Cloudflare 管理的域名按提示确认 DNS；由其他服务商管理的子域名，按提示添加指向项目 `*.pages.dev` 地址的 CNAME。使用根域名时，需将域名的名称服务器接入 Cloudflare。

务必先在 Pages 中添加自定义域名，再配置 DNS。以后修改 `newtab.html`、`css/` 或 `js/` 并推送到 `main`，即可触发自动发布。

仓库中的 `scripts/build-pages.sh` 还会生成旧入口跳转和响应头。将该脚本推送到 GitHub 后，可将构建命令改为 `sh scripts/build-pages.sh`。

本地验证网站：

```bash
sh scripts/build-pages.sh
python3 -m http.server 8080 --directory .pages-output
```

打开 `http://localhost:8080`。构建只复制网页资源并将 `newtab.html` 输出为 `index.html`，不会发布扩展 ZIP 或仓库文件。

网页版和扩展版登录同一邮箱账户后，通过 Supabase 读取同一份云端数据。未登录时直接使用浏览器本地内容；登录后显示独立的云端内容，退出后恢复本地内容。需要复制时，可在“我的账户 → 将本地内容复制到云端”中主动操作，本地内容仍会保留。普通网站不能直接读取浏览器书签；此功能需使用扩展版。图标抓取可能受目标网站跨域限制影响。

参考：[Cloudflare 静态网站部署](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

## 日常使用

- 点击程序坞中的“添加分组”或“添加网站”创建内容。
- 拖动分组标题或网站卡片可以调整顺序。
- 在搜索框中输入关键词可查找已保存的网站；按回车可使用当前搜索引擎搜索。
- 点击“网站库”可从预设分类中批量添加常用网站。
- 在“设置 → 账户与同步”中创建 JSON 备份或恢复已有数据。
- 浏览器书签权限只会在使用对应功能时申请。

## 数据与隐私

SimTab 无需登录即可使用：未登录的空间、分组、网站及外观设置保存在当前浏览器（扩展使用 chrome.storage.local，网页使用 localStorage）。登录后切换为 Supabase 云端数据库（新加坡）中的独立账户内容，云端内容不会写入本地内容。退出登录恢复原本的本地内容。两份内容不会自动上传、合并或互相覆盖。云端未同步的更改只暂存在页面内存中；数据库使用 RLS 将数据限制为当前账户可访问。

扩展通过浏览器 favicon 接口显示网站图标；网页版通过图标服务获取网站主机名对应的图标。自定义远程图片会请求图片提供方，应用不抓取目标网页正文。详见隐私政策。

导出的 JSON 文件可能包含用户保存的网站地址和自定义配置，请妥善保管。

## 项目结构

```text
SimTab/
├── manifest.json       # 扩展清单
├── newtab.html         # 新标签页界面
├── css/                # 页面样式
├── js/                 # 功能模块
└── dist/               # 本地打包产物
```

## 开发

本项目使用原生 HTML、CSS 和 JavaScript，不需要安装依赖或执行构建命令。

修改代码后，在浏览器的扩展管理页面点击“重新加载”，再刷新新标签页即可查看效果。

提交正式版本前，请同步提高 `manifest.json` 中的 `version`，并确保 ZIP 文件根目录直接包含 `manifest.json`。

## 兼容性

- Google Chrome：Manifest V3
- Microsoft Edge：Chromium / Manifest V3
- 其他 Chromium 浏览器：可以尝试手动加载，具体兼容性取决于浏览器对扩展 API 的支持

## 反馈与贡献

欢迎通过 GitHub Issues 提交问题或功能建议。提交问题时，建议附上：

- 浏览器名称及版本
- SimTab 版本
- 问题复现步骤
- 必要的截图或控制台错误信息

## License

本项目暂未添加开源许可证。在许可证确定前，代码版权归项目作者所有。

## SimTab 2.1.0 上架准备

新增扩展安装入口、HTML 书签导入、隐私政策和图标；移除所有网站访问权限及网页抓取代理。

执行 `python3 scripts/package-extension.py` 生成 Edge ZIP。商店介绍和权限说明见 `store-assets/edge-submission.md`。

部署新版时将 Cloudflare 构建命令设为 `sh scripts/build-pages.sh`，输出目录保持 `.pages-output`，以同时发布图标、安装说明和隐私政策。

## Supabase 账户与同步（2.2.2）

- 项目：`zyttspnlrdzjosnitijb`，配置位于 `js/cloud.js`，客户端仅包含 publishable key。
- 登录方式：邮箱和密码。注册后验证邮箱；也可将邮件中的验证链接粘贴到账户与同步面板完成验证。
- 公开注册前需在 Supabase Auth 配置自己的 SMTP。默认邮件服务限制收件人和发送频率，详情见 [SMTP 文档](https://supabase.com/docs/guides/auth/auth-smtp)。不要关闭邮箱验证绕过邮件配置。
- 数据表：`public.account_data`，主键 `user_id` 关联 Auth 用户；RLS 限制用户只可操作自己的记录。
- 每次保存提交完整账户配置，使用 `revision` 乐观锁。其他设备同时修改时会停止覆盖；先导出未保存的更改，再读取云端版本并重新导入需要的内容。
- 页面启动、窗口重新获得焦点时读取云端；本机编辑自动上传，底部状态按钮可手动同步或重试。
- 未登录直接使用本地内容，兼容旧版本地数据；登录和退出切换内容来源。手动复制会替换当前云端内容，但始终保留浏览器本地内容。
- 部署 SQL 参考 `supabase/account-data.sql`（已通过 Supabase MCP 应用到上述项目）。
- 本地检查：`node --test tests/*.test.mjs`。

登录入口位于程序坞设置按钮左侧，以人像图标显示，直接打开“设置 → 账户与同步”中的云端同步区。每次主动登录成功后选择“用云端内容覆盖当前页面”或“保留当前页面并保存到云端”；未选择前不读取或写入账户配置，刷新后仍需选择。已完成选择的会话刷新后直接使用云端内容。两种选择都保留浏览器本地副本。

## 上线前重构：第一阶段

- `js/data.js` 负责默认配置与数据归一化；`js/catalog.js` 独立维护热门网站目录；`js/urls.js` 统一网址校验。
- JSON 导入、云端恢复和浏览器书签仅接受 HTTP/HTTPS 网站；非法协议被过滤。表单添加网站时也使用相同规则。
- `js/wallpaper.js` 将上传图片保存为 IndexedDB Blob，限制为 10 MB 的 PNG/JPEG/GIF/WebP/AVIF。上传壁纸属于当前浏览器的外观偏好，不随登录切换，不上传、不随 JSON 导出；其他设备需重新选择图片。旧版内嵌壁纸先写入独立存储，再移除配置中的图片数据；迁移失败保留原始存储并停止保存，修复存储权限后刷新重试。云端旧记录将在下一次成功保存时去除内嵌壁纸。
- 搜索覆盖所有空间；默认回车使用搜索引擎，方向键显式选择已保存网站，Escape 收起结果。
- 列数随可用宽度变化，保留分组拖拽；三列时兼容旧版列位置。
- 浏览器回归：先运行 `python3 -m http.server 8091 --bind 127.0.0.1`，再使用安装了 Playwright 与 Chrome 的环境运行 `node tests/cloud-browser.cjs` 和 `node tests/refactor-browser.cjs`。回归使用临时浏览器和模拟云端接口，不访问真实账户。

## 上线前重构：第二阶段

浏览网页时点击扩展工具栏图标，或选择页面右键菜单“保存当前页面到 SimTab”，即可打开新标签页中的保存弹窗。默认快捷键为 `Alt+Shift+S`，可在浏览器扩展快捷键管理中修改；若被占用，需手动分配。

- 自动填写名称和网址，选择空间和分组后保存；同一分组已有相同网址时不重复添加。
- 沿用当前本地／云端状态。尚未完成登录内容选择时，先完成原有选择流程，再显示收藏弹窗。失败后保留草稿与当前页面的未保存内容，重试不会重复添加。
- 后台仅收集你主动选择页面的标题和网址；不抓取正文。草稿存入 `chrome.storage.session`，30 分钟后失效、后续收藏时清理；保存或取消时清理，失败草稿可保留以便重试，关闭浏览器会清除。
- 本地保存使用共享锁与原始快照比对。旧标签页会拒绝覆盖新内容；先导出未保存更改，再刷新处理。没有未保存内容时，窗口重新获得焦点会读取最新本地内容。
- 需要 Chrome/Edge 102 或以上版本。新增 `activeTab` 与 `contextMenus` 权限，保留已有的 Supabase 专用域名权限。
- `js/background.js` 管理入口和草稿，`js/capture.js` 处理保存弹窗，`js/capture-model.js` 负责校验和去重，`js/local-store.js` 负责多标签页保存保护。
- 安装 Playwright Chromium 后运行 `node tests/capture-browser.cjs`，可通过 `SIMTAB_CHROMIUM_PATH` 指定支持加载未打包扩展的 Chromium。测试使用临时用户配置、真实 MV3 扩展和模拟云端接口。

后续阶段：跨空间移动与撤销、触摸拖拽、云端冲突合并与实时更新、Vite/TypeScript 迁移及其余弹窗模块拆分。

## 2.4.1 发布记录

新增 Bing 搜索联想建议与自动补全支持（带输入防抖、请求中断、Tab 键补全及键盘快速导航）；优化扩展 host_permissions 与打包规范。

## 2.4.0 发布记录

建立全套 Design System（统一 Button、Input、Select、Switch、Menu、Dialog 与共享 Token）；重做 Settings 为 macOS System Settings 风格对齐表单，优先展示 Account 身份与明确的 Sync 状态，独立备份恢复区域并精简 Statistics；重做颜色与深色模式，解耦 Accent，加入 WCAG 相对亮度自动白字/黑字判断并修复按钮对比度；应用商店正式更名为“网站库”。

## 2.3.0 发布记录

统一图标尺寸、线条粗细和对齐；新增工具栏／右键菜单／快捷键收藏、跨空间搜索与键盘选择；修复响应式列布局；校验导入网址；上传壁纸独立存储；清理商店重复逻辑，并保护本地多标签页保存。
