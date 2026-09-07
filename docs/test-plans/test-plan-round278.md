# 第 278 轮：/papers 纸型库全链路专项（生产，无代码变更轮，Chromium CDP）

代码依据：`data/labelPapers.ts`（19 款、LABEL_PAPER_SHEET 210×297）；`views/PapersView.vue:41-43`（页首宣称 `{{ labelPapers.length }} 种`）、卡片规格行 `{{w}} × {{h}} mm · {{cols}} 列 × {{rows}} 行 · 每页 {{n}} 枚 · 直角/圆角`、切角筛选（全部/直角/圆角）；`views/PaperDetailView.vue:125-128` CTA「用此纸型开始排版」→ `/studio?paper=<slug>`、规格表+适配模板推荐；`views/StudioView.vue:126-160`：适配（recommended/usable）→ applyLabelPaper+toast「已按纸型锁定排版」；不适配且未显式指定模板 → 自动换最适配内置模板 toast「已换用适配该纸型的模板」；`LayoutPanel.vue:105`「不使用纸型（自由排版）」解锁、不兼容纸型 disabled+「与当前整页/折叠模板不兼容」；`PreviewArea.vue:216`「按整页导出（每页纸张一张 PNG）」+ 裁切线开关。

## T1 /papers 列表页
- 卡片总数=19=页首宣称「…等 19 种」；抽 5 款（a4-1up/a4-2up/a4-8up/a4-21up 类多格/一款圆角）卡片规格行与 labelPapers.ts 逐字核对（尺寸/列行/每页枚数/切角）。
- 切角筛选：「圆角」只剩 corner=rounded 款且数量=源数据圆角款数；「全部」恢复 19。
- 移动端 390×844：scrollWidth=390 无横溢。

## T2 纸型详情页
- /papers/a4-8up：规格表值=105×74.25 mm、2 列×4 行、每页 8 枚；适配模板推荐区含 recommendedTemplates 对应模板卡。
- curl 直开 /papers/a4-8up HTTP 200 且静态源含纸型名（预渲染）；/papers/no-such-paper-xyz HTTP 404+「404」文案。

## T3 纸型→工坊链路
- 详情页点「用此纸型开始排版」→ /studio?paper=a4-8up → toast「已按纸型锁定排版」且预览网格 2×4、纸张排版面板纸型选中 a4-8up。
- 不适配自动换模板（r83 回归）：直开 /studio?paper=a4-21up（先确认当前默认模板不适配，若适配则先选整页类模板再直开）→ toast「已换用适配该纸型的模板」且换到的模板按纸型锁定（每页 21 枚）。若默认模板恰适配则改为验证 toast「已按纸型锁定」并如实记录未触发自动换分支的原因与替代口径（清 localStorage 后以 fullPage 模板进入再带 paper）。
- 自由排版解锁（r133 回归）：纸型锁定后在「纸张排版」选「不使用纸型（自由排版）」→ 行列/尺寸字段恢复可编辑（锁定提示消失）。

## T4 纸型约束下整页导出
- /studio?paper=a4-21up（或换到的适配模板）→ 载入演示数据（?demo=1 或数据面板演示按钮）→ 开「裁切线」→ 导出方式选「按整页导出（每页纸张一张 PNG）」→ 导出。
- 判据：PNG 尺寸比例≈210:297；用 PIL 沿网格切缝位置抽验像素——3 列×7 行（a4-21up）切缝 x/y 坐标处存在裁切线/边界（与 labelPaperGeometry 推导的 mm→px 坐标一致，容差 ±3px）；首格与末格内容非空白。

## T5 跨模板切换不残留（r76 回归）
- 纸型锁定态下切换到另一适配模板 → 标签尺寸仍=纸型单格（携带）；再选「不使用纸型」后切换模板 → 标签尺寸=模板默认（不残留锁定）。

## T6 隐私与常规
- 全程第三方请求扫描演示名单姓名（取导出页面首个姓名）零命中；pageerror=0；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 278 轮置顶章节 + 本计划 + SKILL 建议如有。
