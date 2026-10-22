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

## 账户安全操作

设置 → 账户新增「修改密码」与「注销账户」。两个流程均通过 `/auth/v1/otp` 发送验证码（`create_user: false`），不创建新用户；获取验证码有 60 秒重发间隔。修改密码先验证邮箱并保留新会话，再调用 `/auth/v1/user` 更新密码；未设置过密码的验证码账户也支持设置密码。密码至少 8 位，仍受项目的密码强度设置约束。

注销使用 `supabase/functions/delete-account/index.ts`。服务端先验证登录身份，再验证该账户邮箱验证码，撤销所有会话后调用 Auth 管理接口永久删除当前用户。`account_data.user_id` 的 `ON DELETE CASCADE` 会清理该账户的云端内容。前端不传入目标用户 ID，不持有管理密钥；仅注销成功后清除登录信息、恢复浏览器原有本地内容。失败时显示错误，不宣告成功。

Edge Function 使用 Supabase 默认注入的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，不要将服务密钥复制到客户端。部署 `delete-account` 后才能使用注销接口。

2026-10-22 已部署 `delete-account`（JWT 校验开启）；已确认未登录请求返回 401。未使用真实账户执行注销，删除流程通过本地模拟接口回归验证。

账户安全回归：`node --test tests/account-security.test.mjs` 与 `node tests/account-security-browser.cjs`，均使用模拟接口，不发送邮件、不删除真实账户。
