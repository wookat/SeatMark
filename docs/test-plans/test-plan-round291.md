# 第 291 轮：#294 auth 稳健性线上复测（生产，CDP + curl）

部署确认：entry `index-DX45eo51.js` 含「服务暂时不可用，请重试」；#294 三处变更（api.ts:31-38 5xx fallback；[[default]].js:586-589 verify 成功后才 kv.delete(codeKey)；_storage.js:77-88 blobStorePromise 模块级单例）；线上 storage=blob；本机 IP 发码日限仍 429（UTC 日键 00:00 UTC 重置，现 ~20:00 UTC）。

## T1 545 频率对比（#294 ② Blob 单例）
- GET /api/auth/me 与 GET /api/quota 各 25 次（间隔 ~1s，不消耗发码限额）记录状态码分布。
- 判据：545 比例显著低于 r290 的 ≈25%（0/50 最佳；如出现 545 如实记录比例）。口径注记：r290 的 25% 在 POST code/verify 上测得，端点不同仅作趋势对比。

## T2 5xx 友好提示 UI（#294 ③）
- CDP route 拦截 `/api/auth/code` → 返回 545 + text/html「Error return from script」（复刻 r290 真实网关错误页）。
- /account 填合法邮箱点「获取验证码」。
- 判据：表单区显示「服务暂时不可用，请重试」（旧行为：静默无任何提示——r290 实测 t1_send_toast=''，可区分）；截图取证；pageerror=0。
- 反向确认：拦截改 400 + JSON error 时仍显示服务端文案（顺带，不强制）。

## T3 登出分支补测（r290 遗留）
- 先探 1 发 /api/auth/code（真实，mail.tm 新邮箱）：若 429「请求过于频繁，请明天再试」→ 判 BLOCKED，记录重置时间（00:00 UTC）。
- 若已重置：完整走 发码→收码→verify 登录→头部头像下拉（`header button[aria-expanded]`→「退出登录」）→ 回未登录表单 → /api/auth/me 返回 {"user":null} → 刷新仍未登录。顺带 T4 错码「验证码不正确」先试一次。

## T5 常规
- payload 仅 {email,code}；pageerror=0；storage/cookie 清理、context 全关。

## 报告
- test-report.md 第 291 轮置顶章节。
