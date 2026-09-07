# 第 302 轮：PR #310 兑换码安全加固（本地 vite dev + 内存 KV，main e7e1a26）

代码依据：`edge-functions/api/[[default]].js`（redeemKey sha256 哈希键、maskRedeemCode 末4位、getRedeemRecord 明文键迁移+删除、两段式核销 60ms 回读确认、批次只存 hashes+masked、GET 批次返回 masked/legacyCodes）；`app/src/views/AdminView.vue`（freshCodes 一次性 amber 展示区 + textarea + 复制按钮；批次行 legacyCodes 才有复制按钮，否则「末4位：xxxx / …」）。

环境：http://localhost:5173，vite dev + 内存 KV，邮件变量剥离。admin=admin@seatmark.cn（密码注册即管理员）。测试注入：devApi.mjs 临时 seed 旧格式明文键 `redeem:SM-LEGA-CYAA-TE55`（15 天，批次 legacy-test）——测试后回滚该临时改动。

## T1 一次性明文 + 批次掩码（UI）
- admin 注册登录 → /admin 生成 7 天 ×3（备注 r302）。
- PASS：toast 文案含「请立即复制保存——服务端只存哈希」；amber 提示框出现，标题「本次生成的 3 个兑换码（仅展示一次…）」，textarea 含 3 个 SM- 明文码，「复制全部码」按钮可用（xclip 读剪贴板核对）。
- 刷新 /admin。PASS：amber 区消失；批次行操作列显示「末4位：xxxx / xxxx / xxxx」，无「复制全部码」按钮，页面无完整明文码。
- GET /api/admin/codes 响应（监听/浏览器）不含任何 `SM-[0-9A-Z]{4}-` 完整明文（新批次）。FAIL 判据：响应含 codes 数组明文。

## T2 新批次码兑换全分支（UI）
- 注册 r302user1@example.com → /account#redeem 输新码 A → toast「兑换成功 · 延长 7 天」，到期 +7（注册7+兑换7=今天+14）。
- 同人重试码 A → 「兑换码已生效」幂等，到期不变。
- 注册 r302user2 → 输码 A → 红字「兑换码已被使用」。
- 回 /admin：批次「已兑换 1/3」。

## T3 存量明文键迁移
- r302user2 在 /account#redeem 输 `SM-LEGA-CYAA-TE55` → PASS：「兑换成功 · 延长 15 天」，到期 +15。
- 迁移验证：同人重试同码 → 「兑换码已生效」（说明记录在哈希键下仍可读）；另起 curl 检查 dev KV 无法直接读——以幂等成功 + user1 输同码得 409「已被使用」间接验证迁移记录唯一且明文键已让位。

## T4 并发核销（脚本，用户明确要求）
- curl 注册 r302c1/r302c2 两账号取 sm_session cookie，同码 B（新批次第 2 码）两并发 POST /api/redeem。
- PASS：恰好一个 200 `ok:true`，另一个 409「兑换码已被使用」；两个 200 或两个 409 均 FAIL。
- 批次 used 变 2/3（+legacy 批次不计入该批）。

## T5 轻回归
- 注册即送 7 天（T2 已覆盖徽章）；/pricing ¥14.5 五折卡与 CTA 正常渲染；pageerror=0。

## 收尾
- 回滚 devApi.mjs 临时 seed；停 vite；清浏览器状态；报告 test-report.md 第 301/302 轮章节置顶。
