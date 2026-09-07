# 第 215 轮：用户反馈通道全链路走查

代码依据：FeedbackButton.vue（App.vue:85 全局挂载，右下浮动按钮 `aria-label=反馈`）：submit():49-79 POST /api/feedback，body={type,content,contact,page:location.pathname}；res.ok → toast「感谢反馈！已收到您的意见」，否则「提交失败 请稍后重试」；空内容前端拦（按钮 disabled + toast「请填写反馈内容」:50-52）；textarea maxlength=2000、contact maxlength=200。edge-functions/api/feedback.js：type ∉ {bug,suggestion,other} → 400「反馈类型无效」；content 空/>2000 → 400；IP 日限 10 次 → 429「今日反馈次数已达上限，请明天再试」；存档 fb: 前缀 + 可选 FEEDBACK_WEBHOOK；**未配置 webhook 且存储 memory 时仍返回 {ok:true}**——诚实性关注点。entry `index-m3vMPIl7.js`（已核）。

## T1 正常提交全链路（真实 UI）
- 首页点右下浮动反馈按钮 → 弹窗「意见反馈」→ 选「问题反馈」→ 填内容「r215 测试反馈：导出速度很快，赞」+ 联系方式 test-r215@example.com → 点「提交反馈」。
- 断言：POST /api/feedback 状态 200、响应 `{"ok":true}`；toast「感谢反馈！已收到您的意见」可见（截图）；弹窗关闭且表单重置；payload keys 恰为 {type,content,contact,page}、page=当前路径、无名单/localStorage 等意外数据。
- 诚实性记录：生产 `x-seatmark-storage: memory` + FEEDBACK_WEBHOOK 配置状态不可观测 → 若为 memory 存档即丢弃仍提示成功，如实记录是否构成虚假承诺（报告注记，webhook 是否配置无法从外部判定）。

## T2 表单校验与 XSS
- 空内容：按钮应 disabled（:212 `!content.trim()`）且无网络请求。
- 超长：JS 注入 2001 字符绕过 maxlength → 前端 toast「反馈内容不能超过 2000 字」且无请求；再直接以 fetch 钩子确认 UI 正常输入 2000 字可提交。
- XSS：内容含 `<img src=x onerror=alert(1)><script>alert(2)</script>` 提交 → 无 alert 弹窗（Tab.dialogs 空）、页面无注入节点、提交成功/失败提示正常、pageerror 0。
- 断言各步截图取证。

## T3 限频行为
- 同 tab 连续提交至第 11 次（每次重开弹窗填不同内容）。
- 断言：若 429 出现 → UI 提示为「提交失败 请稍后重试」（前端不透出 429 文案——如实记录该 UX 弱点）；若 memory 存储导致计数不生效（多 isolate）→ 如实记录限频实际未触发。记录 11 次的状态码序列。

## T4 收尾
- 全程 pageerror=0；清 storage + 关全部测试 tab；第 215 轮置顶追加 test-report.md（不提交）。
