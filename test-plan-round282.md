# 第 282 轮：全站 SEO 元数据与结构化数据一致性审计（生产，无代码变更轮）

代码依据：`app/src/data/seo.ts`（全站 SEO 单一数据源：每路由 title/description/path/jsonLd/robots；/account /admin `noindex, nofollow`；未知路径 404 → path=/404、`noindex, follow`；PRICING_FAQS 页面与 JSON-LD 共用）；`app/scripts/prerender.mjs`（预渲染用同一 resolveSeo 重写 head，并按同一路径清单生成 sitemap.xml——sitemap 与预渲染页面应一一对应）；`app/src/utils/seo.ts`（SPA 导航后 head 同步）。robots.txt 引用 `Sitemap: https://www.seatmark.cn/sitemap.xml`，线上 sitemap 331 条。

## T1 预渲染内容页抽样（curl 静态源，≥10 页）
- 抽样：`/`、`/templates`、`/papers`、`/pricing`、`/seating`、`/vs`（列表）、2 篇 guides、1 个 vs 详情、1 个 topic、`/terms`。
- 判据：每页 title 唯一（抽样集内无重复）且与 seo.ts 源数据逐字一致；description 非空、无截断乱码（合法 UTF-8、不含 escape 残渣）；canonical=https://www.seatmark.cn+path（根路径 `/` 结尾、其余无尾斜杠、无查询参数）；og:url=canonical。

## T2 OG/Twitter 卡片
- 判据：抽样页均有 og:title/og:description/og:image/twitter:title/twitter:description/twitter:image；og:image URL 请求 HTTP 200 且 Content-Type image/*。

## T3 结构化数据 JSON-LD
- 抽样页全部 `<script type=application/ld+json>` JSON.parse 通过；类型核对：首页 SoftwareApplication（offers.price="0"）、/pricing FAQPage（mainEntity 数=PRICING_FAQS=6）+BreadcrumbList、guides 详情 HowTo/FAQ/Breadcrumb 与页面正文一致（HowTo step 数>0、name 非空）；必填字段（@context/@type、FAQ question name+acceptedAnswer.text、Breadcrumb position/item）无缺失。

## T4 sitemap 与 robots
- sitemap.xml 331 条中抽 15 条（各类型至少 1 条）→ 全部 HTTP 200 且静态源含对应 title（非软 404：body 不含「页面不存在」）；robots.txt Sitemap 行与实际地址一致；SPA 壳页现状如实记录：/studio 在 sitemap 且无 noindex（预期设计），/account /admin 不在 sitemap 且静态源 robots=noindex, nofollow。

## T5 无效 slug 真 404
- `/guides/no-such-guide-xyz`、`/templates/no-such-tpl-xyz` → HTTP 状态码 404 且返回品牌 404 页（title「页面不存在 - SeatMark 座签」、robots noindex, follow）。

## T6 基础属性 + SPA 导航 head 同步（浏览器）
- 抽样页静态源含 `<html lang=...>`（zh-CN 类）、charset=utf-8、viewport。
- 浏览器全新 incognito context 直开 / → SPA 点击导航至 /pricing、/templates：document.title/canonical/JSON-LD 跟随路由更新（utils/seo.ts 行为）；pageerror=0；storage 清理、context 关闭。

## 报告
- test-report.md 第 282 轮置顶章节 + 本计划；发现按 P 级定级。
