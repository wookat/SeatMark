# 第 255 轮：#259 SPA 壳页内联启动骨架线上复测（生产，Chromium CDP）

代码依据：#259（9ff3369）`app/index.html:106-116`——`<div id="app">` 内新增 `<!-- boot-splash-start -->` 内联 `<style>` + `.boot-splash`（fixed 全屏 #f8fafc、spinner 28px indigo 顶边、文案「SeatMark 座签加载中…」、`role="status"` aria-label「页面加载中」）；`app/scripts/prerender.mjs:84-90,99-102,113-116`——`replaceAppMount` 用正则 `<div id="app">[\s\S]*?<!-- boot-splash-end --></div>` 整体替换：仅 `/studio` 与 shellPaths（/account、/admin）保留骨架，其余预渲染路由与 /404 注入正文（骨架应消失）。r253 基线：Slow 3G 首访 3s 时刻为纯背景空窗（r253_t1_loading.png）。

环境：CDP 29229 全新 incognito context；弱网沿用 r253 页级 CDP `Network.emulateNetworkConditions`（50000 B/s、RTT 400ms）。当前生产尚未部署（/studio HTML boot-splash=0、entry 仍 index-DNF7Ft0O.js）——先轮询部署。

## T0 部署确认
- 轮询 `curl /studio`：HTML 含 `boot-splash`（或 entry 哈希翻转）即部署完成；记录新 entry。若 ~30 分钟仍未翻转，如实报 blocked。

## T1 Slow 3G 首访 /studio 骨架可见（核心阳性）
- 全新 context + Slow 3G，goto /studio（wait_until='commit'）。
- 在 r253 空窗时间窗（约 3–6s）截图：判据 = 截图**像素可见** spinner + 「SeatMark 座签加载中…」文案（非纯背景）；DOM `document.querySelector('.boot-splash')` 存在。
- 挂载完成后（Excel input attached）：`.boot-splash` DOM=0 无残留；完成态截图无错乱、scrollWidth≤innerWidth；记录可用耗时（应与 r253 的 ~10s 同量级）。

## T2 正常网络无残留
- 新 context 正常网络 goto /studio，load 后 `.boot-splash` 计数=0；页面正常截图。

## T3 内容页阴性（预渲染未回归）
- `curl` 源码检查：`/`、`/templates`、任一 `/guides/*` 页、`/404`（用一个不存在路径取 404.html）——每页 `boot-splash` 出现次数=0 且 `<h1>` 正文在（如 / 的主标题、/templates 的「标签模板库」）。
- 浏览器正常网络打开 /templates 渲染正常（截图）。

## T4 /account 壳页
- `curl /account` 源码含 boot-splash（壳页保留骨架）；浏览器直达 /account：加载后正常渲染（非骨架残留），截图。

## T5 常规回归（Regression）
- /studio 导入 good40.xlsx（「已读取 40 条数据」+「共 40 条」）+ 逐张 PNG 导出成功（zip 40 张 1000×534 md5 互异 0 空白）。
- pageerror=0；请求标记串（张伟250/隐私学校250）命中 0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 255 轮章节 + 本计划；如有新坑给 SKILL.md 建议；#259 复测评论文案。
