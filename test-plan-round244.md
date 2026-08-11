# 第 244 轮：次级链路 Firefox + WebKit 跨引擎回归（生产，无代码变更）

代码依据：`views/SeatingView.vue`（textarea 粘贴名单 L502、随机排座/点选换座 swapSeats L223、持久化 `seatmark.seating-state.v1` L26/89、「一键生成对应桌贴」toDeskLabels→`SEATING_HANDOFF_KEY`+`/studio?from=seating` L395-418、doPrint L380 headless 不可验证）；分享：`components/studio/TemplatePickerPanel.vue`「复制当前模板分享链接」→ `/studio#tpl=payload`（`utils/share.ts:12 SHARE_HASH_PREFIX`），接收端 `views/StudioView.vue:70-100`（有效 → sharedTemplate 弹窗「已应用分享模板/保存」；无效 → toast「分享链接无效」L83）；设计器：TemplatePickerPanel L294「从空白新建」/L384「以此为基础设计/编辑」→ `components/designer/TemplateDesigner.vue`（模板名称 input、「+ 添加字段」L1176、保存 L1100-1110 emit save→library.saveAsCustom，自定义模板持久化 localStorage）；#228 弹窗返回哨兵：`components/ui/ModalDialog.vue:22-52`（pushState 哨兵 + popstate 只关弹窗）。

环境：生产 `index-B7iIsDpm.js`；firefox-1438 与 webkit-1967（`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`）各跑一遍同判据；WebKit 下载用 expect_download；每大项全新 context。

## T1 /seating（两引擎）
- 粘贴 10 行名单（含 张伟244/𫔭𨱏244）→ 点「随机排座」（或等价生成按钮）：座位格显示姓名、非空格数=10。
- 点选换座：点座位 A（记名 nameA）→ 点座位 B（nameB）→ 断言两格姓名互换（DOM 读数 + 截图）。
- 持久化：reload 后名单/排座结果恢复（localStorage `seatmark.seating-state.v1` 存在且座位名恢复）。
- 联动：点「一键生成对应桌贴」→ 跳 `/studio?from=seating`，导入数据含 姓名/座位号/排/列，预览「共 10 条」。
- 打印对话框：headless 无法验证 window.print 调起 — 如实 untested。

## T2 长链分享（两引擎）
- studio 选中模板点「复制当前模板分享链接」→ 成功 toast；从 clipboard（或直接调 buildShareUrl 等价 DOM 途径不可行时改为拦截 clipboard API）取 URL，断言形如 `/studio#tpl=…`。
- 新 context 打开该 URL：出现分享模板弹窗，点「保存/应用」后 toast「已应用分享模板」或等价，且工作区模板名与源一致。
- 篡改容错：将 payload 截断/改字符后打开 → toast「分享链接无效 链接可能不完整或已损坏」，页面不崩（pageerror=0、studio 正常可用）。

## T3 模板设计器（两引擎）
- studio 模板面板点「从空白新建」（或内置模板「以此为基础设计」）→ 设计器全屏打开（header「模板设计器」可见）。
- 「+ 添加字段」加一个文本字段 → 字段列表出现新字段；改模板名称为「r244自定义FF/WK」→ 点「保存」→ 设计器关闭、工作区模板名=「r244自定义…」。
- reload 后该自定义模板仍在模板列表（localStorage 持久化）。
- 用该模板导出整页 PNG 一次：成功 toast + zip 落盘非空白。

## T4 弹窗返回键哨兵 #228（两引擎）
- /studio 打开 PNG 导出弹窗 → `history.back()` → 断言：弹窗关闭（dialog 不可见）且 location.pathname 仍 `/studio`（未跳走）、页面可继续操作。

## T5 隐私与收尾
- 两引擎全程请求监听：张伟244/𫔭𨱏244 等标记串命中 0；pageerror=0；清 storage、关全部 context；写 test-report.md 第 244 轮章节（不提交）。
