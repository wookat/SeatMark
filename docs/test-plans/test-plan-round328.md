# 第 328 轮：生产轻量复测（#341 /en/pricing FAQ 六条英文化）

依据：`app/src/i18n/locales/en.ts` L451–462（六条 q/a 译文，含 'Pro is free for a limited time (normally ¥19/mo)' / 'The Team plan is free for a limited time (normally ¥49/mo)'）。环境：生产，匿名，主包 index-DN3c42Hg.js（已 curl 核验）。

## T1 /en/pricing FAQ 全英文（录屏 UI）
- 滚动至 Pricing FAQ，截图全部六条。PASS：六条问题依次为 'What is the difference between watermarked and watermark-free exports?' / 'What if I run out of watermark-free exports?' / 'Do I need an account to use SeatMark?' / 'Is my roster data safe?' / 'How do I activate Pro?' / 'How do I buy the Team plan?'；答案英文，Pro 条含 **'free for a limited time (normally ¥19/mo)'**，Team 条含 **'free for a limited time (normally ¥49/mo)'**；除 ¥ 金额外无中文字符（若破损则仍显示中文键——可区分）。

## T2 Regression 中文 /pricing FAQ（录屏 UI）
- PASS：六条中文问答保持，Pro/Team 条仍含「限时 0 折免费（原价 ¥19/月）」「（原价 ¥49/月）」。

## T3 pageerror
- PASS：/pricing 与 /en/pricing 均 Runtime.exceptionThrown 0（ERR_BLOCKED_BY_CLIENT 资源噪声照旧注记）。

收尾：清存储、关多余 tab。产出：录屏、test-report.md 第 328 轮章节（不提交）、#341 建议评论。
