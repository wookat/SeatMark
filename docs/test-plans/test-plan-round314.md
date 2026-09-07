# 第 314 轮：PR #324 本地端到端测试（登录注册加固：确认密码 + 找回密码 + 算术验证码）

环境：本地 vite dev http://localhost:5173（`env -u RESEND_API_KEY -u TENCENT_SES_SECRET_ID -u TENCENT_SES_SECRET_KEY npm run dev`，memory KV，devCode 可用，rev 头已实测 r314）。全 UI 操作 + 录屏；测试账号 r314user@test.cn。

## T1 注册（/account）
1. 点「免费注册」，填邮箱 r314user@test.cn、密码 Passw0rd!314、确认密码故意填 Passw0rd!315。
   - PASS：确认密码框下即时红字「两次输入的密码不一致」；提交后仍被拦（表单红字同文案），Network 无 POST /api/auth/register。
2. 改确认密码一致，验证问题**故意答错**（正确答案±1），提交。
   - PASS：POST /api/auth/register 返回 400，表单红字「验证码不正确或已过期，请重试」，且验证问题**自动换成新题**（题面变化）。
3. 新题答对，提交。
   - PASS：toast「注册成功…7 天专业版」，页面变为已登录账户页（显示邮箱）。

## T2 登录（含换题重试）
1. 登出（账户菜单）。PASS：回到登录表单且验证问题已重新取题。
2. 答错验证码登录一次。PASS：400 红字 + 题面自动更新；点「换一题」按钮题面再变。
3. 答对 + 正确密码登录。PASS：登录成功 toast，进入账户页。

## T3 找回密码全链路
1. 登出 → 点「忘记密码？」。PASS：标题「找回密码」，只显示邮箱+验证问题，按钮「发送重置验证码」。
2. 填 r314user@test.cn、答对验证题，发送。
   - PASS：POST /api/auth/reset-code 200；toast「验证码已发送」；出现「邮件验证码」输入框且 **devCode 已自动回填 6 位数字**；重发按钮显示「60s 后重发」倒计时。
3. 新密码填 NewPassw0rd!314，确认密码先填不一致 → 红字「两次输入的密码不一致」被拦；改一致后提交。
   - PASS：POST /api/auth/reset-password 200，toast「密码已重置…自动登录」，进入已登录账户页。
4. 登出 → 用**旧密码** Passw0rd!314 + 答对验证码登录。
   - PASS：POST /api/auth/login 返回 **401**，红字「邮箱或密码不正确」（非验证码错误）。
5. 用新密码 NewPassw0rd!314 登录。PASS：登录成功。

## T4 390px 移动端 + pageerror
CDP 仿真 390×844 打开 /account（登出态，含验证问题行）与「找回密码」发码后表单：
- PASS：scrollWidth ≤ 390，无横向溢出；全程 window error/pageerror = 0（挂监听采集）。

不测/延后：生产 X-SeatMark-Rev=r314、Resend seatmark@zalize.com 发信（用户明示合并部署后另行通知）。
