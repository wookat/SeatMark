# 第 246 轮：移动端 WebKit（iPhone 13 设备描述）黄金链路专项（生产，无代码变更）

环境：Playwright webkit-1967 + `devices['iPhone 13']`（390×664 视口、DPR 3、has_touch、iOS Safari UA），`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`；方法沿用 r243/r244（add_init_script toast observer、expect_download、每大项全新 context）。夹具 `r240_fixtures/ff240.xlsx`（40 行含 𱁬田240/维文/张伟240）、eink `r231_fixtures/eink234.xlsx`。

代码依据：移动判定 `utils/printing.ts:9 isMobilePrintEnvironment`（UA iPhone → isMobile=true）；图片版 PDF/PNG 导出移动端仍走 downloadBlob 正常下载（`PreviewArea.vue:505-545`、`pngExport.ts:315`），仅「打印」走 doMobilePrint 分享通道（L680，本轮不测打印）；小屏 zoomMode 默认「适应单枚」fitLabel（L91-92）、低频显示选项收进「显示选项」折叠组（L97、L877）；#228 哨兵 `ModalDialog.vue:22-52`；/seating 触屏为点选互换（拖拽仅鼠标，`SeatingView.vue:280-282、566-567`）——用户提的「横滑提示」在 seating 代码中不存在（VsDetailView 才有），如实按点选换座+网格可用验证并注记。

## T1 布局黄金链路（tap 导航）
- 首页 → tap 模板入口 → /templates → tap 一个模板卡 → /studio。
- 每页判据：`document.documentElement.scrollWidth <= window.innerWidth`（无横向溢出）；/studio 单栏（预览区与左栏纵向堆叠：两者 x 起点接近、无并排）；顶部 header 与主要 CTA 在视口内可 tap；截图留档。

## T2 移动端导入 40 行 xlsx
- /studio 全新 context，input[type=file] set_input_files(ff240.xlsx)。
- 判据：toast「已读取 40 条数据」、预览「共 40 条」、映射面板字段齐全；无横向溢出。

## T3 移动端导出四链路（toast + expect_download + 产物核验）
- 同 context 依次：整页 PNG（zip 2 页 2481×3509 非空白>0.5%）、逐张 PNG（zip 40 张 1000×534、抽 3 md5 互异）、图片版 PDF（toast「图片版 PDF 已生成」、pypdfium2 p1 非空白>0.5%）。
- 全新 context `/studio?template=eink800` + eink234.xlsx：逐标签导出 zip 3 张恰 800×480、恰 2 色、无 pHYs。
- 文件名秒级 `-\d{8}-\d{6}`。

## T4 触摸交互 + #228 哨兵（page.tap / touchscreen）
- 预览缩放档：tap zoom SelectField 切「适应宽度」→ 预览容器 transform/宽度变化（前后取值不同）。
- 「显示选项」折叠组：tap 展开 → 裁切线等选项可见；再 tap 收起。
- 导出弹窗：tap PNG → 弹窗现（dialog=1）→ tap 关闭按钮 → dialog=0。
- #228：再开弹窗 → history.back() → dialog=0 且 pathname 仍 /studio。

## T5 /seating 移动端
- 全新 context /seating：粘贴 10 行（含 张伟246）→ tap「完全随机」→ 10 座位出名；tap 两座位点选互换（座位序下标互换）；无横向溢出或网格容器自身可横向滚动（scrollWidth>clientWidth 且可 scrollLeft）；「横滑提示」代码中不存在——如实注记。

## T6 隐私与收尾
- 全程请求监听：张伟246/𱁬田240/维文串 命中 0；pageerror=0（「ResizeObserver loop completed with undelivered notifications.」白名单）；清 storage、关全部 context；报告追加 test-report.md 第 246 轮章节（不提交）。
