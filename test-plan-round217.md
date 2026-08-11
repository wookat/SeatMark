# 第 217 轮：#218 反馈默认 webhook 上线后单条回归

代码依据：#218 diff edge-functions/api/feedback.js:21 新增 `FEEDBACK_WEBHOOK_DEFAULT`（企微机器人），:94 `env.FEEDBACK_WEBHOOK || FEEDBACK_WEBHOOK_DEFAULT`——服务端推送，前端逻辑不变（FeedbackButton.vue:49-79）。前端 bundle 无改动（entry 仍 `index-m3vMPIl7.js`，已核）。webhook 送达在企微群，外部不可观测 → untested-externally，由老板在群里确认。

## T1 单条标识反馈提交（真实 UI）
- 首页右下浮动按钮 `[aria-label=反馈]` → 「意见反馈」→ 类型「其他」→ 内容「Devin 第 217 轮测试反馈，可忽略（#218 默认 webhook 验证）」→ 提交。
- 断言：POST /api/feedback 200、响应恰为 `{"ok":true}`；toast「感谢反馈！已收到您的意见」截图可见；弹窗关闭；payload keys 恰为 {type,content,contact,page}（口径不变）、type=other、page=/；pageerror=0。
- webhook 实际送达 — untested-externally（企微群确认）。

## T2 收尾
- 清 storage + 关全部测试 tab；第 217 轮置顶追加 test-report.md（不提交）。
