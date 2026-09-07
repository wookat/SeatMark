# 第 220 轮：/seating 行列边界形态走查（补 r219 NumberField 覆盖缺口）

代码依据：NumberField 由 change 事件（onChange→clampValue）或 hover 加减按钮（aria-label=增大/减小，nudge→clampValue）更新（NumberField.vue:17-38）；行列限值 rows min=1 max=20、cols min=1 max=16（SeatingView.vue:454/459）；过道=「过道位置」区第 n-n+1 列间按钮（toggleAisle:104-109，渲染 `.seating-aisle`:696）；溢出提示 amber「超出 N 人排不下，请增加行列数」（:508-513，overflowCount:355）；缩格后 seats 只取前 rows×cols 个 entries（:156-174），print host（:713-735）与 toDeskLabels（:396-419，filter s.name）同源——预期溢出人被丢但有可见提示，如实定级。

夹具：50 人名单「边界审计001-050号220」（每行一名，无性别列）。

## T1 自定义行列 5×10 满座（UI 键入驱动）
- 真实键入方式驱动 NumberField：focus → 全选 → type '5' → Tab（触发 change）；列数同法键入 '10'。断言 input.value 与「已输入 50 人 / 座位 50 个」文本；网格 50 座全部有名（无 '—' 空座）；截图。

## T2 溢出：列数改 10→8（40 座 < 50 人）
- 断言 amber 文本恰为「超出 10 人排不下，请增加行列数」（截图证可见）；网格仅渲染前 40 人（第 41 人「边界审计041号220」不在网格）。

## T3 缩格丢人链路一致性（在 40 座溢出态下）
- 打印：点「打印座位表」，在 1.35s 窗口 printToPDF → pdftotext 断言含 边界审计040号220、**不含** 边界审计041号220（溢出人被丢出打印）。
- 桌贴联动：点「一键生成对应桌贴」→ /studio 数据行数=40、含 040 号不含 041 号。
- 定级依据：页面有溢出提示=非静默；若提示缺失或打印/桌贴含错误数据则为缺陷。

## T4 极端值 clamp
- 排数键入 '0' → 回写 1；键入 '99' → 回写 20；列数键入 '99' → 回写 16；min/max 边界处点加/减按钮值不越界（20 处点增大仍 20，1 处点减小仍 1）。每项断言 input.value 具体值。

## T5 过道
- 5×10 形态下点「第 2-3 列间」+「第 7-8 列间」→ 断言 `.seating-grid .seating-aisle` 每排 2 个（共 10 个）且按钮高亮；截图；再点一次取消 → 归零。

## T6 收尾
- 全程 pageerror=0；清 storage + 关全部 tab；第 220 轮置顶追加 test-report.md（基于最新 main a1644ec）。
