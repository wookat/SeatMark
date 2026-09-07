# 第 287+288 轮：#287 本地日期口径复测 + #289 分隔符换行/分散对齐复测（生产，CDP）

部署确认（已完成）：entry `index-BdUDE_2p.js` 含本地日期 `padStart(2,"0")}-${String(t.getDate())…` 拼接；CSS `index-Drr90_HC.css` `.label-field__body` = `word-break:keep-all;overflow-wrap:anywhere`；`StudioView-CAoR79uO.js` 含「分散对齐」「textAlignLast」「Segmenter」。

代码依据：`quota.ts:18-22` / `PreviewArea.vue:320-324` todayStr 改本地分量；`main.css:361`；`TemplateDesigner.vue:168`（ALIGN_OPTIONS 加 justify，水平对齐下拉在选中字段属性面板 :1781）；`LabelCard.vue:306`（justify → textAlignLast:justify）；`pdfExport.ts:369-425`（rasterizeJustifiedText：单行、无 caption、无 img 的 justify 字段导出前 Canvas 按字素簇等距预栅格化）。

## R287-T1 主判据（r286 场景反转）
- 新 context timezone_id=Asia/Shanghai + init script 偏移 Date 至本地次日 01:30（UTC 未跨日，自检 `new Date().toString()` 为次日 01:30、`toISOString` 仍当日）。
- 预写 `seatmark.clean-export-usage.v1`={date: UTC今日(=本地昨日), used:1} → /studio?demo=1 导出弹窗应显示「无水印导出（今日剩余 1 次）」（r286 旧行为=0 次可区分），无水印导出成功下载且写回 {date: 本地今日(=UTC明日字符串), used:1}。
- 导出后 `seatmark.post-export-share-prompt.v2`.date = 本地今日。

## R287-T2 回归
- 正常时钟单页签：第 1 次无水印成功、第 2 次拦截（引导弹窗、无下载）。
- 双页签同步（#282）：A 消耗后 B 不刷新显示「剩余 0 次」。
- 容错：预写 {date:'2099-01-01',used:99}、{date:'garbage',used:null} → 均「剩余 1 次」无锁死。

## R288-T1 分隔符优先换行
- /studio 导入名单含「张三三 网络科技公司」类含空格长文本字段（用自定义模板窄文本字段 maxLines=2 或既有含备注列模板）；断言预览 DOM 该字段 computedStyle word-break=keep-all、overflow-wrap=anywhere，且截图显示在空格处折行（第一行=空格前段）。
- 无空格长串（如 20 个汉字连写）仍折行不溢出（scrollWidth ≤ clientWidth，无横溢）。

## R288-T2 分散对齐（设计器→预览）
- 设计器（TemplatePicker「新建」）选中姓名文本字段 → 「水平对齐」下拉应含「分散对齐」选项；选择后保存。
- 预览：两字名「张三」computedStyle textAlignLast=justify，截图中两字分列字段左右两端（与「居中」形态可区分：居中时两字相邻居中）；三字名与两字名首尾 x 对齐。

## R288-T3 导出所见即所得（主判据，若导出居中即 P2）
- 分散对齐字段带水印导出 PNG → PIL 测量姓名字形横向分布：最左字形起点贴近字段左缘、最右字形终点贴近字段右缘（vs 居中实现会聚拢在中部——量化：字形外接盒宽度/字段宽度 > 0.9，居中形态约 = 字宽和/字段宽 < 0.6）。
- 图片版 PDF 抽 1 页同判据（pdf 内嵌 PNG 提取或渲染截图）。
- 带 caption 前缀或 maxLines>1 已换行字段按设计跳过预栅格化——如实记录形态即可（不判 fail）。

## R288-T4 回归+常规
- 左/中/右对齐预览与导出正常（抽验居中默认模板导出非空白）。
- pageerror=0、demo/测试名单第三方零外发、storage 清理、context 全关。

## 报告
- test-report.md 置顶追加第 287、288 两章；发现按 P 级定级。
