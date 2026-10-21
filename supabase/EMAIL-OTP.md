# 启用邮箱验证码

前端已使用 `/auth/v1/otp` 发送邮件，通过 `/auth/v1/verify` 提交邮箱、数字验证码和 `type: email`。首次使用自动注册，不依赖邮件链接跳转。

## Supabase 控制台配置（必须完成）

项目：`zyttspnlrdzjosnitijb`（SimTab）。

1. Authentication → Emails → SMTP Settings：配置并启用自定义 SMTP。
2. Authentication → Emails → Templates：将 **Confirm sign up** 和 **Magic link or OTP** 两个模板的正文都替换为 `templates/email-otp.html`，主题使用“SimTab 邮箱验证码”。两种邮件都必须包含 `{{ .Token }}`，不要使用 `{{ .ConfirmationURL }}`。
3. Authentication → Sign In / Providers → Email：保持邮箱验证开启，可将 Email OTP expiration 设为 600 秒。前端支持 6–10 位数字验证码，重发间隔为 60 秒。
4. 分别测试新邮箱注册和已有邮箱登录；输入最新验证码后应进入云端内容，刷新保持登录，退出恢复本地内容。

2026-10-21 已完成：Resend 发信域名 `mail.233032.xyz` 显示 Verified；Supabase 自定义 SMTP 已启用，发件地址为 `noreply@mail.233032.xyz`；注册和登录两个邮件模板已保存为含 `{{ .Token }}` 与 SimTab Logo 的中文验证码邮件。SMTP 密钥仅由用户填入 Supabase，不保存在仓库。Logo 使用 `https://simtab.233032.xyz/icons/icon-128.png`，已确认返回有效 PNG。收件人邮箱可能需要允许加载远程图片。

## 使用 Resend 的示例

先在 Resend 中添加并验证你拥有的发信域名，按其界面要求在域名 DNS 添加记录，然后创建 API key。

| Supabase SMTP 字段 | 填写内容 |
| --- | --- |
| Sender email | 已验证域名下的发件地址，例如 `noreply@你的域名` |
| Sender name | SimTab |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | Resend API key（仅填在 Supabase 控制台） |

API key 不应写入前端文件、Git 仓库或聊天。

参考：
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/docs/send-with-smtp

## 本地验证

`node --test tests/cloud.test.mjs tests/data.test.mjs`

使用本地网页服务器启动源码后，运行 `node tests/auth-browser.cjs`。浏览器回归使用模拟接口，不发送真实邮件。
