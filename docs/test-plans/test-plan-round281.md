# 第 281 轮：#282 匿名配额多页签同步线上复测（生产，Chromium CDP）

代码依据：`stores/quota.ts:54-60` 新增 storage 事件监听（event.key===`seatmark.clean-export-usage.v1` 时重读 localUsage → 「今日剩余」实时跟随）；`quota.ts:109-121` tryConsume 匿名分支消耗前 `loadLocalUsage()` 与内存取 `Math.max`，达限置 limitDialogOpen 并拦截、不覆写回退。r279 旧行为（可区分）：B 页签陈旧显示「剩余 1 次」、可再导出、写回覆写 used=1。

## T0 部署确认
- 轮询 `curl https://www.seatmark.cn/` entry 翻转（r279 基线 index-BY-oO6Ou.js）且新 entry JS 含配额 storage 监听特征串。未翻转则等待/报告阻塞。

## T1 主判据：A 消耗 → B 不刷新实时同步 + 拦截（r279 P4 闭环）
- 全新 incognito context 开 A、B 双 /studio 页签，各导入演示名单。
- A：导出弹窗选无水印导出 1 次成功 → localStorage `seatmark.clean-export-usage.v1` = {today, used:1}。
- B（**不刷新**）判据：
  - ① 打开导出弹窗，无水印选项文案应为「今日剩余 0 次」（r279 旧行为=1 次）并处禁用/拦截态；
  - ② 强行触发无水印导出 → 应被拦截并弹出引导弹窗（limitDialog，含「登录后每天 3 次」类文案），**无下载产生**；
  - ③ localStorage 仍 used=1（不被覆写回退为其它值）。

## T2 反向：B 先消耗、A 后拦截
- 新 context 双页签，B 无水印导出成功 → A 不刷新尝试无水印 → 拦截+引导弹窗，used 保持 1。

## T3 回归
- 新 context 单页签：第 1 次无水印导出成功（下载 1 个、used=1）、第 2 次被拦截（引导弹窗、无下载）。
- 跨日重置：预写 localStorage {date:昨日, used:1} 后开新页 → 显示「今日剩余 1 次」且可成功导出，写回 date=今日 used=1。
- 带水印导出不计数：used 不变。

## T4 常规
- 全程 pageerror=0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 281 轮置顶章节 + 本计划。
