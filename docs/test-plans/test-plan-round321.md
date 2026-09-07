# 第 321 轮：生产冒烟（#333：英文导出冒号/进度浮层/取消 toast/banquet 括号 locale 化）

环境：生产 https://www.seatmark.cn ，匿名，录屏。前置：轮询主包哈希 ≠ index-BkPOReaF.js（英文分包 ≠ en-DLc9LKHc.js 且含新键 'Export cancelled'）。若 >20 分钟未部署，按 319 轮预案改本地 build 预览并如实标注。

## T1 /en/studio 导出弹窗句尾半角冒号
- 开 /en/studio?demo=1（清 localStorage），打开 PNG 导出弹窗。
- PASS：`Choose an export method (…not counted):` 句尾**半角 ':'**；FAIL：仍 `）：`。截图 zoom。

## T2 /en/studio 导出进度浮层英文 + 取消
- 点带水印 PNG 导出。PASS：浮层文案英文（'Preparing pages...' 或 'Rendering page i/n...'），取消按钮 **'Cancel export'**（若仍「正在准备页面…/取消导出」则 FAIL）。
- 点 Cancel export。PASS：toast **'Export cancelled'** 英文。
- 再完整导出一次。PASS：toast 'PNG images exported (26 labels zipped)'（回归）。

## T3 /en/banquet 半角括号（清 seatmark.banquet-state.v1）
- PASS：侧栏 **'Roster (0 guests / 80 seats)'**、画布下 **'Unassigned guests (0)'** 半角括号（FAIL：`（0）`）。

## T4 中文回归（Regression）
- /studio?demo=1：导出弹窗句尾**全角「：」**；触发导出浮层中文「正在准备页面…/取消导出」，取消 toast「已取消导出」。
- /banquet（清状态）：「名单（0 人 / 80 座）」「未安排宾客（0）」**全角括号**不变。

## T5 390px + pageerror（CDP）
- /en/studio、/en/banquet 390×844：scrollWidth==innerWidth、pageerror 0。

收尾：清浏览器存储。产出：录屏、test-report.md 第 321 轮章节（不提交）。
