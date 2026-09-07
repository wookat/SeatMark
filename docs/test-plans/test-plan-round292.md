# 第 292 轮：登录闭环补测 + #294 ① 不吞码 + 同端点 545 率（生产，发码预算 ≤6 次）

前提：UTC 日界已过（00:02 UTC），IP 发码日限已重置。#294 已上线（r291 已确认 entry `index-DX45eo51.js`）。代码依据同 r290/r291（[[default]].js:496-608、AccountView.vue、AppHeader.vue:143/186 头像下拉登出）。

发码预算分配：T1 闭环 1 次；T3 模拟 545 重试 1 次（同一码，不新发）；T4 频率统计 4 次（合计 5 次 + 预留 1）。

## T1 完整登录闭环（主判据，1 次发码）
- mail.tm 新邮箱 → /account 发码（200 delivery=email、storage=blob、toast+倒计时截图）→ 收真码。
- 错码回归（T2）：先输真码±1 → formError「验证码不正确」（400、storage=blob）截图。
- #294 ① UI 路径实证（T3）：CDP Fetch 拦截 verify 模拟一次 545 →「服务暂时不可用，请重试」；解除拦截后**同一真码**重试 → 登录成功（客户端拦截不达服务端，服务端不吞码只能推断——如实标注；若自然遇到真实 545 后同码重试成功则为直接实证）。
- 登录成功：个人中心显示邮箱+配额 3/3 截图。
- 登出：点头部头像（`header button[aria-expanded]`）→「退出登录」→ 回到未登录发码表单；此时页面内 /api/auth/me 或刷新触发的 me 返回 `{"user":null}`；刷新后仍未登录。截图。
- 判据可区分性：登出坏实现（cookie 未清）会刷新后仍个人中心/me 返回 user。

## T4 同端点 545 频率（4 次发码，不同新邮箱）
- POST /api/auth/code ×4（真实地址 mail.tm 新箱，间隔 >2s）：记录状态码与 storage 头。判据：0/4 545（r290 为 3/12）；出现 545 则如实计数并观察响应头。

## T5 常规
- auth payload 仅 {email,code}；名单零外发；pageerror=0；每响应记录 X-SeatMark-Storage（应全 blob）；storage/cookie 清理、context 全关。

## 报告
- test-report.md 第 292 轮置顶章节 + test-plan-round292.md；关键截图（发送/错码/登录/登出）。
