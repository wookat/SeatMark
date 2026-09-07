# 第 319 轮：PR #331 英文补全生产复测（/en/studio 英文化收尾 + /en/banquet 预设/桌名英文化）

环境：生产 https://www.seatmark.cn ，匿名。**部署判定**：curl /en HTML 引用的 JS 资产中出现 `Round-table banquet`（新 locale 键）；>20 分钟未上线则报告并停。
代码依据：en.ts 净增 ~90 键（三步引导、tooltip、水印条、导出弹窗、彩打清单、预设卡）；banquet.ts `defaultTableName(n)`＝en 时 `Table n`、`主桌/主位桌→Head Table`、`左侧桌/右侧桌→Left/Right Table`、`入口→Entrance`；**banquet 旧 localStorage 状态不迁移**——测试前清 `seatmark.banquet-state.v1`。

## T1 /en/studio 可见 UI 全英文（重点，录屏）
1. 清 localStorage 后开 /en/studio?demo=1。PASS：首次引导卡英文：「Three steps to a finished print / Pick a template / Your list is ready / Export & print / Export PDF or print from the preview toolbar」，无中文。
2. hover 预览工具栏：Print calibration、Print / vector PDF、Image PDF、PNG images 按钮 tooltip 英文（如 'Outputs via the browser print dialog…'、'Renders each page as a high-resolution image…'）。抽 2 个 tooltip 截图。
3. 打开 PNG 导出弹窗。PASS：说明段英文（'Export label by label: 26 labels in total…'、'A single image downloads directly…'、'Sign up for a 7-day Pro trial…'），无中文段。
4. 打开 Image PDF 导出弹窗。PASS：说明/预估体积/彩打检查清单（'Prints coming out black & white? Colour printing checklist (3 steps)'）英文。不实际导出 PDF（省次数），关闭。
5. PNG 带水印导出一次。PASS：toast 'PNG images exported (26 labels zipped)'；导出后水印提示条英文（'Want to remove the footer watermark?' 或 'Got your print…'），无中文。
6. P3 记录：插值拆分键拼接的句子如有语法/空格瑕疵（如 'Sign in free for 3 watermark-free exports per day…' 的数字前后空格）逐条记录。

## T2 /en/banquet 预设与桌名英文（清 seatmark.banquet-state.v1 后）
1. 预设卡 5 种名称+hint 英文：Round-table banquet / Long-table banquet / Head table + rounds / U-shape meeting / Classroom desks 及各自英文 hint。截图。
2. 点击 Round-table banquet 应用。PASS：画布桌名 Table 1…Table 8（非 1号桌）。
3. 点击 Head table + rounds。PASS：Head Table + Table 1…Table 6。
4. + Round table、+ portal（入口）、+ Stage、+ Dance floor 各一。PASS：新桌名 Table n 英文、入口标记 'Entrance'、舞台/舞池标记英文。

## T3 中文回归（Regression）
- 清 banquet 状态后开中文 /banquet：预设卡中文（圆桌宴会…），应用圆桌宴会后桌名「1号桌…」。
- 中文 /studio?demo=1（清 localStorage 触发引导）：引导卡中文「三步拿到成品」，PNG 导出 toast 中文「PNG 图片已生成」。

## T4 390px + pageerror
- CDP 390×844：/en/studio、/en/banquet scrollWidth==innerWidth；error/unhandledrejection=0（ResizeObserver 提示视为良性）。

收尾：清浏览器存储。产出：录屏（T1–T3）、test-report.md 第 319 轮置顶。
