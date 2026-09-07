# 第 285 轮：#285 粘贴名单剥离零宽字符线上复测（生产，Chromium CDP）

代码依据：`utils/excel.ts:215` parsePastedRoster 逐行 `.replace(/[\u200b\ufeff]/g, '')`（在分列/表头识别前剥离零宽空格与 BOM），\u200d（ZWJ）不在剥离集合——emoji 家庭序列（👨‍👩‍👧‍👦 = 4 码点 + 3×ZWJ）应完整保留。r283 旧行为（可区分）：`\u200b张三283` 导入后姓名首字符仍为 \u200b。

## T0 部署确认
- 轮询 entry 翻转（r282/283 基线 index-DQXCHqb-.js）。

## T1 主判据（r283 P4 闭环）
- /studio 粘贴弹窗注入 `\ufeff姓名\n\u200b张三285\u200b\n👨‍👩‍👧‍👦`：
  - 识别行文案=「识别到 2 条数据、1 列（首行为表头：姓名）」（BOM 剥离后表头正常识别）；
  - 导入后 sessionStorage roster：headers=["姓名"] 且 header 字符串不含 \ufeff；行 1 姓名 === "张三285"（前后 \u200b 均被剥离，codepoint 级断言）；
  - 行 2 姓名 === "👨‍👩‍👧‍👦"（长度 11 UTF-16 code units，含 3 个 \u200d，逐 codepoint 相等——ZWJ 不被拆散）。

## T2 回归（Regression）
- TSV：`姓名\t班级\n张三285\t一班` → 2 列表头识别、1 条。
- 纯姓名 3 行 → 3 条、首列「姓名」。
- 逗号/顿号：`张三285,一班\n李四285、二班` → 2 条 2 列。
- 「首行是表头」开关：对纯姓名用例勾选「首行是表头」→ 识别行变「首行为表头」且行数-1；取消 → 恢复。

## T3 常规
- 全新 incognito context；pageerror=0；标记串（张三285/李四285）第三方零外发；storage 清理、context 全关。

## 报告
- test-report.md 第 285 轮置顶章节 + 本计划。
