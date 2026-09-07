# 第 275 轮：#277 搜索词不进地址栏（sessionStorage 根治外发）线上复测（生产，Chromium CDP）

代码依据（06fb8ba）：`TemplatesView.vue:30-47` `seatmark.templates-search.v1` sessionStorage 存取（空词 removeItem）、搜索词不再写 route.query.q（cat/sub 仍走 URL）、带 ?q= 旧链接带入后 router.replace 剥离；`index.html:72-86` head 最早内联脚本：直开 ?q= 在第三方脚本前转存 sessionStorage + history.replaceState 剥离。r273 FAIL 对照：GA dl/dr、ep.search_term（view_search_results）、百度 su、sp0.baidu.com l、Sentry 面包屑 5 通道。

部署确认（T0）：curl 生产 /templates HTML 含 `seatmark.templates-search.v1` 且 entry 翻转（r273 为 `index-B5y8Q7W3.js`）——每 60s 轮询 ≤30 分钟。

## T1 主判据：SPA 内搜索零外发（r273 口径）
- 全新 context 打开 /templates → 输入标记词「考场275标记词」→ 等 8s → 点分类「考试」（cat=exam）→ 再清词进详情页 → 等 5s。
- 判据：①搜索期间地址栏**始终无 ?q=**（对照 r273 为有）；②全部第三方请求（google-analytics/hm.baidu/sp0.baidu/sentry.io 等非 seatmark 域）URL 参数（dl/dr/dp/su/u/l/ep.*）与 body（Sentry envelope）**零命中**标记词原文/百分号编码；③`sessionStorage['seatmark.templates-search.v1']`=标记词。

## T2 首屏直开 ?q= 旧链接兼容 + 零外发
- 全新 context goto `https://www.seatmark.cn/templates?q=考场275标记词` → 等 10s（懒加载分析脚本发首个 pageview 后）。
- 判据：①地址栏被剥离为 `/templates`（无 q）；②搜索框带入「考场275标记词」且结果为搜索后状态；③第三方请求全量零命中（含 GA 首个 dl/dp、百度 su/u、sp0.baidu l、**不应再出现 en=view_search_results/ep.search_term**）。

## T3 保状态回归（r79）
- T1 语境：搜索「桌牌」→ 点某模板卡进详情 → 浏览器 go_back() → 搜索框仍为「桌牌」且结果为搜索后集合（25 款）。
- 刷新 /templates（p.reload）→ 搜索框仍为「桌牌」。
- 判据：两处搜索词与结果均恢复；地址栏全程无 ?q=。

## T4 常规回归（Regression）
- cat/sub 仍走 URL：点「考试」→ 地址栏 ?cat=exam；直开 `/templates?cat=exam` 分类选中且卡片=31。
- 叠加与清空：「考试」+「考号」提示「在「考试」分类中找到 2 款」；无结果态「清除搜索条件」恢复 222 且 sessionStorage 键被 remove。
- pageerror=0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 275 轮置顶章节 + 本计划 + #277 复测评论文案 + 如有 SKILL.md 建议。
