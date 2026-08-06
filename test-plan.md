# SeatMark P1/P2 回归清扫 — 浏览器测试计划

环境：本地 vite dev（http://localhost:5173，devApi 内存 KV）。已确认 `/api/share/tpl` POST 返回 `{ok:true,code:...}`。

代码依据：
- 分享 QR：`app/src/components/studio/TemplatePickerPanel.vue` L143-212, L435-471；`app/src/utils/share.ts` L99-132
- Seating 拖拽：`app/src/views/SeatingView.vue` L229-302（pointer 事件，阈值 5px），说明文案 L500-504
- 导出失败注入：`app/src/utils/pdfExport.ts` L33-46（key `seatmark.dev.force-export-fail`，仅 DEV）
- 取消导出：`PreviewArea.vue` L242-275（toast「已取消导出」），`LoadingOverlay.vue`（取消按钮）
- Edit One 提示：`PreviewArea.vue` L126-147, L545-551（key `seatmark.edit-one-hint-dismissed.v1`）

## T1 分享短码 QR 成功路径
1. 打开 /studio（先清 localStorage 保证首访状态 → 同时覆盖 T5 前置）。
2. 模板面板点「微信扫码打开」。
- 断言：先出现加载态「正在生成扫码短链……」（弹窗内 spinner）；随后显示 QR SVG，说明文案含「二维码只包含一个短链接」（短码模式）。若直接出现长链文案（「模板数据全部编码在链接里」）→ FAIL。

## T2 分享短码失败对话框
1. 打开 devtools Network，添加请求阻断 `*/api/share/tpl*`（或用 Fetch blocking）。
2. 再点「微信扫码打开」。
- 断言：弹窗显示「短链服务暂时不可用」+「重试」「改用长链接二维码」两个按钮，且提到密度较高需近距离扫描。
3. 点「改用长链接二维码」→ 显示 QR，文案为长链版本（含「长链接二维码密度较高，请近距离扫描」）。
4. 解除阻断，点关闭后重开或点「重试」→ 恢复短码 QR。

## T3 /seating 拖拽换座
1. 打开 /seating，点「用演示名单」。
2. 记录座位 (1,1) 与 (2,3) 的姓名；鼠标按住 (1,1) 座位，真实拖动（中途截图，应见拖拽高亮 drop-target），释放到 (2,3)。
- 断言：两座位姓名互换（拖动中截图 + 结果截图）。
3. 行把手拖拽：按住第 1 排把手拖到第 3 排把手释放 → toast「已交换第 1 排与第 3 排」，整排姓名互换。
4. 回归：点选两个座位互换仍工作（提示「已选中座位，点另一个座位交换」出现后点第二个座位互换成功）。
- 断言：说明文案含「触屏设备请用点选方式」。

## T4 导出失败注入（不扣配额）
1. /studio 使用默认模板+数据；记录 localStorage `seatmark.clean-export-usage.v1` 当前值（应为 null 或计数 n）。
2. devtools console 设 `localStorage.setItem('seatmark.dev.force-export-fail','1')`（仅此一步用 console）。
3. 关闭水印选项（若需无水印路径）→ 点导出 PDF。
- 断言：导出失败 toast，文案说明未扣配额（含「未扣除」/quota 未消耗字样）；`seatmark.clean-export-usage.v1` 不变。
4. 移除 key，再导出 → 成功 toast「图片版 PDF 已生成」，配额计数 +1。

## T5 取消导出
1. 选多页数据（演示数据多页或增加行数使 pageCount>3）。点导出，进度浮层出现时立即点「取消」。
- 断言：进度浮层有「取消」按钮（截图）；点击后 toast「已取消导出」「本次未扣除无水印次数」；配额值不变。

## T6 Edit One 引导
1. （已在 T1 清过 localStorage）首访 /studio 预览区应出现左上角引导气泡（截图），带关闭按钮。
2. 点关闭 → 气泡消失；localStorage `seatmark.edit-one-hint-dismissed.v1` = '1'；刷新页面气泡不再出现。
3. 悬停某标签 → title tooltip 含「点击可单张覆写」。（title 属性无法截图渲染，用 DOM title 验证 + 记录）

## T7 响应式 390/768/1280
对 /、/studio、/seating 各在 390、768、1280 宽度下截图。
- 断言：`document.documentElement.scrollWidth <= innerWidth`（无横向溢出），页面布局正常。

## 附加检查
- 全程留意 UI 中无 emoji 图标（应为 inline SVG）。
