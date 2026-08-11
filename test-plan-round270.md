# 第 270 轮：#273 懒路由分包加载失败自动整页跳转恢复 线上复测（生产，Chromium CDP）

代码依据（50939fe）：`router/index.ts:168-177` `router.onError`——三种浏览器 chunk 错误文案正则命中时 `sessionStorage.setItem('chunk-reload:'+to.fullPath,'1')` 后 `window.location.assign(to.fullPath)`；同路径已有标记则 return（防真离线刷新循环）；`:179-183` afterEach 导航成功即 removeItem 清标记。r268 旧行为对照：恢复网络后再点「模板」静默停留 /studio。

部署确认（T0）：entry hash 翻转（r268 为 `index-BVh4bXov.js`）——curl /studio 每 60s 轮询（≤30 分钟）。

## T1 主判据（r268 P4 闭环）：离线失败 → 恢复 → 自动整页跳转
- 全新 context 打开 /studio；CDP offline=true；点击导航「模板」（导航失败，可能已触发一次 location.assign——离线下整页加载失败/SW 壳页，如实记录）→ offline=false 恢复 → 再点「模板」。
- 判据：最终 URL=`https://www.seatmark.cn/templates` 且页面渲染模板列表内容（截图）；对照 r268 旧行为为停留 /studio 无反应——可区分。期间发生整页跳转（`window.performance.navigation`/新文档加载或 goto 检测）如实记录跳转次数。

## T2 防循环：真离线下重复点击
- 全新 context 打开 /studio；offline；点「模板」→ 等 3s → 再点「模板」→ 等 3s。
- 判据：`sessionStorage['chunk-reload:/templates']='1'` 已置位；第二次点击**不再**触发新的整页跳转（页面 document 不再重载——用 window 标记变量法：跳转前设 `window.__alive=1`，若第二次点击后仍在则未重载）；无无限刷新（观察窗口内导航次数 ≤1）；SW 离线壳页/错误表现如实记录截图。

## T3 标记清理
- T1/T2 后恢复网络成功进入 /templates（含整页跳转路径）：判据 `sessionStorage.getItem('chunk-reload:/templates')===null`（afterEach removeItem 生效）。

## T4 回归（Regression）
- 正常在线导航 /studio→/templates→/seating→/studio：全程 SPA（用 `window.__alive` 标记证明 document 未重载）、无整页刷新。
- xlsx 预取冒烟：/studio load 后 5s 内见 vendor-xlsx 拉取、首导 40 行 ≤0.2s「共 40 条」。
- pageerror=0（离线窗口内资源级 console 错误如实记录不计）；请求标记串（张伟270 如使用）命中 0；storage 清理（含 chunk-reload 残留）、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 270 轮置顶章节 + 本计划 + #273 复测评论文案 + 如有 SKILL.md 建议。
