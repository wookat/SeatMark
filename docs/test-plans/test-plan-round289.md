# 第 289 轮：SES 认证后登录全链路线上复测（生产 https://www.seatmark.cn ）

代码依据：`edge-functions/api/[[default]].js:496-608`——POST /api/auth/code（邮箱格式 400、IP 日限 20 → 429「请求过于频繁，请明天再试」、同邮箱 60s 重发 429「发送太频繁，请稍后再试」、发信成功 `{ok:true,delivery:'email'}`、失败 502）；/api/auth/verify（错码 400「验证码不正确」、过期/无记录 400「验证码已过期…」、≥5 次 429、成功签发 httpOnly JWT Set-Cookie + user）；/api/auth/me、/api/auth/logout。前端 `AccountView.vue:37-80`（获取验证码→倒计时→登录）。收码邮箱：mail.tm API（先建随机账号 @emalupe.com）。

## T1 发码（主判据）
- /account 输入 mail.tm 邮箱 → 点「获取验证码」→ toast「验证码已发送」、按钮变倒计时、响应 200 `delivery:'email'`（非 stub/devCode——若出现 stub 即线上误开联调通道，P 级）。
- mail.tm 轮询收件箱（≤120s）：收到主题『【SeatMark 座签】登录验证码 XXXXXX』的邮件，正文含 6 位码。收不到 → 如实记录「邮件未送达」。

## T2 错误分支（在真码前先试）
- 同邮箱 60s 内再点发送 → formError「发送太频繁，请稍后再试」。
- 输入错误 6 位码（真码±1）→ formError「验证码不正确」（若为「验证码已过期，请重新获取」则可能是 memory 跨实例读不到——如实记录并区分）。

## T3 verify 登录（主判据）
- 输入真码点「登录」→ toast「登录成功」，页面切换为个人中心：显示邮箱、「今日无水印导出配额 remaining/limit」（登录态 limit=每日 3 次 QUOTA_USER_DAILY）。
- 若稳定 400「验证码已过期/不正确」而邮件已收到且码正确：重试 ≤3 轮全失败 → 记录为 memory storage 跨实例已知运维限制（非代码缺陷），T3 及后续判 untested。
- 检查响应头 X-SeatMark-Storage 实值，如实记录。

## T4 登录态链路（T3 成功才做）
- /api/auth/me（页面刷新触发）→ 刷新后仍显示个人中心（登录态保持，httpOnly cookie）。
- 配额文案：登录态 /studio 导出弹窗或 /account 显示每日 3 次口径（与匿名 1 次区分）。
- 点「退出登录」→ 回到未登录表单、刷新仍未登录。

## T5 常规
- 全程 POST /api/auth/* payload 仅含邮箱/验证码（无名单字段）；pageerror=0；storage/cookie 清理、context 全关。

## 报告
- test-report.md 第 289 轮置顶章节；memory 限制如实区分「邮件未收到」vs「收到但验码失败」。
