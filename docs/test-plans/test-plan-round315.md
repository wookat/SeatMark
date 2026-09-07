# 第 315 轮：PR #324 生产复测（www.seatmark.cn，rev r314 已实测）——注册/登录验证码 + 找回密码真实邮件全链路

环境：生产 https://www.seatmark.cn/account 。测试账号 r315seatmark@emalupe.com（mail.tm 临时邮箱，API token 在 /home/ubuntu/r315_mailtoken.txt，可 shell 轮询收信）。发码节省口径：reset-code 全轮仅发 1 次（IP 日限 20 共用）。auth POST 偶发 545 由前端自动重试——UI 结果为用户口径，如遇 545 在报告中注记 raw 口径。

## T1 注册链路
1. /account → 免费注册；密码 Prod315!pass、确认密码 Prod315!pasX → PASS：确认框下红字「两次输入的密码不一致」，提交被拦（performance 0 次 POST /api/auth/register）。
2. 改一致，验证码故意答错 → PASS：红字「验证码不正确或已过期，请重试」且题面自动更换（HTTP 400）。
3. 新题答对提交 → PASS：toast「注册成功…7 天专业版」，自动登录个人中心显示「专业版会员 · 7 天后日期到期」。

## T2 登录链路
登出 → 用正确密码 + 答对验证码登录 → PASS：toast「登录成功」，个人中心累计登录 +1。

## T3 找回密码全链路（重点，真实邮件）
1. 登出 → 忘记密码？→ 填 r315seatmark@emalupe.com + 答对验证题 → 发送重置验证码（全轮唯一一次发码）。
   - PASS：POST /api/auth/reset-code 200、toast「验证码已发送」、60s 倒计时；**生产无 devCode 回填（输入框保持为空）**。
2. shell 轮询 mail.tm ≤10 分钟收信。
   - PASS：邮件 from = `seatmark@zalize.com`（Resend 通道），主题含「重置密码验证码」+ 6 位码，10 分钟内到达。
3. UI 填 6 位码 + 新密码 NewProd315!pass ×2 → 重置密码并登录。
   - PASS：toast「密码已重置…已为你自动登录」，进入个人中心。
4. 登出 → 旧密码 Prod315!pass + 答对验证码 → PASS：红字「邮箱或密码不正确」（performance responseStatus=401）。
5. 新密码登录 → PASS：登录成功。

## T4 390px + pageerror + 冒烟（Regression）
- CDP 390×844：/account 登录表单与找回密码表单 scrollWidth ≤ 390；error/unhandledrejection = 0。
- 快速冒烟：/studio 与 /banquet 打开正常渲染（模板预览/四步流程首屏在、无错误提示），pageerror=0。

收尾：登出、清浏览器存储。产出：录屏、报告第 315 轮置顶 test-report.md。
