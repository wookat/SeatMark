# 第 294 轮：PR #301 线上复测（auth 545 双管齐下——服务端 Blob 并行化 + 前端 5xx 自动收尾）

代码依据：`app/src/stores/auth.ts`（origin/main 5fbdb84）——`login()` 最多 3 次尝试、600ms×attempt 退避、4xx 立即抛；`register()` 捕获 ApiError status≥500 后改走 `login()`，登录侧 4xx 回抛原注册错误。部署确认：生产 entry `index-CnDnn-Ti.js` → 主 chunk `index-C6Gj5hO2.js` 含 `600*d` 退避与 `auth/register` 字面量（新 bundle 已上线）。

环境：生产 https://www.seatmark.cn，可视 CDP Chromium（29229）+ fresh incognito context，全程 async CDP listener（沿用 r293 模式）写 `/home/ubuntu/r294_net.jsonl`，录屏。不触碰 /api/auth/code。

## T1 545 成功率（核心）：register×3 + login×8，用户视角 0 失败
- 3 个新账号 `seatmark294a/b/c<rand>@example.com` + `ProdPass294!`，UI 注册模式提交。判据：每次最终进入个人中心（toast+邮箱+配额文案），**表单不出现「服务暂时不可用，请重试」**；listener 记录原始 545 数；若 register 545 → 应观察到后续自动 `login` 请求收尾成功（网络明细可见 register 5xx 后紧跟 login POST）。
- 用账号 a（或复用 seatmark293x812@example.com / ProdPass293!）做正确密码登录 ×8（登录→头像下拉登出→再登录循环，或多次登出重登）。判据：8/8 UI 成功进入个人中心，0 次用户可见失败；若网络层 545 出现，应看到同凭据自动重试（≤3 次、间隔约 600/1200ms）后成功。
- 统计输出：raw 545 次数 vs 用户视角失败次数（目标 0）。若任一次 UI 最终失败 → FAIL。

## T2 错误密码立即 401，不触发重试
- 用已知账号+错密码提交。判据：表单立即（<~1.5s，无退避延迟）显示「邮箱或密码不正确」；listener 中该次仅 **1 个** /api/auth/login 请求（401，无第 2/3 次）。

## T3 短密码零请求 + 登出回归
- 注册模式输 7 位密码提交 → 原生 minlength 拦截，listener 无 /api/auth/register 请求。
- 登录态下头像下拉「退出登录」→ /api/auth/me 返回 `{"user":null}`，刷新仍未登录 → 正确密码重登成功。

## T4 存储/隐私/健康
- 全部正常 auth 响应头 `X-SeatMark-Storage: blob`（545 无头如实记录）。
- 所有 auth POST payload 键仅 {email,password}；所有响应体无 `passwordHash`；pageerror=0。

## 收尾
- 测试账号如实上报（可清理）；清 storage/cookie、关 context、停 listener。
- 报告：test-report.md 第 294 轮置顶章节。
