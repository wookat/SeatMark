# 第 320 轮：生产冒烟（#331+#332 已上线：en-DLc9LKHc.js 含 'Round-table banquet' 与半角 '(left today: {n})'）

环境：生产 https://www.seatmark.cn ，匿名，录屏。

## T1 /en/studio（清 localStorage）
1. 开 /en/studio?demo=1。PASS：首次引导卡英文「Three steps to a finished print / Pick a template / Your list is ready / Export & print」。
2. 打开 PNG 导出弹窗。PASS：无水印按钮为半角 **"Export without watermark (left today: 1)"**（#332 修复判据；若仍 `（Left today: 1 ）` 则 FAIL）。
3. 同弹窗核 P3-2：`Choose an export method (starts immediately on click; …not counted)` 句尾冒号——代码定位 `PreviewArea.vue:1311` 硬编码全角 `：` 在 t() 之外。截图+抄录原句。
4. 带水印 PNG 导出一次。PASS：toast 'PNG images exported (26 labels zipped)' 英文。

## T2 /en/banquet（清 seatmark.banquet-state.v1）
- 五预设卡英文（Round-table banquet…）；点 Round-table banquet 后桌名 Table 1…Table 8。

## T3 中文回归（Regression，各扫一眼）
- /studio?demo=1：中文界面+引导；/banquet：预设中文、应用后「1号桌…」。

收尾：清浏览器存储。产出：录屏、test-report.md 第 320 轮章节（不提交）。
