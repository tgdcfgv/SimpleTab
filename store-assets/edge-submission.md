# SimTab 2.3.0 · Edge 商店提交资料

状态：安装包及文案已准备；尚未提交审核。注册、审核及上线状态以 Partner Center 为准。

## 基本信息

- 名称：SimTab - 极简新标签页
- 版本：2.3.0
- 主要语言：简体中文（zh-CN）
- 建议分类：生产力（Productivity）
- 安装包：dist/SimTab-2.3.0-edge.zip
- 商店图标：store-assets/logo-300.png（300 × 300 PNG）
- 支持页面：https://github.com/tgdcfgv/SimpleTab/issues
- 隐私政策：privacy.html（提交前必须发布为公开 HTTPS 页面并验证可访问）
- 不加载远程代码；所有 JavaScript 都包含在安装包中。

## 简短说明

用空间、分组和拖拽整理常用网站；按需导入收藏夹，自定义主题，登录账户同步到云端。

## 商店详细说明（可直接粘贴）

SimTab 是一款用于 Microsoft Edge 的极简新标签页扩展。安装后，它将浏览器的新标签页变成一个可自行整理的网站导航页，帮助你把工作、学习和日常访问的网站放在容易找到的位置。

你可以创建多个空间，在每个空间中建立分组，再添加网站卡片；通过拖拽调整分组和网站顺序，按自己的使用习惯设置每行显示数量。搜索框既能查找已保存的网站，也能通过选定的搜索引擎搜索互联网。

主要功能：
• 多空间、多分组管理常用网站。
• 添加、编辑、删除网站，拖拽调整顺序。
• 点击工具栏图标、使用快捷键或页面右键菜单，选择空间和分组收藏当前网页。
• 从预设网站库选择常用服务。
• 在你主动授权后读取 Edge 收藏夹，选择需要的网站添加到导航页；不会修改或删除原有收藏夹。
• 从浏览器导出的 HTML 书签文件中导入 HTTP/HTTPS 网站。
• 浅色、深色和跟随系统主题，可设置壁纸、强调色和程序坞。
• 使用 JSON 文件导出备份或恢复已有内容。恢复会覆盖目标页面的数据。

SimTab 无需登录即可使用，内容保存在浏览器。登录后显示独立的 Supabase 云端内容，网页和扩展登录同一账户即可同步；退出后恢复本地内容。两份内容不自动合并；主动复制本地到云端后仍保留本地内容。网页版本无法直接读取浏览器收藏夹，需要导入 HTML 文件或使用扩展的新标签页。

扩展使用 storage 权限保存和读取未登录时的本地内容，使用 favicon 权限显示网站图标，使用 activeTab 临时读取用户主动选择页面的标题和网址，使用 contextMenus 提供收藏菜单；bookmarks 为按需申请的可选权限。不申请所有网站的访问权限，不加载远程脚本。自定义远程图标、访问网站和搜索可能产生第三方网络请求，具体见隐私政策。

## 单一用途 / Single purpose

Replace the Edge new-tab page with a customizable, cloud-synced website organizer. Spaces, groups, search, optional bookmark import and appearance settings all support organizing and accessing the user's saved websites from that new-tab page.

## 权限用途（逐项填入）

storage: Save and read guest website groups and settings locally in chrome.storage.local. Signing in switches to independent Supabase account data protected by row-level policies; signing out restores guest data. Local and cloud data are not automatically merged. chrome.storage.session temporarily holds user-initiated capture drafts; saving or cancelling clears them, drafts expire after 30 minutes and browser shutdown clears them. Failed saves may retain drafts for retry.

https://zyttspnlrdzjosnitijb.supabase.co/*: Authenticate users and read/write only the signed-in user's account data through this dedicated Supabase project.

favicon: Display website icons using the browser's favicon API in the extension's new-tab page and website selection interface.

activeTab: Temporarily read the current page title and URL only after the user invokes the extension action or shortcut. No page content or browsing history is read.

contextMenus: Provide the HTTP/HTTPS page menu item "Save current page to SimTab". It opens a save dialog in a new SimTab tab; nothing is saved before confirmation.

bookmarks (optional): Requested only when the user chooses the browser bookmarks category. Read bookmark titles, URLs and folder paths so the user can choose links to add to SimTab. The extension never creates, modifies or removes native browser bookmarks.

## 审核测试说明 / Notes for certification

Sign-in is optional. Guest mode works immediately and saves data locally. Before store submission, configure production SMTP and provide a dedicated reviewer test account through Partner Center (never publish credentials in this repository). Install the extension and open a new tab to use guest mode; sign in to test the separate cloud content. The new-tab override is the core functionality. On an HTTP/HTTPS page, click the extension action or page menu item 保存当前页面到 SimTab to open the save dialog. Choose a space and group before saving; duplicate URLs in that group are not added again. Cancelling adds nothing. The default shortcut is Alt+Shift+S; reassign it in extension shortcut settings if occupied. Open the website library (dock button labelled 应用商店), select 我的收藏夹, and grant the optional bookmarks permission to view and select bookmarks. Refusing permission leaves the other features available. Settings > 账户与同步 provides HTML bookmark import and installation information. Importing HTML adds a new group without replacing existing groups. Settings > 账户与同步 provides JSON backup/restore; JSON restore replaces existing app data. All executable code is packaged locally. Remote images are data, not executable code. The extension does not scrape web pages or use a CORS proxy.

## 数据使用声明核对

应如实声明 Supabase Auth 处理邮箱和密码，云端保存用户的网站标题、地址、导入收藏夹和设置，并说明本地登录凭证及用户隔离。远程图片提供商、用户选定的搜索引擎、Cloudflare 和 GitHub 的请求处理已写入隐私政策。提交页面的具体选项需对照当前表单逐项填写。

## 发布前剩余步骤

1. 配置 Supabase SMTP，准备专用审核测试账户，并完成 Microsoft Edge 开发者计划注册与验证。
2. 发布并验证公开隐私政策链接。
3. 上传 ZIP 与图标、粘贴介绍和权限说明。
4. 检查数据声明，提交审核。不得把准备完成或上传完成描述为审核通过。
5. 商店通过后，将 install.html 中“尚未上架”替换为实际商店地址。
