# 第 258 轮：浏览器缩放与大字号可用性专项（生产，Chromium CDP）

无代码变更轮（可用性专项）。**缩放口径（报告如实注明）**：浏览器 Ctrl+/- 缩放在 Chromium 中等效于「布局视口按倍率缩小 + DPR 按倍率放大」，故用 CDP `Emulation.setDeviceMetricsOverride`：物理窗口基准 1280×800，zoom z ∈ {1.25, 1.5, 2.0} → width=round(1280/z), height=round(800/z), deviceScaleFactor=z。**大字号口径（近似，如实注明）**：Chromium 无法直接 CDP 模拟「浏览器最小字号/字体大小」设置，用 `document.documentElement.style.fontSize='20px'`（16px 的 125%）近似评估 rem 布局稳健性。

判据参照：r246 已建立 scrollWidth≤innerWidth 无横溢判据；导出走 html2canvas 独立渲染管线（pngExport.ts），产物尺寸应与页面缩放无关（1000×534）。

## T1 四页 × 150%/200% 破版检查
- 页面：`/`、`/studio`、`/templates`、`/seating`；每页在 z=1.5 与 z=2.0 下：
- 判据：`document.documentElement.scrollWidth <= window.innerWidth`（无横向溢出）；关键按钮可见（/ 的「开始制作」CTA、/studio 的「打印 / 矢量 PDF」与「图片 PNG」、/templates 的搜索框、/seating 的「完全随机」）——`boundingBox` 非 null 且宽高>0、在文档内可滚动到达；截图逐页留档，人眼可核（文字不重叠以截图为准，DOM 无法直接断言重叠——遇可疑处 zoom 局部核对）。

## T2 /studio 200% 全链路导入+导出（核心）
- z=2.0 下导入 good40.xlsx：toast「已读取 40 条数据」+「共 40 条」。
- 逐张 PNG 导出：产物 zip 40 张、每张 1000×534、非空白、md5 全互异；与 100% 基线（r255 `~/r255_dl/perlabel.zip` 或本轮重跑基线）**逐张 md5 对比一致**（导出管线不受页面缩放影响的强判据；若 md5 不一致但尺寸/非空白一致，如实降级注记并分析差异来源）。

## T3 大字号近似（fontSize 20px）
- /studio 设 `documentElement.style.fontSize='20px'` 后：无横向溢出、关键按钮可点、导入映射面板正常（「共 40 条」在）；截图。注明近似口径。

## T4 200% 下弹窗可达性
- /studio z=2.0 打开导出选择弹窗（图片 PNG）：弹窗按钮（带水印/无水印/取消）boundingBox 完全在视口内，或弹窗容器可滚动使按钮可达（scrollTo 后可见）；点击「带水印」能实际触发下载（T2 已证）。配额提示区（今日剩余 N 次）可见。截图。
- Esc 关弹窗正常（dialog=0）。

## T5 常规
- pageerror=0；请求标记串（张伟250/隐私学校250）命中 0；storage 清理、context 全关、常驻 Chrome 不动。

## 发现问题
- 破版/按钮不可达 = P2–P3（按影响范围）；文字轻微拥挤 = P4 观察项；均给最小复现（页面+倍率+元素）。

## 报告
- test-report.md 第 258 轮章节 + 本计划 + 如有 SKILL.md 建议。
