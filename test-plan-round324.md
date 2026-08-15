# 第 324 轮：纯调研——冷启动首次逐标签 PNG 导出 ~90s 时间去向归因（生产，匿名，无录屏，不改 test-report.md）

代码侧阶段边界（依据）：
- `PreviewArea.vue:572` setLoading「正在准备页面...」→ `pngExport.ts:423` 动态 import html2canvas-pro、`:522` import jszip；
- `PreviewArea.vue:629` 每页 setLoading「正在渲染第 i/n 页...」→ `mountHost`（fonts.ready ≤3s + sleep 60ms，`PreviewArea.vue:428-442`）→ `waitForElementReady`（loadRareGlyphFonts ≤3s + fonts.ready ≤3s + 图片 ≤5s，`pdfExport.ts:216-230`）→ html2canvas 渲染，看门狗 `DEFAULT_PAGE_TIMEOUT_MS=30s`（`pdfExport.ts:67`）超时**自动重试**——30s×N 是 90s 的候选解释之一；
- `pngExport.ts:487-504` renderAndCutPage 空白重渲（最多 3 次渲染）也可放大耗时；
- onProgress「已完成 x/26 张标签，正在生成图片...」→ zip.generateAsync → 下载。

## T1 冷启动导出全链路计时（/studio?demo=1，中文，匿名带水印导出）
方法（CDP，python websocket 已有脚本模式）：
1. fresh 状态：`Network.clearBrowserCache` + `Storage.clearDataForOrigin`（cache/storage/serviceworker 全清）。
2. `Page.addScriptToEvaluateOnNewDocument` 注入：
   - MutationObserver 监听 body 子树 characterData/childList，凡含「正在准备页面/正在渲染第/已完成 .*张标签」的浮层文案变化即 push `{t: performance.now(), text}` 到 `window.__stages`；
   - `PerformanceObserver({entryTypes:['longtask']})` push 到 `window.__longtasks`；
   - `window.addEventListener('error')` 计数 pageerror。
3. `Network.enable` 采集 requestWillBeSent/loadingFinished 时间线（存 jsonl）。
4. UI 打开 /studio?demo=1 → 点「图片 PNG」→ 带水印逐标签导出（匿名默认 26 标签/2 页），等完成 toast。
5. 读取 `__stages/__longtasks` + Network 数据，切分：准备阶段（分包下载 html2canvas/jszip）/ 每页字体等待 / 每页 html2canvas 长任务 / zip 打包，输出各阶段耗时表。
PASS 判据（调研有效性）：拿到完整阶段时间戳序列且总时长≈浮层可见时长；能指认耗时 Top 阶段（例如某类请求 >30s、或看门狗 30s 超时重试、或每页 html2canvas 长任务合计 >60s）。
记录：字体/CSS/分包各请求 start→finish 耗时 Top 10（尤其在线字体 css+woff2、plangothic woff2）；是否出现 30s 看门狗重试（阶段间隔≈30s 为特征）；是否空白重渲。

## T2 第二次导出对照（同 tab 不刷新，紧接再导出一次带水印 PNG）
- 同样读取 `__stages/__longtasks` 增量，输出同一张阶段耗时表对照。
- PASS：给出冷/热每阶段耗时差，明确指出冷启动多出的时间落在哪个阶段（网络请求 vs 渲染 vs 等待上限）。

产出：归因结论 + 数据表（jsonl/文本）+ 关键截图（浮层各阶段）。不录屏、不写 test-report.md、不登录。收尾清存储。
