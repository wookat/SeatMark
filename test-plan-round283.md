# 第 283 轮：剪贴板与文本输入边界稳健性审计（生产，无代码变更轮，Chromium CDP）

代码依据：`utils/excel.ts:210-253` parsePastedRoster——`\r\n?`→`\n`（CRLF/CR 均支持）、NBSP/全角空格（\u00a0/\u3000）→半角空格后 trim、分列优先制表符→中英文逗号/顿号→连续空白、首行关键词（姓名/name/班级…）识别表头否则首列「姓名」；`DataImportPanel.vue:190-202` confirmPaste 空名单 toast「名单为空」、成功 toast「已导入 N 条数据」；`FeedbackButton.vue:49-56` 反馈内容 >2000 字 toast「反馈内容不能超过 2000 字」、POST /api/feedback；`SeatingView.vue:459` 行/列 NumberField min=1 max=16。粘贴弹窗为 textarea（fill 注入等价于粘贴纯文本；HTML 富文本粘贴到 textarea 由浏览器取 text/plain——如实记录该口径）。

## T1 粘贴导入极端内容（/studio 粘贴名单弹窗，逐用例断言导入计数与解析结果）
1. CRLF：`姓名\t班级\r\n张三\t一班\r\n李四\t二班` → toast「已导入 2 条数据」「首行已识别为表头」。
2. 老 Mac CR：`张三\r李四\r王五` → 3 条、无表头首列=姓名。
3. 全角空格分隔：`张三　一班`×2 行 → 2 条 2 列（全角空格转半角后按空白分列）。
4. 制表符+多空格混排：含 \t 的行优先按 \t 分列（多空格保留在单元格内）→ 按代码语义断言列数。
5. 零宽字符/BOM：`\ufeff姓名\n\u200b张三` → 导入成功；如实记录零宽字符是否残留在数据（代码未过滤 \ufeff/\u200b——疑点，按实测定级）。
6. Emoji/组合字符：`👨‍👩‍👧‍👦一家\né组合(e\u0301)\n🎂蛋糕` → 3 条、预览表格正确显示。
7. 超长单元格：单行 600 字姓名 → 导入成功不报错；预览/画布不破版（截图）。
8. 10000 行大粘贴：fill 后计时确认弹窗仍响应、导入 toast「已导入 10000 条数据」、导入耗时记录、页面不卡死（后续操作可响应）、pageerror=0。
9. 空内容/纯空白：点导入 → toast「名单为空」。

## T2 表单输入边界
- /studio 字段编辑：把某单元格改为含控制字符（\u0007）+300 字文本 → 不 pageerror、预览不炸。
- /seating：行/列输入尝试 0、99、-1 → 被钳制在 1..16（NumberField min/max）；名单 textarea 粘贴 1000 行 → 生成座位表不卡死。
- 反馈表单（浮动按钮）：粘贴 2500 字 → toast「反馈内容不能超过 2000 字」且不发请求；2000 字内含 emoji 提交 → 「感谢反馈！」（如实记录请求结果）。

## T3 Emoji/组合字符导出回归
- 用例 6 名单选默认模板导出 PNG（带水印）→ 下载成功；PIL 打开 PNG 检查非空白（画布有内容），截图预览区取证 emoji/é 显示无豆腐块（视觉判定以截图为准）。

## T4 IME 冒烟（Regression r21）
- /studio 字段编辑框逐字符键入中文文本（type 模拟）→ 输入值完整、预览同步；/seating 标题输入同法。（无 composition 处理代码，冒烟以输入结果为准。）

## T5 常规
- 全新 incognito context；全程 pageerror=0；名单标记串（张三283 等）第三方零外发；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 283 轮置顶章节 + 本计划；发现按 P 级定级。
