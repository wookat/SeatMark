# 第 316 轮：PR #326 图片验证码本地端到端测试（分支 devin/1786737138-image-captcha @e84f8bc）

环境：本地 vite dev http://localhost:5173（mail env 已 unset，memory KV，devCode 可用；`/api/auth/captcha` 实测返回 `{image: data:image/svg+xml;base64,…, token}` 且 rev 头 r316）。取答案法：shell 解码当前页 img src 的 base64 SVG，正则 `>([2-9A-Z])</text>` 逐字符提取（与浏览器同一 token 需从页面 DOM 读 img src）。测试账号 r316user@test.cn / Passw0rd!316。

## T1 图片渲染与刷新（/account 注册页）
1. 打开 /account → 免费注册。PASS：验证码行标签为「图片验证码」，132×44 图片可见（截图肉眼可辨 4 个扭曲字符），输入框 placeholder「图中字符，不分大小写」，按钮「换一张」。
2. 点「换一张」。PASS：img src（base64 内容）变化，图中字符与前一张不同。
3. 点图片本身。PASS：src 再次变化（点图也可刷新）。

## T2 注册：答错自动换图 / 小写答对成功
1. 填邮箱 r316user@test.cn、密码+确认密码一致，验证码故意填 "0000"（字符集不含 0，必错），提交。
   - PASS：POST /api/auth/register 400，红字「验证码不正确或已过期，请重试」，图片自动换新（src 变化）。
2. 从 DOM 读当前 img src 解码出 4 位答案，**以小写**输入提交。
   - PASS：注册成功 toast，自动登录个人中心（专业版 7 天）。

## T3 登录 + 找回密码 devCode（图片验证码接入校验）
1. 登出 → 登录表单验证码为新图；解码答案小写填入 + 正确密码登录。PASS：登录成功（累计登录 2）。
2. 登出 → 忘记密码？→ 填邮箱 + 解码答案 → 发送重置验证码。
   - PASS：reset-code 200、toast「验证码已发送」、**devCode 6 位自动回填**、60s 倒计时（证明发码链路仍带图片验证码校验且 devCode 流程通）。
   - 负面对照（raw）：发码前先答错一次 → 400 + 图片自动换新。
3. 填新密码 NewPassw0rd!316 ×2 → 重置成功自动登录。PASS：toast「密码已重置」。

## T4 390px + pageerror
CDP 390×844 打开 /account 登录表单与找回密码表单：
- PASS：scrollWidth ≤ 390（验证码行含图片+输入框+换一张不溢出）；error/unhandledrejection = 0。

## T5 生产复测（PR #326 已合并，EdgeOne 自动部署）
1. 轮询 https://www.seatmark.cn/api/auth/captcha 至 `x-seatmark-rev: r316` 且返回 image 字段。
2. 生产 /account：图片验证码渲染、换一张/点图刷新（图变）。
3. 用 r315seatmark@emalupe.com / NewProd315!pass：答错验证码 → 400 + 自动换图；答对（小写）→ 登录成功。不发找回密码邮件（上轮已验，节省额度）。
4. 390px /account 登录表单 scrollWidth ≤ 390、errs=0。

收尾：清浏览器存储（本地+生产）。产出：录屏（T1–T3 本地 + T5 生产）、报告第 316 轮置顶 test-report.md。
