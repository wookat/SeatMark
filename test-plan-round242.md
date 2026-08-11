# 第 242 轮：#244 Firefox eink 逐标签导出 P2 修复 生产复测（r240 口径）

代码依据：#244（20dadbc）① pdfExport.ts:248-255 truncateClampedText 溢出判据 `scrollHeight > clientHeight + max(2, lineHeight*0.5)`（原 +1）；② pdfExport.ts:594-600/638 新增 `skipTruncationCheck`，pngExport.ts:442 逐标签链路启用。r240 基线：Firefox eink 逐标签 0/10 全失败「页面渲染不完整（右侧内容未绘出）」。环境：Playwright firefox-1438 headless + Chromium CDP 对照；生产 bundle `index-B7iIsDpm.js`（已翻转确认）；判据 toast（MutationObserver）+ download.save_as 落盘 + 产物像素。

## T1 P2 闭环核心（Firefox eink 逐标签）
- `/studio?template=eink800` + r231 eink234.xlsx（3 行）：800×480 预设逐标签导出。判据：成功 toast「PNG 图片已生成（3 张标签打包为 zip）」（r240 必失败）；zip 3 张、逐张 IHDR=800×480、恰 2 色 (0,0,0)/(255,255,255)、无 pHYs、md5 互异、非空白（ink>0.5%）。
- 追加 r240 ff240.xlsx（40 行）同预设：成功 toast、zip 40 张、抽 3 张同判据。
- 连续 3 次复跑 3 行导出：3/3 成功（r240 为确定性失败，防偶然通过）。

## T2 4096 自定义宽度逐标签（Firefox）
- 判据：≤120s 成功 toast；zip 逐张 IHDR 宽=4096（高 2458）。

## T3 eink 整页回归（Firefox）
- 800×480 预设整页导出：落盘 PNG 恰 800×480、纯二值、无 pHYs（skipTruncationCheck 只在逐标签启用，整页应保持原行为且成功）。

## T4 标准模板 Firefox 回归 + 真溢出截断
- 标准考场版 + ff240.xlsx：整页 PNG / 逐张 PNG / 图片版 PDF 各一次，成功落盘（同 r240 判据：整页非空白、逐张 40 张、pdfium p1 非空白）。
- 真溢出仍截断：自造 60 字超长姓名夹具导入 → 整页导出成功且该标签姓名区 ink 不溢出标签边界、与相邻行无叠压（导出成功 + 蒙太奇人工判读留档；若可在导出宿主检出「…」文本更佳）。判据核心：溢出字段不再导致导出失败，也不双行叠压。

## T5 Chromium 同口径回归
- eink 逐标签 800（3 行）+ eink 整页 + 标准模板逐张（40 行）：全部成功、产物判据同上；整页 #207/#208 截断防护抽测：整页路径仍走 isCanvasTruncated（代码位 pdfExport.ts:638 仅 skip 时绕过）——以标准模板整页导出成功 + 产物右侧有内容佐证（无法在生产触发人工截断，如实标注为行为抽测）。

## T6 隐私与收尾
- Firefox 会话网络监听：姓名标记串命中 0；pageerror=0；清 storage、关全部 context/tabs；写 test-report.md 第 242 轮章节（不提交）。
