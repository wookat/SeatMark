# 第 176 轮：长会话稳定性/资源泄漏审计（生产，无代码变更轮，bundle 应为 index-BADM1vql.js）

代码依据：模板切换 = TemplatePickerPanel.vue L311-349 卡片 `@click="workspace.selectTemplate(t)"`（真实 UI 点击左栏卡片）；多页翻页 = PreviewArea.vue L819/851 `aria-label="上一页"/"下一页"`；导出弹窗触发 = 「图片 PNG」按钮 + `.fixed` 内「带水印导出」；离屏宿主 = PreviewArea.vue `v-if="renderHost"` 的 `.offscreen-host`（导出完成后应从 DOM 移除）。度量 = CDP `Performance.getMetrics`（JSHeapUsedSize/Nodes/JSEventListeners/Documents/Frames）+ `document.querySelectorAll('*').length` + storage 字节数。

## T1 连续切换 30+ 款模板（含 eink/照片/装饰重模板）
- /studio?demo=1 同一 tab，通过左栏模板卡片 UI 点击切换 ≥32 款（滚动模板列表逐卡点击，穿插 eink800、photo 类、deluxe* 装饰重模板；每次等预览 `.sheet-page` 出现）。
- 断言：全程 pageerror=0；每次切换后 `.sheet-page` 存在且非空白（抽样截图 3 张：首/中/尾）；首尾 Performance.getMetrics 比对——JSHeapUsedSize 尾值（先 3 次 `HeapProfiler.collectGarbage` 后采样）< 首值×3 且绝对值 <300MB；Nodes 尾值 < 首值×3；Documents/Frames 尾值 ≤ 首值+2（html2canvas iframe 不累积）。

## T2 连续导出：整页 PNG×15 + 逐张 zip×5
- 同 tab（T1 结束状态，先切回 deskName）连续整页导出 15 次、逐张导出 5 次，记录每次耗时与文件 md5。
- 断言：15 份整页产物 md5 全一致（=r170 基线 `3e8fdf3e…`）；5 份 zip 首张 md5 全一致；耗时无单调劣化（最后 3 次均值 < 前 3 次均值×2）；每次导出完成后 `document.querySelectorAll('.offscreen-host').length===0` 且 `iframe` 数量===0（html2canvas 克隆 iframe 被清理）；GC 后 heap 较 T2 起点增幅 <100MB；pageerror=0。

## T3 弹窗/翻页反复开关 30 次
- 打开/关闭导出弹窗（图片 PNG → 关闭按钮/Esc）30 次；随后多页模板（deskName demo 2 页）上一页/下一页往返 30 次。
- 断言：DOM 总节点数（querySelectorAll('*')）在 30 次开关后回到基线 ±10%；Performance.getMetrics JSEventListeners 尾值 < 首值×2（不单调增长——每 10 次采样一次看趋势）；pageerror=0；弹窗第 30 次仍正常渲染（截图）。

## T4 长会话 storage 体积
- 上述全部动作后统计 localStorage/sessionStorage 各 key 字节数。
- 断言：总量 <1MB 且无异常巨型 key（单 key <512KB）；已知键（seatmark.workspace-template.v1 等）体积与内容合理。

产出：test-report.md 第 176 轮（96→97 节）、截图 r176_* 入 /home/ubuntu/screenshots/、产物 /home/ubuntu/r176_dl/。headless 不录屏。每导出脚本重连 browser WS 重设 downloadPath。发现劣化按 P 级定级。收尾清理 storage 测试数据 + 关闭全部测试 tab。
