# 第 286 轮：日期/时区与「跨日重置」语义边界审计（生产，无代码变更轮，Chromium CDP）

代码依据：`stores/quota.ts:18-19` `todayStr()=new Date().toISOString().slice(0,10)`——**UTC 日期**而非本地日期（loadLocalUsage/anonRemaining/tryConsume 全部用它）；`PreviewArea.vue:320-334` 分享引导计数键 `seatmark.post-export-share-prompt.v2` 同一 UTC 口径；`utils/pngExport.ts:144`、`pdfExport.ts:779` 导出文件名时间戳用 `getFullYear/getMonth/getDate/getHours…`——**本地时间**；`SeatingView.vue` 无日期字段。预期矛盾点：北京 00:00–08:00 期间「本地新一天」但 UTC 未跨日→配额不重置；且文件名日期（本地）与配额日期（UTC）在该窗口不一致。

## T1 主判据：北京时间 01:00 场景（timezone 模拟 + Date 偏移）
- 新 context `timezone_id='Asia/Shanghai'` + addInitScript 把 Date 固定偏移到「北京时间次日 01:30（即 UTC 当日 17:30）」。
- 预写 localStorage `seatmark.clean-export-usage.v1` = {date: UTC 当日, used: 1}（模拟「北京昨天晚上」消耗过——本地口径已是新一天）。
- 打开 /studio?demo=1 导出弹窗判据：
  - 若显示「今日剩余 0 次」→ 证实 UTC 口径：本地新一天不重置（北京用户 0-8 点无法获得新配额，实际到 08:00 才重置）——如实记录并定级（预期 P4：影响限 0-8 点匿名用户，重置只是延迟而非丢失）；
  - 反之显示 1 次则为本地口径（与源码矛盾，需排查）。
- 同 context 逆向：预写 {date: UTC 昨日, used:1}（模拟北京今天上午 9 点看昨天的消耗）→ 应显示「剩余 1 次」（UTC 已跨日，正常重置）。

## T2 未来/异常日期容错
- 预写 {date: 明天(UTC+1日), used: 1}、{date: '2099-01-01', used: 99}、{date: 'garbage', used: NaN} 三种 → 每种刷新后：「今日剩余 1 次」（parsed.date!==today → 按 0 处理）、无负数、无永久锁死；消费一次后写回 {date: 今日UTC, used:1}。

## T3 导出文件名时间戳冒烟
- 在 T1 的 01:30（北京）context 中带水印导出 → 文件名 `-YYYYMMDD-HHMMSS` 段应为**北京日期与 01:3x**（本地时间口径，getDate/getHours）；与配额键的 UTC 日期不同——如实记录两口径并存现象。

## T4 分享引导计数键同口径抽查
- 读线上 chunk 确认 `post-export-share-prompt.v2` 写入的 date 同为 toISOString 截取（静态验证）+ T3 导出后读该键实值 date=UTC 当日。

## T5 常规
- 全新 incognito context、pageerror=0、demo 名单第三方零外发（抽查）、storage 清理、context 全关。

## 报告
- test-report.md 第 286 轮置顶章节 + 本计划；发现按 P 级定级。
