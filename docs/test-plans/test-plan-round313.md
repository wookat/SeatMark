# 第 313 轮：PR #322 生产复测（/banquet 首次 PNG 导出损坏修复：data-export-ink + rebuildHost 兜底重渲）

前置：等生产 bundle ≠ index-DQa2HNr9.js；确认新 bundle JS 含 `data-export-ink` 标记。全程匿名，导出物存 /home/ubuntu/r313/。

背景（#312 P2）：A4 横向 PNG 首次导出偶发损坏——尺寸 3509×2481 正确但全部文字挤最左缘（首个非白列=1）、无餐桌图形，且被静默交付。#322 修复：导出页场地图盒加 `data-export-ink`（BanquetView.vue L1060+），domExpectsRightInk 选择器扩展（pdfExport.ts L188），PNG/PDF 均接入 rebuildHost 卸载重挂兜底重渲；连续失败报「页面渲染不完整（右侧内容未绘出），请重新导出」。

## T1 重点：冷启动首次 PNG 导出 ×3（复现 #312 场景）
每次循环：CDP 清空 localStorage → 硬刷新 /banquet →「用演示名单」→ 布局预设 → 一键自动分配 → A4 横向 → 首次导出 PNG（带水印）→ 若弹检查弹窗则「忽略问题，继续导出」。
- PASS：每次导出的 PNG 首个非白列 >100（正常左边距 ≈284）、含餐桌圆形图形、底边水印在；或 UI 明确报「页面渲染不完整…请重新导出」错误（兜底触发，非静默坏图）。
- FAIL：任一 PNG 首个非白列 <100 / 无餐桌图形（静默坏图 = 修复无效）。

## T2 连续多次 PNG 导出
同一会话内不清状态连续再导 PNG ×2：同 T1 判据。

## T3 PDF 回归（改走 exportPagedPdf 新路径）
- A4 横向 PDF：pdfinfo = 841.89×595.276 pts，栅格含餐桌图形、左缘完整。
- A3 纵向 PDF：不报错，pdfinfo = 841.89×1190.55 pts。
- A3 横向 + 勾选「导出带分组颜色」PDF：pdfinfo = 1190.55×841.89 pts，栅格含分组彩色芯片 + 底部「分组图例」。
- FAIL：任一导出报错、尺寸错、图形缺失或无图例。

## T4 /studio 冒烟（domExpectsRightInk 选择器扩展无回归）
标准考场版 + 演示数据 → 整页 PNG 导出一次：产出图含多枚标签、右侧 40% 非纯白、无「页面渲染不完整」误报。

硬判据：全程 pageerror=0。产出：录屏、报告第 313 轮置顶、导出原始物 /home/ubuntu/r313/。
判据说明：损坏为偶发，3 次冷启动通过不能证明「彻底修复」，只能证明「未复现且无静默坏图路径」——报告中如实标注；rebuildHost 失败分支无法在生产强制注入，标 untested。
