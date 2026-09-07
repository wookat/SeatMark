# 第 293 轮：邮箱+密码登录（PR #299）——本地全功能 + 线上复测

代码依据：`edge-functions/api/[[default]].js`（/api/auth/register、/api/auth/login，PBKDF2 10 万次、错密码 401「邮箱或密码不正确」、重复注册 409「该邮箱已注册，请直接登录」、无密码历史账号 409「该账号尚未设置密码，请先注册设置」）；`app/src/views/AccountView.vue`（mode login/register 切换按钮「免费注册」/「去登录」、前端 <8 位拦截「密码至少 8 位」+ input minlength=8、提交按钮「注册并登录」/「登录」）；`app/src/stores/auth.ts` register/login。

## Part A：本地（vite dev http://localhost:5173，内存 KV，录屏）

随机新邮箱 E=`r293x<rand>@test.dev`，密码 P=`Passw0rd293!`。

- A1 注册：/account 默认登录模式 → 点「免费注册」切到注册（标题变「注册 SeatMark」、按钮「注册并登录」）→ 输 E+P 提交 → toast「注册成功」+ 个人中心显示 E 与登录态配额文案（3 次/无水印导出）。坏实现：停留表单/报错。
- A2 短密码拦截：注册模式输 7 位密码提交 → 表单错误「密码至少 8 位」（或浏览器 minlength 原生提示），且 network 无 /api/auth/register 请求（在 A1 之前做，用另一邮箱或同 E 均可，此处安排在 A1 前用 E 测短密码保证无请求发出）。
- A3 刷新保持：F5 → 仍个人中心（/api/auth/me 返回 user=E）。
- A4 登出：头部头像下拉「退出登录」→ 回登录表单；fetch /api/auth/me（页面内自然请求或刷新）返回 {"user":null}；刷新仍未登录。
- A5 错密码：登录模式 E+错密码 → 表单显示「邮箱或密码不正确」（401）。
- A6 正确密码登录：E+P → toast「登录成功」→ 个人中心。
- A7 重复注册 409：登出后切注册模式，用 E+任意 ≥8 位密码提交 → 显示「该邮箱已注册，请直接登录」。
- A8 移动端 390px：devtools device 模式 390 宽 /account → `scrollWidth<=innerWidth`，表单可用，截图。
- A9 隐私/健康：捕获全部 /api/auth/* 请求：payload 键仅 {email,password}（logout/me 无 body）；所有响应体无 `passwordHash`；pageerror=0。

## Part B：线上（https://www.seatmark.cn，storage=blob，录屏；不触碰 /api/auth/code）

先确认部署：/account 出现「密码」输入框（新版）；否则等待轮询。

- B1 注册线上测试账号 E2=`seatmark293x<rand>@example.com` + P → 注册成功 → 个人中心；响应头 X-SeatMark-Storage=blob。
- B2 刷新保持登录（me 返回 E2）。
- B3 登出 → me=null → 刷新仍未登录。
- B4 正确密码重新登录成功（blob 持久化跨请求实证）。
- B5 错密码 → 「邮箱或密码不正确」；短密码前端拦截（无请求发出）。
- B6 移动端 390px 无横向溢出。
- B7 隐私：payload 仅 email/password、名单零外发、响应无 passwordHash；pageerror=0。

## 通用
- 全程 fresh incognito context（本地可视 Chromium 供录屏；生产同窗继续）；结束清 storage/cookie、关 context。
- 报告：test-report.md 第 293 轮置顶章节。
