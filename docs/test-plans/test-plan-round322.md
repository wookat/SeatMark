# 第 322 轮：生产冒烟（#334：导出错误/分享/覆写 toast 接入 t()）

环境：生产 https://www.seatmark.cn ，录屏。前置：轮询主包 ≠ index-B2uT6OYC.js / 英文分包 ≠ en-fStX4_se.js，且 curl 新英文分包含 'PNG generation failed'、'rendered blank'、'just retry'（错误类 toast 的替代验证，UI 难稳定触发）。>20 分钟未部署则报告说明。

## T1 新英文分包键（curl，错误类 toast 替代验证）
- PASS：新 en-*.js 各含 'PNG generation failed' / 'rendered blank' / 'just retry' ≥1 处。若过程中恰好复现偶发导出失败则顺带截图验证英文 toast。

## T2 /en/studio 单张覆写保存英文 toast
- /en/studio?demo=1（清 localStorage），点预览第一张标签打开单张覆写弹窗，改姓名字段任一字符，点 'Save override'。
- PASS：toast **'Single-label override saved'**（若 '单张覆写已保存' 则 FAIL）。

## T3 /en/studio 分享链接复制英文 toast（需登录）
- copyReferralLink 仅登录后可触发（PreviewArea.vue:360-368、1088-1094：分享提示条仅 auth.isLoggedIn 显示「复制分享链接」按钮）。用既有账号 r315seatmark@emalupe.com / NewProd315!pass 登录（不注册、不发邮件，仅耗验证码），带水印导出一次触发分享提示条，点 copy 按钮。
- PASS：toast **'Share link copied'** 或（剪贴板失败时）'Copy failed'。结束后登出。
- 若登录被判不符合"匿名"要求或验证码不可用，则标 untested 并说明。

## T4 /en/studio PNG 导出成功链路回归
- PASS：toast 'PNG images exported (26 labels zipped)' 英文；顺带记录观察②（空白标签失败）是否复现。

## T5 中文 /studio 回归
- /studio?demo=1 同样做单张覆写保存。PASS：toast「单张覆写已保存」中文。

## T6 390px /en/studio（CDP 390×844）
- PASS：scrollWidth==innerWidth、pageerror 0。

收尾：登出（如登录过）、清浏览器存储。产出：录屏、test-report.md 第 322 轮章节（不提交）。
