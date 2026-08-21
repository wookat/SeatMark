# 第 327 轮：生产复测（#340 定价下调为限时 0 折免费，纯文案/数值）

依据：`PricingView.vue`（price '¥0' + originalPrice '¥19'/'¥49'，badge t('限时 0 折免费 · 注册送 7 天')/t('限时 0 折免费 · 可预订')，团队版弹窗文案）；`seo.ts`（title/description/JSON-LD price '0'）；`vsPages.ts`（专业版原价 ¥19/月，限时 0 折免费）；`en.ts`（'Free for a limited time · …'）。环境：生产，匿名，主包 index-ENIXHFow.js 已部署（用户告知，仍核验）。

## T1 中文 /pricing（1280 录屏 UI）
- PASS：专业版卡显示 **¥0/月** + 划线原价 **¥19** + 徽章「限时 0 折免费 · 注册送 7 天」；团队版卡 **¥0/月** + 划线 **¥49** + 徽章「限时 0 折免费 · 可预订」；截图。
- 点团队版「预订」按钮打开弹窗。PASS：弹窗含「团队版原价 ¥49/月，限时 0 折免费。留下邮箱与团队规模…」；**不提交**，关闭。
- CDP 390×844 仿真截图。PASS：sw==iw==390 无横向溢出。

## T2 英文 /en/pricing（录屏 UI）
- PASS：徽章 'Free for a limited time · 7-day trial on sign-up' / 'Free for a limited time · reservable'，¥0 + 划线 ¥19/¥49；团队弹窗 'Team plan is normally ¥49/mo — free for a limited time…'；无中文混杂（价格 ¥ 符号除外）。

## T3 SEO/JSON-LD（curl）
- PASS：/pricing HTML title 含「限时 0 折免费」；JSON-LD 两个 Offer `"price": "0"`、name 含「限时 0 折免费」。

## T4 /vs/chuangkit 价格行（录屏 UI）
- PASS：对比表 SeatMark 价格行含「专业版原价 ¥19/月，限时 0 折免费」。

## T5 pageerror
- PASS：各页无新增（已知基线每 tab 1 条如出现则注记）。

收尾：清存储、关多余 tab。产出：录屏、test-report.md 第 327 轮章节（不提交）、#340 建议评论。
