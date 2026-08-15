# 第 323 轮：生产轻量回归（#335：逐标签 PNG 空白标签兜底升级，纯 utils 层，无 UI/文案变化）

环境：生产 https://www.seatmark.cn ，匿名（无登录、无发信），录屏。变更点：`app/src/utils/pngExport.ts` renderAndCutPage 重渲仍空白且有 rebuildHost 时重建离屏容器再渲最后一次（maxAttempts 2→3）。前置：轮询主包 ≠ index-DVSiEyAv.js（>20 分钟未部署则报告说明并停）。

## T1 中文 /studio?demo=1 逐标签 PNG 导出
- 清 localStorage 后开 /studio?demo=1，图片 PNG → 带水印导出（匿名）。
- PASS：toast **「PNG 图片已生成（26 张标签打包为 zip）」**；zip 落盘 ~/Downloads；`unzip -l` 26 张；解包抽 3 张（首/中/尾）用 Python PIL 检查非空白（非纯白：像素极值差 > 0 或非白像素占比 > 1%）+ 肉眼看一张截图。
- 同时记录：是否出现「PNG 生成失败：…标签渲染为空白」toast（预期无；若出现即 FAIL 并截图——兜底未挡住）。

## T2 /en/studio?demo=1 英文 PNG 导出回归
- PASS：toast **'PNG images exported (26 labels zipped)'** 英文；zip 落盘；无空白失败 toast。

## T3 pageerror
- 两次导出全程 CDP 采集 pageerror。PASS：0 条（良性 ResizeObserver 除外）。

收尾：清浏览器存储、无账号（本轮不登录）。产出：录屏、test-report.md 第 323 轮章节（不提交）。
