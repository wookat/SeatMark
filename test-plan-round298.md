# 第 298 轮：PR #308 会员体系与兑换码（本地 vite dev + 内存 KV）

代码依据：分支 devin/1786652411-membership-redeem 62d23ee。
- 后端 `edge-functions/api/[[default]].js`：TRIAL_DAYS_REGISTER=7（仅新建账号）；inviteCode（8位hex 分享码）双方各+7（邀请方 deferWrite）；POST /api/redeem（401 未登录、格式错 400「兑换码格式不正确」、无效 400「兑换码无效」、他人已用 409「兑换码已被使用」、本人重试 200 already:true、IP 20/日）；POST/GET /api/admin/codes（1–3660 天、1–200 个、批次含 used）；proStatus→quota pro:true limit 9999。
- 前端：`AccountView.vue` 徽章「专业版会员 · {日期} 到期」/「免费版 · 邀请好友或兑换码可开通专业版」、配额卡「不限」、#redeem 区「兑换码开通专业版」+ SM-XXXX 输入框；`AdminView.vue`「兑换码管理」生成表单+批次表（已兑换 x/y、复制全部码）；`PricingView.vue` ¥14.5/¥49.5 + 划线 ¥29/¥99、badge「限时 5 折 · 注册送 7 天」、CTA 登录态→/account#redeem；`App.vue` ?ref= 写 localStorage sm-invite-ref，`auth.ts` 注册携带并清除。

环境：http://localhost:5173（vite dev + devApi 内存 KV，邮件环境变量已剥离）。可视 CDP 浏览器 + 录屏；admin=admin@seatmark.cn（默认 ADMIN_EMAILS，密码注册即成管理员）。

## T1 注册送 7 天（UI）
- 注册 m298user1@example.com / Pass29811 → toast「已赠送 7 天专业版试用」；个人中心徽章「专业版会员 · {今天+7天} 到期」；配额卡显示「不限」（非 3/3）。FAIL 判据：徽章仍旧文案或配额显示数字。

## T2 邀请裂变 +7/+7
- 取 user1 分享码（?ref=hex8）→ 登出 → 访问 `http://localhost:5173/?ref=<码>`（应见分享欢迎横幅）→ /account 注册 m298user2 → user2 徽章到期 ≈ 今天+14 天（7 注册+7 邀请）。
- 重登 user1 → 到期应为原 +7 再 +7 ≈ 今天+14（deferWrite 落库验证，必要时刷新二次确认）。FAIL：任一方未 +7。

## T3 兑换码全分支
- 登录 admin@seatmark.cn（先注册）→ /admin「兑换码管理」生成 30 天 ×3（备注 test298）→ 批次表出现 1 行「30 天 / 3 / 已兑换 0/3」；记录 3 个码。
- 登出 → 登录 m298user1 → /account#redeem 输码 A → toast「兑换成功 · 专业版已延长 30 天」，徽章到期 = 原到期+30 天。
- 再输同码 A → toast「兑换码已生效」（already 幂等）。
- 登出→登录 user2 → 输码 A → 红字「兑换码已被使用」；输 `SM-2222-3333-4444`（未发行）→「兑换码无效」；输 `abc`→「兑换码格式不正确」。
- 回 /admin 批次表「已兑换 1/3」。

## T4 /pricing 展示 + CTA + 响应式
- 专业版卡：¥14.5/月 + 划线 ¥29/月、badge「限时 5 折 · 注册送 7 天」、绿标「注册送 7 天」、feature 含「邀请好友注册，双方各送 7 天」「支持兑换码开通」；团队版 ¥49.5 + 划线 ¥99。
- 登录态点专业版 CTA → 跳 /account#redeem（滚动到兑换区）。
- 390/768/1280 下 /pricing 与 /account `scrollWidth<=innerWidth`，截图。

## T5 回归
- 免费版视角：admin 账号未兑换未受邀 → 徽章「免费版 · …」+ 配额数字 3/3（证明 pro 判定不误伤）。
- me 响应含 pro:{active,until}；无 passwordHash；pageerror=0。

## 收尾
- 停 vite、清浏览器状态；报告 test-report.md 第 298 轮置顶。
