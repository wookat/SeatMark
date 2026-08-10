# 第 172 轮：视觉稳健性专项——显示设置（缩放/DPR/强制配色/高对比/减动效）下渲染与导出一致性（生产站，无代码变更，bundle index-BTp5Le9S.js）

代码依据：`app/src/utils/pngExport.ts` 渲染倍率完全由 `pngRasterScale`/`exactPixelScale` 决定（L159-176、L330-336、L410-418），**全文件无 devicePixelRatio/页面缩放引用**——预期导出产物不随页面缩放与 DPR 变化（判据：与第 170/171 轮基线逐值一致 2481×3509 @ pHYs 11811）。减动效：`app/src/assets/main.css` L233 `@media (prefers-reduced-motion: reduce)` 将 `.reveal-init` 直接置为可见；`app/src/views/HomeView.vue` L18 matchMedia 命中时立即加 `reveal-in` 跳过 IntersectionObserver。仓库无 forced-colors/prefers-contrast 专门样式（行为=浏览器默认强制配色映射，验可读性即可）。

## T1 页面缩放 150% / 80%（Emulation.setPageScaleFactor）
- /studio?demo=1（课桌姓名贴）分别置 1.5 / 0.8：截图核验预览区布局无破损（标签网格完整、无重叠溢出）；每档各导出整页 PNG。
- 断言：两档产物 IHDR 均 **2481×3509**、pHYs=**11811 px/m**，与 100% 基线（r170）逐值一致；两档产物像素内容一致（尺寸+非空白+抽样像素/文件差异小）。若尺寸随缩放漂移即 fail。

## T2 高 DPR 模拟（deviceScaleFactor=2、3，Emulation.setDeviceMetricsOverride）
- 同页 DPR=2 与 DPR=3 各导出整页 PNG。
- 断言：产物仍 **2481×3509 @ 11811 px/m**（导出像素尺寸不随 DPR 变化）；预览截图清晰无布局破损。

## T3 forced-colors: active + prefers-contrast: more（Emulation.setEmulatedMedia）
- /、/studio、/templates 三页逐页模拟：截图核验正文/按钮文本可见可读、关键元素（导航、主 CTA、预览区/缩略图）不消失；pageerror 0。
- 断言以截图像素为准（文本带非空白）；forced-colors 下导出一份整页 PNG 复核产物不受影响（仍 2481×3509 @ 11811、内容非空白——产物走 canvas 序列化，理论不受 UA 强制配色影响，需实证）。

## T4 prefers-reduced-motion: reduce
- 模拟后打开 /（HomeView reveal 交错动画路径）：断言首屏及滚动后区块立即可见（`.reveal-init` 均含 `reveal-in`/opacity=1，截图非空白）；顺带 /studio 打开导出对话框功能正常。

产出：test-report.md 第 172 轮（93→94 节）、截图 r172_*、产物 /home/ubuntu/r172_dl/。headless 不录屏。每个导出脚本内重连 browser WS 重设 downloadPath。收尾清理模拟状态（重置 metrics/media）+ 关闭测试 tab。
