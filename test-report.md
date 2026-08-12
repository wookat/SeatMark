# 第 292 轮（2026-08-12）：登录闭环补测 🔴 BLOCKED——生产 SES 凭证失效（`X-SeatMark-Mail-Error: AuthFailure.SecretIdNotFound`，8 次发码 0 成功），且 POST /api/auth/code 仍有间歇 545（3/8）。登出闭环、错码回归、#294 ① 不吞码实证全部无法执行。

**环境**：UTC 日界已过（00:02 UTC 起测），IP 发码日限已重置实证（不再 429）。CDP 全新 incognito context 打生产 /account + mail.tm 新邮箱；脚本 `/home/ubuntu/r292_run.py`，结果 `r292_res.json`。计划 test-plan-round292.md。

## T1/T2/T3 登录闭环、错码回归、#294 ① 不吞码 — BLOCKED（新运维阻断）
- 8 次真实发码（不同 mail.tm 新邮箱，间隔合规）：**0 次成功**。分布：502×5（响应体「验证码发送失败，请稍后再试」、storage=blob、**`X-SeatMark-Mail-Error: AuthFailure.SecretIdNotFound`**）+ 545×3（「Error return from script」，无 storage 头）。
- `AuthFailure.SecretIdNotFound` 为腾讯云 API 鉴权错误：**SES 的 SecretId 无效/被删除/未随部署带上**（r289 时同凭证可发信成功，属环境回退——疑与近期重新部署有关）。当前效果：**线上用户完全无法收到验证码、无法登录**（比 r290 的间歇 545 更严重）。
- UI 侧表现：前端显示服务端文案「验证码发送失败，请稍后再试」（502 JSON 正常透传）；545 时按 #294 ③ 应显示「服务暂时不可用，请重试」（r291 已实证，本轮 UI 路径未重复截图）。
- 发码限额纪律：确认阻断后即停手（本日消耗 8/20，为后续修复复测留量）。

## T4 同端点 545 频率 — 如实记录（无法与 r290 同条件对比）
- POST /api/auth/code 8 次中 545×3（≈37%）。r291 的 GET 端点 0/50 与本轮 POST 3/8 并存，说明 **#294 ② 后 545 在 GET 上消失但 POST /api/auth/code 上仍存在**——可能与发信路径（sendCodeMail 内部异常/超时）相关而非 Blob 单例本身；r290 P2 不能视为闭环，如实保留。
- 注：3 次 545 均无 X-SeatMark-Storage 头（网关级错误页特征，与 r290 一致）。

## T5 常规 — PASSED
- auth payload 仅 {email}（verify 未发出）；名单/邮箱标记第三方零外发；pageerror=0；正常响应 storage=blob；storage/cookie 清理、context 全关。headless CDP 未录屏。

## 遗留
- 登出闭环（r290 起三连顺延）、错码回归、#294 ① 不吞码实证：待 **SES 凭证修复**（EdgeOne 环境变量中的 SecretId/SecretKey 校验并重新部署）后再发起一轮，届时预算 2–3 次发码即可完成。

---

