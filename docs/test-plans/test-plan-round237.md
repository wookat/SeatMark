# 第 237 轮：诊断 r236「与宽度无关的间歇性导出卡死」（生产，无代码变更）

代码依据：pdfExport.ts:594-666 `createPageRenderer`——每页整链路 `withTimeout`（DEFAULT_PAGE_TIMEOUT_MS=30s，:67）→ 超时/空白自动重试一次 → `rebuildHost` 后最后一次重渲；失败抛「第 N/M 页渲染失败：渲染超时…」；PNG 路径 caller PreviewArea.vue:614/635/662：overlay 文案 `正在渲染第 N/M 页...`（setLoading 带 cancel 回调 → overlay 应有取消按钮）、失败 toast「PNG 生成失败 …；本次未扣除无水印次数，可直接重试」。理论最坏 ~90s/页 内必有结果。r236 判卡死口径仅 >60s——本轮回答是看门狗失效（真 P2）还是重试窗口误判。

## T1 卡死终局观察（核心）
- `/studio?template=eink800` 导入 3 行夹具，循环导出（800/4096 交替）直至触发一次「>60s 无文件」，随后**继续等满 300s**，全程每 5s 采样：overlay 文案（「正在渲染第 N/M 页」是否随重试变化）、toast 容器文本、新文件。
- 判据分叉：≤~90s(/页 ×3 页 ≤270s) 内出「PNG 生成失败…渲染超时」toast 或成功文件 → **看门狗生效，r236 为口径误判**；300s 后仍无 toast 无文件 → **真 P2（看门狗失效路径）**。

## T2 卡死时运行时状态（若 T1 出现真卡死；若看门狗生效则记录卡死窗口内状态）
- 采样：`document.visibilityState`、rAF 是否触发（100ms 内计数）、`Runtime.evaluate('1+1')` 心跳是否秒回（主线程忙否）、setTimeout(0) 是否触发。
- 判据：headless 隐藏页 rAF 不触发 + withTimeout 是否仍截断（30s 处应出现重试/文案变化）。

## T3 结局统计（15-20 次导出）
- 每次记录：成功耗时 / 失败 toast 耗时与文本 / >300s 真卡死次数。判据：所有非成功次数都应 ≤~270s 内以失败 toast 收场，否则真 P2。

## T4 卡死窗口内「取消」按钮
- 卡住时 overlay 上取消按钮是否可见可点；点击后判据：toast「已取消导出」出现、overlay 消失、可立即再次成功导出。

## T5 收尾
- pageerror=0；清 storage、tabs left: []；写 test-report.md 第 237 轮章节（含结论定性：P2 或口径误判 + 耗时分布）。
