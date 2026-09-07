# 第 273 轮：#276 分析上报剥离搜索词（telemetryPath）线上复测（生产，Chromium CDP）

代码依据（509fcc5）：`router/index.ts:162-175` `telemetryPath()` 剥离 `q`（保留其他 query 参数与 hash）；`:209-223` afterEach GA `page_view`（page_path）与百度 `_trackPageview` 均改用剥离路径；`index.html:73-86` 初始加载 cleanPath（URLSearchParams 删 q）→ GA config 显式 `page_path`/`page_location` + 百度 `_setAutoPageview(false)` + 手动 `_trackPageview(cleanPath)`。旧行为对照（r271 P4 实证）：GA dl/dr/dp 与百度 su/u 参数含 `?q=<搜索词>`。

部署确认（T0）：curl 生产 /templates HTML 含 `_setAutoPageview`（index.html 更新判据）且 entry hash 翻转（r271 为 `index-lywsFKJ6.js`）——每 60s 轮询 ≤30 分钟。

## T1 主判据：SPA 内搜索标记词零外发
- 全新 context 打开 /templates（无 q）→ 搜索框输入唯一标记词「考场273标记词」→ 等 8s（GA/百度批量上报窗口）→ 再 SPA 导航到某详情页（触发 afterEach 上报，dr/referrer 面也覆盖）→ 等 5s。
- 判据：全部第三方请求（google-analytics.com / hm.baidu.com / 其他非 seatmark.cn 域）URL 与 body 中，标记词的 UTF-8 百分号编码（%E8%80%83%E5%9C%BA273%E6%A0%87%E8%AE%B0%E8%AF%8D）及原文**零命中**（含 dl/dr/dp/su/u/ep 任意参数）；对照：地址栏 URL 本身应仍含 ?q=（功能未变，仅上报剥离——可区分）。
- 非敏感保留判据：点分类「考试」（产生 ?cat=exam）后导航触发上报 → 第三方请求中应仍见 `cat=exam`（telemetryPath 只删 q）。

## T2 首屏直开 ?q= 初始 pageview 零外发
- 全新 context 直接 goto `https://www.seatmark.cn/templates?q=考场273标记词` → 等 10s（懒加载分析脚本 idle 注入后发首个 pageview）。
- 判据：GA 首个 collect 请求 dl/dp 参数 = /templates（无 q）；百度 hm.gif su/u 参数无标记词；全部第三方请求零命中标记词编码/原文；页面搜索框已带入「考场273标记词」且结果为搜索后状态（功能不受影响）。

## T3 回归（Regression）
- 搜索功能：标记词无结果态正常（或结果正确）、清空恢复 222、「考试」+「考号」叠加提示「在「考试」分类中找到 2 款」不变。
- 防矫枉过正：SPA 导航 /templates→详情→/studio，GA `en=page_view` 请求数 ≥3 且 dp/dl 对应各页路径、百度 hm.gif ≥3（pageview 仍在发）。
- pageerror=0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 273 轮置顶章节 + 本计划 + #276 复测评论文案 + 如有 SKILL.md 建议。
