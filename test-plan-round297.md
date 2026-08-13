# 第 297 轮：UI 口径注册补测（register→545→前端自动 login 收尾，生产 www.seatmark.cn）

背景：r296 注册项被 IP 日限 429 阻断；限额已重置（用户 curl 已用 3 次，剩 17）。用户 curl 口径：注册请求 3/3 raw 545 但服务端副作用完成（putUser 同步），随后登录成功。本轮 UI 口径验证前端 register() 5xx→login() 收尾（auth.ts，origin/main 2599ad1：register catch ApiError≥500 → login，login 重试上限 5、600ms·n）。部署确认：`x-seatmark-rev: r298`、`x-seatmark-storage: blob`。

方法同 r296：可视 CDP 浏览器 UI + async 监听器（`/home/ubuntu/r297_listen.py` → `r297_net.jsonl`）+ 录屏。UI 注册 ≤3 个新账号，不触碰 /api/auth/code。

## T1 UI 注册 ×2–3（核心）：用户视角 0 可见失败
- 账号 seatmark297ui1..3@example.com / uipass297{N}，注册模式提交。
- 判据（每个账号）：UI 全程只见「注册中...」→ 最终进入个人中心（邮箱正确显示），**表单不出现「服务暂时不可用，请重试」**；若 register 545，监听器应显示 register 5xx 后紧跟自动 login POST（600ms·n 节奏）收尾 200。任一账号 UI 最终失败 → FAIL。
- 统计：register raw 545 数 / 尝试数；自动收尾请求序列如实记录（对比用户 curl 口径 3/3 545）。

## T2 登录态形状
- 个人中心 share 链接（?ref=码）、配额 3/3、使用统计（注册时间/累计登录）区块渲染正常；监听器确认注册/登录成功响应含 loginCount、share{code,...}，无 passwordHash，payload 键仅 {email,password}。

## T3 回归：刷新保持登录 + 登出
- F5 后仍个人中心（me 200 user）；头像下拉「退出登录」→ me=`{"user":null}` → 匿名表单。

## T4 观察项（不实测，写进报告）
- 用户实测：错密码限流 12 次才 429（限 10，deferred write 丢 1 次失败计数）；锁定期正确密码也 429，15 分钟自动恢复——记录为已知代价观察项，非 P 项。

## 收尾
- 全部响应头 r298/blob 核对；pageerror=0；清 storage/cookie、停监听器；新账号如实上报；报告 test-report.md 第 297 轮置顶。
