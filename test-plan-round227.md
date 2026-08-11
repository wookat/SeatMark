# 第 227 轮：/account 账号页与登录链路容错取证（生产，无代码变更轮）

代码依据：AccountView.vue:36-62（isValidEmail 前端拦截 formError=「请输入正确的邮箱地址」；失败时 formError=err.message、codeSent 不置 true——不得出现假成功）；[[default]].js:496-541（POST /api/auth/code：IP 日限频；SES 失败返回 502 `{error:'验证码发送失败，请稍后再试'}`；线上不回显 devCode）；auth.ts:55-60（payload 仅 {email}）；PreviewArea.vue:1055-1356（未登录配额文案「登录后每天 3 次」）。
测试邮箱：devin-r227-test@example.com（假邮箱）。

## T1 未登录态 UI（1280 与 390 视口）
- 直链 /account：可见「邮箱验证码登录」表单、说明文案（每日 N 次无水印导出）、「获取验证码」按钮；390px 视口截图无横向溢出（scrollWidth<=390+1）。pageerror=0。

## T2 前端邮箱校验（须零网络请求）
- 空值提交与 `abc`（非法）提交：页面出现红字「请输入正确的邮箱地址」（截图）、期间 /api/auth/code 请求数=0、验证码输入框不出现（codeSent 未置 true）。

## T3 真实发送验证码（核心容错取证）
- 输入 devin-r227-test@example.com → 点「获取验证码」，CDP 捕获 POST /api/auth/code 请求与响应码/响应体：
  - 若非 2xx（预期 502）：UI 必须透出 formError=响应体 error 文案（非「已发送」toast）、验证码框不出现 — 判 passed（容错诚实）
  - 若 200 delivery=email：如实记录「发送成功」并注明 memory 存储下验证码 10 分钟内可能因实例回收丢失的风险 — 如实记录
  - 若 200 delivery=stub 带 devCode：线上不应出现 — 判 failed（定级）
- 截图 UI 错误/成功态。

## T4 可重试性
- T3 失败后：「获取验证码」按钮 disabled 状态在 sending 结束后恢复可点（button.disabled=false），再点一次仍发出请求（限频则 UI 透出限频文案，如实记录响应码 429/口径）。

## T5 请求 payload 隐私
- 先在 /studio 导入 3 行名单（sessionStorage 有名单）再到 /account 发送：POST /api/auth/code body keys 恰为 {email}，全部请求 URL/body 无名单姓名串。

## T6 未登录配额文案一致性
- /studio 无水印导出入口/配额弹窗文案含「登录后…3 次」（QUOTA_USER_DAILY=3 实际渲染值），与 /account 页说明一致；截图。

## T7 直链刷新与 back/forward
- /account 直链刷新正常渲染；/ → /account → back → forward：URL 与渲染正常、无 pageerror。

## T8 收尾
- 全程 pageerror=0；清 storage + 关全部 tab；第 227 轮置顶追加 test-report.md。发现 P 级即时 message_parent。
