# 第 296 轮：#302–#305 部署后 545 攻坚全链路线上复测（生产 www.seatmark.cn）

代码依据：origin/main 2599ad1——`app/src/stores/auth.ts` login 重试上限 `attempt < 5`（600ms·n 退避，4xx 立即抛）；服务端 `edge-functions/api/[[default]].js` 非关键 Blob 写入 waitUntil 后台化（延迟 150ms、单链串行、正常登录跳过 failKey 白写删除），新增 `X-SeatMark-Rev` 观测头。部署确认：`x-seatmark-rev: r298`、`x-seatmark-storage: blob`、entry `index-BxN07GMT.js` 含 `600*d` 与 `d<5;`（重试上限 5 已上线）。

方法同 r294：可视 CDP Chromium UI 操作 + async 监听器（新文件 `/home/ubuntu/r296_net.jsonl`，含 rev/storage 头）+ 录屏。不触碰 /api/auth/code。

## T1 545 成功率（register×3 + login×8）——目标用户视角 0 失败
- 注册 3 个新账号 `seatmark296a/b/c<rand>@example.com` + `ProdPass296!`。若注册 429（IP 日限被探针耗尽），如实记录并改用已有探针账号 seatmark295probe1..10@example.com（密码 probepass{N}{N}）补足登录量。
- 账号 a（或探针账号）登出→重登循环 ×8。
- 判据：每次操作最终进入个人中心、表单不出现「服务暂时不可用，请重试」；listener 统计 raw 545 数并与 r294（register 1/3、login 7/18，≈38%）及用户 curl 探针（login 3/40、register 0/10）对比；若出现 545 应看到 ≤5 次自动重试收尾。任一次 UI 最终失败 → FAIL。

## T2 错密码——仅 1 请求立即 401
- 已知账号+错密码：表单立即显示「邮箱或密码不正确」，listener 中该次仅 1 个 login 请求（401，无重试）。

## T3 短密码 + 登出回归
- 注册模式 7 位密码 → minlength 原生拦截、零 register 请求。
- 登出 → me `{"user":null}`、刷新仍未登录 → 正确密码重登成功。

## T4 头/隐私/健康 + payload 形状
- 全部正常 auth 响应：`X-SeatMark-Rev: r298`、`X-SeatMark-Storage: blob`。
- 登录成功响应体包含 user 对象且有 `loginCount`（数值随登录递增）与 share 相关字段（shareCode/shareStats 数据），无 `passwordHash`；payload 键仅 {email,password}；pageerror=0。个人中心 UI「累计登录」「分享送次数」区块正常渲染（publicUser 后台写线程化后形状不变实证）。

## 收尾
- 新增账号如实上报；清 storage/cookie、停 listener；报告 test-report.md 第 296 轮置顶。
