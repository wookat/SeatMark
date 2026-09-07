# 第 326 轮：生产复测（#338：预热改 `<link rel="preload" as="style" crossorigin>`，修 Vary: Origin 缓存键不匹配）

依据：`pdfExport.ts:214-241`（preload 复制原 link 的 crossorigin，onload/onerror 落定后移除；调用点 `:741` settleWithin 10s 不变）。环境：生产，匿名，CDP 复用 r324b/r325 实验器。前置：轮询主包 ≠ index-T85w1BUG.js，且新 pngExport 分包 curl 含 `preload` 预热代码。

## T1 缓存命中实证（直接判据）
- 清缓存全速导出 1 次，采集 Network 时间线。PASS：预热请求（type=Preload 或 Stylesheet/Other，带 Origin 头）发出后，克隆文档的 Stylesheet 请求 `fromDiskCache=true` 或 `requestServedFromCache` 事件（transfer 走缓存）。FAIL：克隆 Stylesheet 仍走网络（fromDiskCache=false 且无 servedFromCache）。

## T2 清缓存 + 40KB/s+300ms ×3（修复前 3/3 失败）
- PASS：3/3 成功 toast「PNG 图片已生成（26 张标签打包为 zip）」，无「渲染为空白」。

## T3 清缓存全速竞态 ×10（修复前 9 成 1 败）
- PASS：10/10 成功。任一失败即 FAIL 并采集该次网络时间线 + 克隆请求头以再定位。

## T4 正常 /studio?demo=1 UI 逐标签导出回归（录屏 UI）
- PASS：中文成功 toast、zip 落盘 26 张、PIL 全量非空白 + 抽样拼图。

## T5 pageerror
- PASS：除已知每页加载 1 条基线外无新增。

收尾：清缓存/存储、还原限速、关多余 tab。产出：录屏、test-report.md 第 326 轮章节（不提交）、#338 建议评论。
