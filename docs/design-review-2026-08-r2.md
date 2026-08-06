# 站点视觉走查报告 · 2026-08（第三轮）

> 走查对象：本地 main 构建（PR #24–#38 全合并后）全部路由：`/`、`/studio`、`/templates`、模板详情、`/papers`、纸型详情、`/guides`、教程文章、`/seating`、`/pricing`、`/account`、`/admin`、`/terms`、`/privacy`、404；
> 视口：1280 / 768 / 390 三档；工具：Chrome CDP + Playwright（截图 + 程序化横向溢出检测）。
> 本轮重点：新增功能（智能适配提示条、演示数据、无水印配额角标、水印导出选择、组合字段、排座页）的视觉回归与一致性。

## 一、总体结论

- **15 条路由 × 3 档视口共 45 项横向溢出检测全部为 0px**（`scrollWidth - clientWidth`，结果存 `overflow.json`）。
- 新增功能整体风格与既有 token 一致（brand/emerald/amber 语义色、圆角 lg、slate 中性灰），未发现阻断性视觉回归。
- 本轮发现问题以细节级为主，共 6 项：3 项已当轮修复，3 项记录待下轮。

## 二、问题清单

| # | 页面 / 位置 | 视口 | 问题 | 级别 | 处理 |
|---|---|---|---|---|---|
| 1 | 工坊「导入数据」文件行 | 390 | 「演示数据」徽标位于 `truncate` 段落内部，窄屏被截断为「演…」，徽标语义丢失 | P1 | ✅ 已修复：文件名与徽标改为 flex 布局，文件名单独 `truncate`、徽标 `shrink-0`（截图 `research-assets/r3/fix-demo-badge-390.png`） |
| 2 | 工坊「导入数据」meta 行 | 390 | 「共 24 条数据」在数字与「条数据」之间断行，出现「共 24 / 条数据」拆行 | P2 | ✅ 已修复：「共 N 条数据」整体加 `whitespace-nowrap` |
| 3 | 工坊预览工具栏 chips | 全部 | 未导入数据时仍显示灰色「0 页」chip，与左侧「N 个标签」chip 的有数据才显示逻辑不一致，空状态出现无意义的「0」 | P2 | ✅ 已修复：页数 chip 增加 `totalPages > 0` 条件（截图 `research-assets/r3/fix-empty-chips-1280.png`） |
| 4 | 全局 Toast（右上） | 1280 | Toast 容器 `lg:top-16` 恰好覆盖工坊预览工具栏的「图片版 PDF」导出按钮（截图 `research-assets/r3/studio-demo-1280-s1.png`）；390 下弹出时也会盖住导出选择弹窗标题（`research-assets/r3/export-modal-390.png`）。虽为 3s 瞬态可关闭，但覆盖的是主操作 | P2 | 📋 记录：属定位策略层面（建议下轮评估 toast 移至底部居中，或工坊页内避让工具栏），本轮不动 |
| 5 | 弹窗组件 ModalDialog | 全部 | 弹窗不支持 Esc 关闭（键盘可达性缺口，TDesign/AntD Dialog 均默认支持） | P2 | ✅ 已修复：ModalDialog 增加全局 Escape 监听，`open` 时关闭（Playwright 实测 Esc 后弹窗关闭） |
| 6 | 工坊左栏步骤编号 | 全部 | 照片步骤按需隐藏时步骤显示 1、2、4 跳号（上轮已记录，仍存在） | P2 | 📋 记录：组件逻辑层面，维持上轮结论不动 |

## 三、新增功能视觉一致性核对（本轮重点）

| 新增元素 | 核对结论 |
|---|---|
| 智能适配提示条（FitSuggestionBanner） | amber-50/200/800 警示语义色 + 内联 SVG 三角图标，与既有「高亮缺失」amber 语义一致；flex-wrap 布局窄屏可换行，无溢出 ✅ |
| 「无水印 N」配额角标 | emerald（有剩余）/amber（用尽）语义正确；`text-[9px]` 角标定位 `-top-2 -right-1.5` 不裁切；空状态按钮 disabled 时角标仍高亮，观感可接受 ✅ |
| 演示数据（按钮 + 徽标 + 缩略预览） | 空状态骨架卡 + 「先用演示数据看看效果」入口清晰；徽标截断问题见问题 #1（已修复）✅ |
| 水印导出选择弹窗 | 双选项卡片式布局，选中态 brand-50 底 + 勾选图标，层级清晰；预估体积加粗恰当；Esc 关闭见问题 #5（已修复）✅ |
| 组合字段 / 排版顺序提示条 | brand-50/100/700 信息语义，与 FitSuggestionBanner 的 amber 形成正确的语义区分 ✅ |
| 排座页（/seating） | 页脚、容器宽度与全站一致；390 无溢出 ✅ |

## 四、程序化检测结果（横向溢出）

`document.documentElement.scrollWidth - clientWidth`，15 条路由 × 3 档全部为 **0**：

`/`、`/studio`、`/templates`、`/templates/standard`、`/papers`、`/papers/a4-portrait`、`/guides`、`/guides/exam-seat-label-batch-print`、`/seating`、`/pricing`、`/account`、`/admin`、`/terms`、`/privacy`、404 页。

## 五、对比度抽查

- 暗色模板卡（黑白对比版等）内白字与既有截图核对无回归；
- toast 正文 slate-500 于白底约 5.5:1、标题 slate-900，满足 WCAG AA；
- amber-800 于 amber-50 底（适配提示条正文）约 7:1，达标；
- 配额角标 emerald-700 于 emerald-100 底约 5.6:1，达标。

## 六、截图索引（docs/research-assets/r3/）

- `studio-1280-s0.png` 工坊空状态（1280）
- `studio-demo-1280-s1.png` 演示数据载入后（toast 覆盖工具栏问题现场）
- `studio-demo-390-settings.png` 390 设置栏（修复前「演…」徽标现场）
- `fix-demo-badge-390.png` / `fix-empty-chips-1280.png` 修复后验证
- `export-modal-1280.png` / `export-modal-390.png` 水印导出选择弹窗
