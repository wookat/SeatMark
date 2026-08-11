# 第 277 轮：#278 Sentry 上报前剥离 q（beforeSendTransaction/beforeBreadcrumb）线上复测（生产，Chromium CDP）

代码依据（2fa91ac）：`main.ts:23-47` beforeSendTransaction 对 event.request.url / event.transaction / 全部 span.description 应用 telemetryPath()（只删 q）；beforeBreadcrumb 对 data.from/to/url 同样剥离。r275 P4 对照：直开 ?q= 时 auto.ui.browser.metrics span description=原始含 q URL。

部署确认（T0）：entry 翻转（r275 为 `index-B2OZ6Rre.js`）——每 60s 轮询 ≤30 分钟。

## T1 主判据：直开 ?q= 的 Sentry envelope 零命中
- 循环（≤15 次）：全新 context 直开 `https://www.seatmark.cn/templates?q=考场277标记词` → 等 12s 收 Sentry envelope（tracesSampleRate=0.2，未命中采样则关 context 重试）。
- 判据：采样命中的 envelope body 全文（含 browser.metrics span description、request.url、transaction、面包屑）标记词原文/编码零命中；剥离后仍应见 `https://www.seatmark.cn/templates`（路径保留，证明是剥 q 而非丢事务）。

## T2 Sentry 未被破坏
- 判据：性能事务 envelope 正常发出（T1 采样命中即证）、含 type:"transaction"；pageerror=0。

## T3 快速回归（Regression）
- SPA 内搜索标记词：地址栏无 ?q=；GA/百度请求抽查零命中；搜索功能正常（无结果态/结果渲染）。

## 报告
- test-report.md 第 277 轮置顶章节 + 本计划 + #278 复测评论文案。
