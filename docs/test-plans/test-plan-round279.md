# 第 279 轮：多页签/多实例并发一致性专项（生产，无代码变更轮，Chromium CDP）

代码依据：`stores/workspace.ts:56` 名单 sessionStorage `seatmark.workspace-roster.v1`（按页签隔离）、模板 localStorage `seatmark.workspace-template.v1`（跨页签共享）；`stores/templateLibrary.ts:37-49` storage 事件同步 + 写前 `syncFromStorage()`（#153 防覆写）；`stores/quota.ts:11` localStorage `seatmark.clean-export-usage.v1`（匿名 1 次/日）——**无 storage 事件监听**，B 页签内存 `localUsage` 可能陈旧（疑点，实测判定）；`views/SeatingView.vue:26,41,89` localStorage `seatmark.seating-state.v1`；`PreviewArea.vue:458-500` 无水印先检 remaining、导出成功后 tryConsume，带水印不计数。同一 incognito context 内开双 page = 同源共享 localStorage、独立 sessionStorage。

## T1 双页签 /studio 名单隔离 + 模板共享语义
- 同 context 开 A、B 两个 /studio。A 粘贴导入名单「页签A-1/2/3」；B 粘贴导入「页签B-1/2」。
- 判据：A 显示「共 3 条」、B 显示「共 2 条」互不污染；各自 sessionStorage roster 只含本页签名单；B 改模板（选不同模板卡）后 A 刷新 → A 模板跟随 B（localStorage 共享的既有语义，如实记录）。

## T2 自定义模板写竞争（Regression r138/#153）
- A、B 各自把当前模板「保存为自定义」（改不同名：定制A279 / 定制B279），间隔 <2s 先 A 后 B。
- 判据：B 保存后 localStorage `seatmark.custom-templates.v1` **同时含两条**（后写不覆盖先写）；A 页签模板面板刷新/storage 事件后也能看到 2 条。

## T3 配额跨页签一致性（疑点验证）
- 全新 context 双页签。A 无水印导出 1 次成功（匿名日配额 1）→ localStorage used=1。
- 判据①：B 页签「无水印（今日剩 X）」显示是否变 0（代码无监听，预期陈旧——如实记录口径）；判据②：B 直接尝试无水印导出——若被拦截（remaining 读最新）则一致 ✅；若 B 仍导出成功且 localStorage 变 used=1（覆写而非累加）→ 记为发现（双页签各多得 1 次）。刷新 B 后「今日剩 0」应正确。

## T4 /seating 与 /studio 互不干扰
- A 页签 /studio 导入名单；B 页签 /seating 建座位表（改标题+行列）。
- 判据：互操作后 A 的 roster 与 B 的 `seatmark.seating-state.v1` 各自持久化正确；A 刷新名单仍在（sessionStorage 本页签）、B 刷新座位表标题/布局仍在；两 store 键互不写串。

## T5 同页签快速连点导出
- 导出弹窗中对「带水印」按钮连点 2 次（间隔 <200ms）。
- 判据：只产生 1 次下载；无水印同法（新 context 保配额）连点后 localStorage used 只 +1、下载 1 次。若双下载/双扣 → 记为发现。

## T6 常规
- 全程 pageerror=0；名单标记串（页签A/页签B）第三方零外发；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 279 轮置顶章节 + 本计划 + SKILL 建议如有。
