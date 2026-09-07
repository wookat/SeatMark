# 第 219 轮：带真实名单的 /seating 排座全数据流隐私+功能取证（补 r218 缺口）

代码依据：/seating 名单入口=左侧「学生名单」textarea 粘贴（SeatingView.vue:502-507，每行「姓名 性别」）；换座三通道——点选两座互换（onSeatClick:241-259）、座位 div tabindex=0 + Enter 键（:686-690）、鼠标 Pointer 拖拽（onSeatPointerDown:292 + 5px 阈值 + elementFromPoint 落点:316-352）；打印=doPrint:380（toast 提示→teleport 打印宿主→window.print，无网络无下载）；**无分享/导出入口**（输出仅打印+生成桌贴）；排座→桌贴联动=toDeskLabels:396-419 → localStorage `seatmark.seating-handoff.v1`（rows 含 姓名/座位号/排/列/班级）→ router.push('/studio?from=seating')，studio 侧 takeSeatingHandoff 读后即删（seating.ts:96-98）；持久化=localStorage `seatmark.seating-state.v1`（title/rows/cols/podium/fillOrder/aisles/namesText/arranged，SeatingView.vue:26/89）。

夹具（每行「姓名 性别」×12 人，4×3 网格）：姓名「排座审计赵六219/钱七219/孙八219…」+ 标题「排座审计219班」+ 一行含假手机号 13900219001（parse 行为：非性别尾 token 整行按分隔拆为多个名字——如实观察）。
敏感串 S = {排座审计, 赵六219, 13900219}（原文+URL 编码+base64/base64url 变体）。

## T1 排座全流程（CDP 全量网络捕获，Tab._ev 覆盖法）
1. /seating → 设 4 排 × 3 列 → 粘贴名单 → 断言「已输入 12 人 / 座位 12 个」且预览网格渲染姓名（截图）。
2. 点选换座：点座 1（出现「已选中座位」提示）→ 点座 12 → 断言两座姓名互换（换前/换后 DOM+截图对照，具体名字值断言）。
3. 键盘换座：Tab/focus 到某座位按 Enter 选中 → 焦点移至另一座位 Enter → 断言互换。
4. 拖拽换座：CDP Input.dispatchMouseEvent 真实 mousedown→多步 mousemove（>5px）→mouseup 从座 A 到座 B，拖拽中截图（drop-target 高亮）+ 断言互换。
5. 打印：点「打印座位表（A4 横向）」→ toast「即将调起浏览器打印」出现；headless 下 window.print 行为如实记录（Page.printToPDF 替代取证打印宿主渲染含全部姓名）。
6. 联动：点「一键生成对应桌贴」→ 断言跳转 /studio?from=seating、studio 数据表含「排座审计赵六219」且座位号/排/列列齐全、`seatmark.seating-handoff.v1` 已被消费删除（读后即删）。
- **P1 判据**：全程所有请求 URL/body 对 S×编码变体命中=0；遥测仅页面路径/标题。

## T2 持久化与清理
- 排座后断言 localStorage `seatmark.seating-state.v1` 含 namesText/arranged（键名+内容取证）；刷新 /seating 后排座结果保留（arranged 恢复）。
- localStorage.clear()+sessionStorage.clear()+IndexedDB 枚举 → 全空、无敏感串；刷新后名单/排座消失（截图）。

## T3 收尾
- pageerror=0；关全部 tab；第 219 轮置顶追加 test-report.md（基于最新 main；#221 未合入 main 时留合并顺序注记）。
