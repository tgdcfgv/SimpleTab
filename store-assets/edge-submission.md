# SimTab 2.1.0 · Edge 商店提交资料

状态：安装包及文案已准备；尚未提交审核。注册、审核及上线状态以 Partner Center 为准。

## 基本信息

- 名称：SimTab - 极简新标签页
- 版本：2.1.0
- 主要语言：简体中文（zh-CN）
- 建议分类：生产力（Productivity）
- 安装包：dist/SimTab-2.1.0-edge.zip
- 商店图标：store-assets/logo-300.png（300 × 300 PNG）
- 支持页面：https://github.com/tgdcfgv/SimTab/issues
- 隐私政策：privacy.html（提交前必须发布为公开 HTTPS 页面并验证可访问）
- 不加载远程代码；所有 JavaScript 都包含在安装包中。

## 简短说明

用空间、分组和拖拽整理常用网站；按需导入收藏夹，自定义主题并在本地保存。

## 商店详细说明（可直接粘贴）

SimTab 是一款用于 Microsoft Edge 的极简新标签页扩展。安装后，它将浏览器的新标签页变成一个可自行整理的网站导航页，帮助你把工作、学习和日常访问的网站放在容易找到的位置。

你可以创建多个空间，在每个空间中建立分组，再添加网站卡片；通过拖拽调整分组和网站顺序，按自己的使用习惯设置每行显示数量。搜索框既能查找已保存的网站，也能通过选定的搜索引擎搜索互联网。

主要功能：
• 多空间、多分组管理常用网站。
• 添加、编辑、删除网站，拖拽调整顺序。
• 从预设网站库选择常用服务。
• 在你主动授权后读取 Edge 收藏夹，选择需要的网站添加到导航页；不会修改或删除原有收藏夹。
• 从浏览器导出的 HTML 书签文件中导入 HTTP/HTTPS 网站。
• 浅色、深色和跟随系统主题，可设置壁纸、强调色和程序坞。
• 使用 JSON 文件导出备份或恢复已有内容。恢复会覆盖目标页面的数据。

SimTab 的网站列表与设置保存在当前浏览器本地，不提供账号登录或跨设备云同步。扩展版与网页版的数据互相独立，可通过 JSON 备份迁移。网页版本无法直接读取浏览器收藏夹，需要导入 HTML 文件或使用扩展的新标签页。

扩展使用 storage 权限保存数据，使用 favicon 权限显示网站图标，bookmarks 为按需申请的可选权限。不申请所有网站的访问权限，不加载远程脚本。自定义远程图标、访问网站和搜索可能产生第三方网络请求，具体见隐私政策。

## 单一用途 / Single purpose

Replace the Edge new-tab page with a customizable, locally stored website organizer. Spaces, groups, search, optional bookmark import and appearance settings all support organizing and accessing the user's saved websites from that new-tab page.

## 权限用途（逐项填入）

storage: Save the user's website groups, spaces, link order and appearance settings locally in chrome.storage.local. No cloud synchronization or developer backend is used.

favicon: Display website icons using the browser's favicon API in the extension's new-tab page and website selection interface.

bookmarks (optional): Requested only when the user chooses the browser bookmarks category. Read bookmark titles, URLs and folder paths so the user can choose links to add to SimTab. The extension never creates, modifies or removes native browser bookmarks.

## 审核测试说明 / Notes for certification

No sign-in or test credentials are required. Install the extension and open a new tab. The new-tab override is the core functionality. Open the website library (dock button labelled 应用商店), select 我的收藏夹, and grant the optional bookmarks permission to view and select bookmarks. Refusing permission leaves the other features available. Settings > 浏览器扩展 provides HTML bookmark import and installation information. Importing HTML adds a new group without replacing existing groups. Settings > 导入与导出 provides JSON backup/restore; JSON restore replaces existing app data. All executable code is packaged locally. Remote images are data, not executable code. The extension does not scrape web pages or use a CORS proxy.

## 数据使用声明核对

应如实说明本地处理的网站标题、地址、收藏夹与设置。不要把“没有开发者服务器”表述为“完全不联网”。远程图片提供商、用户选定的搜索引擎、Cloudflare 和 GitHub 的请求处理已写入隐私政策。提交页面的具体选项需对照当前表单逐项填写。

## 发布前剩余步骤

1. 完成 Microsoft Edge 开发者计划注册与验证。
2. 发布并验证公开隐私政策链接。
3. 上传 ZIP 与图标、粘贴介绍和权限说明。
4. 检查数据声明，提交审核。不得把准备完成或上传完成描述为审核通过。
5. 商店通过后，将 install.html 中“尚未上架”替换为实际商店地址。
