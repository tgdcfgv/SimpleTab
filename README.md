# SimTab

一个简洁、高密度、可自定义的浏览器新标签页扩展。

SimTab 用空间、分组和网站卡片整理常用链接，并提供搜索、拖拽排序、浏览器书签导入、主题设置及本地备份等功能。项目基于 Manifest V3 开发，适用于 Chrome、Microsoft Edge 等 Chromium 浏览器。

## 功能特点

- 多空间管理，可为工作、学习和生活创建独立空间
- 网站分组与自定义每行显示数量
- 拖拽调整分组及网站顺序
- 搜索已保存的网站，或使用选定的搜索引擎直接搜索
- 添加、编辑和删除自定义网站
- 从热门网站库快速添加常用服务
- 按需读取浏览器书签并添加到 SimTab
- 浅色、深色及跟随系统主题
- 自定义壁纸、强调色和显示效果
- 自定义程序坞按钮及显示方式
- 使用 JSON 文件导入、导出全部数据和设置
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
git clone https://github.com/你的用户名/SimTab.git
```

然后在浏览器扩展管理页面开启开发者模式，并选择仓库根目录进行加载。

## 发布为网站（Cloudflare Pages + GitHub）

此项目也能作为普通网站使用。Cloudflare Pages 连接 GitHub 后，每次向生产分支推送代码都会自动构建并发布。

1. 将网页源码推送至 GitHub 仓库。
2. 在 Cloudflare 控制台进入 **Workers & Pages**，创建 **Pages** 项目并选择连接 Git 仓库。
3. 选择 `tgdcfgv/SimTab`，填写以下设置：

| 设置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | `None` |
| 构建命令 | `mkdir -p .pages-output && cp newtab.html .pages-output/index.html && cp -R css js .pages-output/` |
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

网页版的数据保存在当前浏览器、当前域名的本地存储中，不会随着代码部署同步到其他设备。扩展版、预览域名和自定义域名之间迁移数据时，请使用 JSON 导出和导入。普通网站不能直接读取浏览器书签；此功能需使用扩展版。图标抓取可能受目标网站跨域限制影响。

参考：[Cloudflare 静态网站部署](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

## 日常使用

- 点击程序坞中的“添加分组”或“添加网站”创建内容。
- 拖动分组标题或网站卡片可以调整顺序。
- 在搜索框中输入关键词可查找已保存的网站；按回车可使用当前搜索引擎搜索。
- 点击“应用商店”可从预设分类中批量添加常用网站。
- 在“设置 → 导入与导出”中创建 JSON 备份或恢复已有数据。
- 浏览器书签权限只会在使用对应功能时申请。

## 数据与隐私

SimTab 的空间、分组、网站及外观设置默认保存在浏览器本地存储中，不提供云同步，也不会上传完整配置数据。

使用“一键爬取”网站图标功能时，扩展会访问用户填写的目标网址；直接访问失败时，可能通过第三方服务获取网页信息或站点图标。请勿在该功能中填写包含密码、令牌或其他敏感参数的网址。

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
