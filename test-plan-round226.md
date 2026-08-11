# 第 226 轮：#228（哨兵三修）生产四测

代码依据：ModalDialog.vue:11-72（#228）——`seatmarkModalSentinel` 唯一自增号；popstate 落点非顶层哨兵则关顶层弹窗，落到孤儿哨兵自动再 history.back() 透明跳过；consumeSentinel 延迟 50ms 且校验「当前 state 哨兵号==本号 && href 未变」才回收。
对照失败形态：r225 的 T4 P2（配额弹窗 /account 链接不跳）与 T4b P3（/templates 后 back 需两次）。

## T0 部署确认
- entry 翻转离开 `index-BYArTfAJ.js`，新 bundle 含 `seatmarkModalSentinel`。

## T1 单层弹窗后退（双通道回归）
- /studio 导入 3 行名单 → 开「图片 PNG」弹窗：history.state.seatmarkModalSentinel 为数字 → history.back()：弹窗关、URL 仍 /studio、「共 3 条」在；再 back 离开到 /。原生通道 `Page.navigateToHistoryEntry` 再验一遍。截图。

## T2 配额弹窗 /account 链接（重点，r225 P2 复测）
- localStorage `seatmark.clean-export-usage.v1`={date:today,used:1} → 开导出弹窗 → 点「无水印导出」→ 配额弹窗「今日无水印导出次数已用完」→ 点 /account 链接 + 100ms URL 采样：**必须落到 /account**（采样出现 /account 且最终 pathname=/account）。随后 back 落点如实取证。

## T3 Esc/遮罩关后回收（50ms 延迟）
- 开弹窗 → Esc → 等 ≥200ms：history.state 无 seatmarkModalSentinel → 一次 back 即离开 /studio。遮罩点击同法。

## T4 弹窗态直接站内链接（r225 P3 复测）
- 开导出弹窗 → 点 /templates 链接：跳转成功 → 从 /templates 按 back **一次**：应透明跳过孤儿哨兵直接落 /studio 底层条目（url=/studio 且 state 无哨兵号），再 back 到 /。取证 getNavigationHistory。

## T5 back 关弹窗后 forward（新行为）
- 开弹窗 → back 关 → forward：无 pageerror、弹窗不重开、最终 URL /studio（孤儿哨兵可能被自动弹回原地，state 最终无哨兵号），如实记录落点序列。

## T6 快速切换：导出弹窗关→配额弹窗开→back 一次
- 配额已用尽态：导出弹窗点「无水印导出」（导出框关、配额框开，可能存在两个哨兵条目/孤儿）→ back 一次：配额弹窗关、URL 仍 /studio；再 back 落点如实取证（是否需额外一次）。

## T7 回归
- 无弹窗 /studio↔/ back/forward 名单保持；/templates `?cat=event&q=桌牌` 返回保搜索词/分类/scrollY=500。

## T8 收尾
- 全程 pageerror=0；清 storage + 关全部 tab；第 226 轮置顶追加 test-report.md。
