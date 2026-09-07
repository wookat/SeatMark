# 第 245 轮：打印链路 Firefox headed 实证（生产，无代码变更）

环境注记（setup 已完成）：用户所述 DISPLAY=:0 可视桌面**实际不存在**（无 X socket/Xorg 进程；常驻 Chrome 为 headless）。改为自建 Xvfb :99（1600×1000），headed Firefox（firefox-1438，headless=False）跑其上；常驻 Chrome（CDP 29229）不动。Firefox 静默打印落盘已预验证可行：`print.always_print_silent=true` + `print_printer='Mozilla Save to PDF'` + `print.printer_Mozilla_Save_to_PDF.print_to_file/print_to_filename`，探针页 window.print → 7.5KB PDF 落盘。

代码依据：`utils/printing.ts:30-38 printAndWaitUntilDone`（window.print + afterprint）；studio 打印入口 `PreviewArea.vue`「打印 / 矢量 PDF」按钮；seating 打印 `SeatingView.vue doPrint`（L380，按钮「打印」L574，先 toast「即将调起浏览器打印」再挂载打印宿主 1.2s 后 window.print）。

## T1 /studio demo 打印（headed FF）
- /studio 载入演示数据（「用演示数据先试试」）→ hook window.print 计数 → 点「打印 / 矢量 PDF」（如有导出方式弹窗则选浏览器打印）。
- 判据：window.print 被调起（计数 ≥1）；PDF 落盘；pypdfium2：页数 ≥1、页面文本含 demo 名单姓名（如 谢跃平）或渲染墨量 >0.5% 每页、无全空白页。

## T2 /seating 排座打印（headed FF）
- /seating 粘贴 10 行名单（含 张伟245）→ 完全随机 → 点「打印」按钮。
- 判据：toast「即将调起浏览器打印」；window.print 计数 ≥1；PDF 落盘、页数 ≥1、文本含 张伟245（或墨量非空白）、无空白页。

## T3 与 Chromium 打印基线粗比对（r128 方法族）
- 常驻 CDP 29229 Chromium 同素材（studio demo 同纸型）stub window.print + Page.printToPDF 出基线 PDF。
- 判据：FF 与 CR 页数一致；首页非白像素墨量同量级（比值 ∈ [0.3, 3]）。不要求逐位。

## T4 WebKit 打印可行性
- headed WebKit（Xvfb :99）hook window.print 点同按钮：如 window.print 调起但无 print-to-file 机制/无产物，如实标 untested/blocked 并记录原因；不硬凑判据。

## T5 隐私与收尾
- FF 会话请求监听：张伟245 命中 0；pageerror=0（WebKit 良性 ResizeObserver 白名单）；清 storage、关 headed 窗口与 Xvfb :99、不动 29229 Chrome；报告追加 test-report.md 第 245 轮章节（不提交）。
