# 第 253 轮：弱网与网络中断稳健性专项（生产，Chromium CDP）

代码依据：`app/src/main.ts:32-44`（router.isReady 后挂载 + SW 注册 `/sw.js` scope `/`）；`app/vite.config.ts:48-75`（workbox：导航 NetworkFirst timeout 4s、离线 precacheFallback `/index.html` 壳、plangothic 生僻字库不预缓存）；`app/index.html:68-95`（GA4/百度统计/bdstatic 在 idle 后注入，带缓冲队列——设计上不阻塞）；持久化 key `seatmark.workspace-roster.v1` / `seatmark.workspace-template.v1`（`stores/workspace.ts:34,56`）；配额 key `seatmark.clean-export-usage.v1`。

环境：常驻 Chromium CDP 29229（不动本体），全新 incognito context；弱网用 CDP session `Network.emulateNetworkConditions`（download/upload ≈ 400kbps=50000 B/s，latency 400ms）；断网用 `context.set_offline(True)`（若对 CDP context 无效则 CDP emulate offline=true，落地时如实注记所用机制）。夹具 `~/r250_fixtures/good40.xlsx`（张伟250/隐私学校250 标记）。产物 `~/r253_dl/`。

## T1 Slow 3G 首访 /studio
- 新 context + 新页，先对 page CDP session 挂 Slow 3G，再首次 goto /studio（缓存冷：incognito 新 context 天然冷）。
- 判据：≤120s 内出现模板/导入 UI（「导入」按钮与预览区 DOM 可见）；无永久白屏（body 有可视文本）；加载中途截图 1 张 + 完成截图 1 张，scrollWidth≤innerWidth 无错乱；记录可用耗时（首访到可交互）。

## T2 弱网导入 + 逐张 PNG 导出
- 同一弱网页面导入 good40.xlsx：toast「已读取 40 条数据」+「共 40 条」；记录导入耗时。
- 逐张 PNG 导出：expect_download 落盘 zip，40 张 1000×534、非空白、md5 互异；记录导出耗时。
- 判据：两者成功，且耗时与正常网络同量级（对照：另开正常网络 context 跑同流程计时，弱网耗时 < 3× 正常）。

## T3 完全断网后本地链路 + 路由切换
- 新 context 正常网络加载 /studio、导入 good40 → set_offline(True)。
- 断网下再导入一次（换 ff240.xlsx 或重导 good40）+ 逐张 PNG 导出：判据同 T2 成功（强验证数据不出浏览器）。
- 断网下点击导航切到 /templates：判据 = 页面非白屏（有可视文本/离线壳），截图；不得死路（可返回 /studio）。注记 SW 缓存命中 or 壳页回落。

## T4 导出中途断网
- 正常网络导入 300 行 big300.xlsx，启动逐张 PNG 导出，进度出现「正在渲染第 N/13 页」后立即 set_offline(True)。
- 判据：导出仍成功（download 落盘、zip 300 张完整非空白）。

## T5 断网恢复
- T3/T4 context set_offline(False) 后 reload /studio：页面正常渲染、roster 持久化仍在（页面显示「共 N 条」且 localStorage `seatmark.workspace-roster.v1` 非空）。

## T6 遥测挂起不阻塞
- 新 context 对 googletagmanager.com / hm.baidu.com / zz.bdstatic.com 三域 route 挂起（永不 fulfill，30s 后 abort），正常网络加载 /studio。
- 判据：页面在遥测挂起期间可正常交互（打开导出弹窗、切换缩放档，每步响应 <2s）；无 UI 卡死。

## T7 常规
- pageerror：断网场景允许资源加载失败类报错，不允许未捕获应用异常（逐条列出并分类）；全程请求 body/url 搜 张伟250/隐私学校250/𱁬田240/张伟247 命中 0；结束清 storage、关全部自建 context，常驻 Chrome 存活。

## 报告
- test-report.md 第 253 轮章节 + 本计划 + SKILL.md 建议（弱网/断网测法沉淀）。
