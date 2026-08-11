# 第 223 轮：#225 弹窗返回键拦截上线验收（生产）

代码依据：ModalDialog.vue:4-32——模块级 openStack+closeHandlers；popstate 时间戳；router.beforeEach：无弹窗或距 popstate>300ms 放行，否则关顶层弹窗并 return false（取消导航）。判据核心=「后退时 URL 不变、只关顶层弹窗」，与 r221 T3 的旧行为（整页跳走）形成对照。
触发点：导出选择弹窗 exportChoiceOpen（PreviewArea.vue:1170，「图片 PNG」按钮）；配额引导弹窗 quota.limitDialogOpen（无水印剩 0 时点「无水印导出」触发，PreviewArea:459-465，quota localStorage=`seatmark.clean-export-usage.v1`）；浏览全部模板弹窗（TemplatePickerPanel.vue:494 附近，「浏览全部 N 款模板」按钮）；扫码弹窗 shareQrOpen（:456）；弹窗内站内链接 RouterLink /account（:446/451）。

## T0 部署确认
- 轮询 `/` 的 entry：翻转离开 `index-m3vMPIl7.js` 且新 bundle 文本含「lastPopstateAt 逻辑特征」（grep popstate）才开测；未翻转则等待/报告。

## T1 单层弹窗后退（核心，对照 r221 旧行为）
- /（点链接）→ /studio 导入 3 行名单 → 开「图片 PNG」导出弹窗 → history.back()：断言弹窗关闭（[role=dialog]=0）、URL 仍 /studio、名单「共 3 条」；**再按一次 back**：这次真正离开到 /（守卫放行）。截图弹窗态与关后态。

## T2 叠层弹窗逐层关
- /studio 侧栏「微信扫码打开」开扫码弹窗，再想法叠第二层（候选：先开「浏览全部 N 款模板」再开扫码弹窗；或配额弹窗叠加，运行时按实际可叠组合）→ 连续 back：第一次只关顶层（底层弹窗仍在），第二次关底层（URL 仍 /studio），第三次才离开页面。若产品实际无法叠两层 ModalDialog，如实记录并降级为两次独立单层验证。

## T3 回归：弹窗关闭状态下导航照常（r221 T1/T2 抽查）
- 无弹窗时 back/forward：/studio↔/ 正常往返、名单保持；/templates `?cat&q` 返回保状态+滚动位。

## T4 弹窗内站内链接不受影响
- 置 quota 已用尽（localStorage `seatmark.clean-export-usage.v1` used=当日已满）→ 点「无水印导出」→ 配额引导弹窗弹出 → 点弹窗内 RouterLink（免费登录/个人中心 → /account）：断言正常跳转到 /account（守卫不拦非 popstate 导航）。

## T5 Esc/遮罩关闭后后退无残留
- 开导出弹窗 → Esc 关闭 → history.back()：正常离开 /studio（一次即走，无需多按）；同法遮罩点击关闭再 back。

## T6 收尾
- 全程 pageerror=0；清 storage + 关全部 tab；第 222/223 轮章节置顶追加 test-report.md（第 222 轮=#225 代码变更说明轮，注明由本 223 轮生产验收）。
