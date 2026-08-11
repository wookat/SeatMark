# 第 240 轮：Firefox 跨浏览器专项回归（生产，无代码变更）

背景：主链路此前仅 Chromium 验证；r127 修过 Firefox 导出字形顶部平切（pdfExport.ts neutralizeSyntheticBoldRareGlyphs/rasterizeRtlText，RTL 判定 pdfExport.ts:277-282）。环境：Playwright firefox-1438 headless，目标 https://www.seatmark.cn（bundle `index-j8zuZYS6.js`）。夹具 `/home/ubuntu/r240_fixtures/ff240.xlsx`（40 行：𱁬田240 / 维文 ئابدۇللا مۇھەممەت / 张伟240 / 考生04-40）。判据一律 toast（MutationObserver）+ page.on('download') 落盘 + 截图像素；页头 CTA 常驻「正在制作中」不作判据；文件名秒级 `-YYYYMMDD-HHMMSS`。

## T1 核心链路冒烟
- 首页加载：`document.title` 含 SeatMark、hero 截图非空白、pageerror=0。
- `/studio`：demo 名单预览 `.sheet-page` 渲染且截图可见内容；/templates 列出模板卡片，点击任一卡片跳 /studio 且模板名变化。
- 导入 40 行 xlsx：toast「Excel 导入成功 已读取 40 条数据」、预览「共 40 条」、映射面板显示 姓名/学号/班级。

## T2 导出三链路（标准模板）
- 整页 PNG（成图单位=按整页导出）：成功 toast、download 落盘 zip（名含 `-\d{8}-\d{6}`）、首张 PNG IHDR 宽高 >0 且合理（对应纸张比例）、非空白（非纯白像素 >0.5%）。
- 逐张 PNG：成功 toast、zip 张数=40、抽样 3 张互异非空白。
- 图片版 PDF：toast「图片版 PDF 已生成」、落盘 `.pdf`、pypdfium2 渲染第 1 页非空白（非纯白像素 >0.5%）。

## T3 字体渲染（𱁬 + 维文 RTL）
- 预览截图：𱁬田240 行与维文行字形可见（截图人工判读留档）。
- 导出逐张 PNG 中对应两张：ink 像素占比 >0.5% 且字形区域连续（无整字缺失/顶部平切——对比 Chromium 同素材同预设产物并排蒙太奇，允许引擎级差异，不允许缺字/重叠/平切）。

## T4 eink 精确像素（/studio?template=eink800，3 行小夹具亦可用 40 行）
- 800×480 预设导出：IHDR=800×480、恰 2 色纯二值、无 pHYs。
- 自定义宽度 4096：合理时间（≤120s/toast 判据）完成，IHDR=4096×2458。

## T5 打印链路冒烟
- 「打印 / 矢量 PDF」对话框可打开；headless firefox 的 window.print 若不可用如实标 untested。

## T6 隐私与收尾
- 全程网络监听：姓名（𱁬田240/维文串/张伟240）与文件名标记串在请求 URL/body 命中 0。
- pageerror=0（Firefox console error 一并记录）；清 storage、关全部 context/tabs；写 test-report.md 第 240 轮章节。
