# 第 247 轮：大名单规模压力专项（300/1000 行，生产，常驻 Chromium CDP）

环境：`playwright.connect_over_cdp('http://127.0.0.1:29229')`（Chrome 133 headless，常驻勿杀），每大项全新 context（避免 localStorage 模板/配额残留），add_init_script toast observer，`page.expect_download`。产物 `~/r247_dl/`。

代码依据：配额 `stores/quota.ts`（匿名每日 1 次无水印，key `seatmark.clean-export-usage.v1`；带水印不计数）；「配额只在导出成功后消耗，失败/取消不扣次数」`PreviewArea.vue:458`；取消按钮为 LoadingOverlay「取消导出」（`LoadingOverlay.vue:27-34`，loading.onCancel）；取消 toast「已取消导出 本次未扣除无水印次数」（`PreviewArea.vue:660`）；PNG 逐张/整页复用单页渲染链路含取消 signal（`pngExport.ts:326-359`）；进度文案「正在渲染第 N/M 页...」。标准模板 40 行=2 页 → 300 行≈15 页、1000 行≈50 页。

夹具（openpyxl 自造，含标记串便于隐私审计）：
- `~/r247_fixtures/big300.xlsx`：300 行，列 姓名/考场/座位号/学校；姓名含 张伟247-NNN 系列 + 生僻字（𱁬田247、𫔭𨱏247）+ 60 字长名 1 条；学校列含标记 隐私学校247。
- `~/r247_fixtures/big1000.xlsx`：1000 行同构。

## T1 300 行导入
- /studio?template=standard 全新 context，xlsx input 导入 big300.xlsx，计时。
- 判据：toast「已读取 300 条数据」；「共 300 条」；映射面板字段齐全；导入后 3s 内页面可交互（evaluate 响应 <2s，无卡死）；导入耗时记录（观察项）。

## T2 300 行三导出链路 + 内存采样
- 同 context 依次（带水印通道，不动配额）：
  - 整页 PNG：zip 页数=ceil(300/20)=15、每张 2481×3509、抽 3 页非空白>0.5% 且 md5 互异；
  - 逐张 PNG：zip 恰 300 张 1000×534、抽 5 张 md5 互异非空白；
  - 图片版 PDF：toast「图片版 PDF 已生成」、pypdfium2 页数=15、p1/p8/p15 非空白>0.5%。
- 每链路计时；导出期间每 2s 采 CDP `Performance.getMetrics` JSHeapUsedSize，导出结束后 10s 再采——判据：过程峰值有记录（观察项），结束后 heap 回落（终值 < 峰值），浏览器/页面不崩（导出后 evaluate 仍响应）。
- 无静默坏页：zip 全量张数与尺寸校验（非只抽样张数）。
- 文件名秒级 `-\d{8}-\d{6}`。

## T3 1000 行
- 全新 context 导入 big1000.xlsx：toast「已读取 1000 条数据」、「共 1000 条」、预览分页控件可用（切到末页/某中间页渲染出内容）、页面可交互。
- 一次导出链路（选图片版 PDF）：计时；若 >5 分钟或失败，如实记录失败点/耗时并判级（无兜底卡死=P1/P2；慢但进度推进且成功=观察项）。成功则 pypdfium2 页数=50、抽页非空白。

## T4 导出中途取消（300 行逐张，无水印通道验证配额）
- 全新 context 导入 big300.xlsx，记录 `seatmark.clean-export-usage.v1` 初值（应无/used=0）。
- 逐张 PNG 选「无水印」→ 等进度文案推进到「正在渲染第 N/300」N≥50 → tap「取消导出」。
- 判据：toast「已取消导出 本次未扣除无水印次数」；30s 内无 download 事件（不落盘）；localStorage 配额 key 仍 used=0；立即重导（带水印）成功且 zip 300 张完整。

## T5 隐私与收尾
- 全程请求监听：张伟247 / 𱁬田247 / 隐私学校247 命中 0；pageerror=0（ResizeObserver 白名单）；文件名秒级已在 T2 断言；清 storage、关闭自建 context/page（常驻 Chrome 本体与既有 tab 不动）。

## 报告
- 追加 test-report.md 第 247 轮章节（不提交）；SKILL.md 建议随最终报告。
