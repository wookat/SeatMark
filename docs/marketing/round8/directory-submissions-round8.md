# 导航站 / 目录站提交执行台账（第八轮，2026-08-08）

> 承接 `round3/directory-submissions-round3.md` 的 40 站清单。本轮实测了 7 个免登录候选渠道，**全部因登录墙 / Cloudflare 风控 / 域名拒收 / 互链要求而无法在线完成**，均如实记录并转入 `manual-todo-round8.md`。证据截图存 `evidence/`。

## 一、本轮实测结果

| # | 站点 | 实测结果（2026-08-08） | 状态 | 回访日期 | 证据 |
|---|---|---|---|---|---|
| 1 | sitelike.org（add-site 免登录表单） | 表单可打开，但「Check First」校验对 `https://www.seatmark.cn` / `https://seatmark.cn` 均返回 "Apologies, we can't accept this website!!!"（疑似不收 .cn 域名或站点数据未收录） | ❌ 拒收 | 2026-09-08 换周期再试 | `sitelike-rejected-2026-08-08.png` |
| 2 | webwiki.com/seatmark.cn（自动建档） | Cloudflare "Verify you are human" 复选框点击后仍循环验证（数据中心 IP 风控，与第三轮一致） | ❌ 被风控 | 转人工（本地网络 30 秒） | — |
| 3 | 爱达杂货铺 adzhp.cc | 提交方式已从表单改为「留言板留言」，且**留言必须登录**（站内账号）；/submit 页仅为说明页 | ❌ 需登录 | 转人工 | — |
| 4 | 360 网站收录 info.so.com/site_submit.html | 跳转 i.360.cn 登录页，需 360 账号 | ❌ 需账号 | 转人工 | — |
| 5 | twelve.tools/submit | 免费档明确要求先在 seatmark.cn 首页/页脚放其 dofollow 反链徽章；Pro $25.20 免互链 | ⚠️ 需产品决策（互链） | 待老板决策 | — |
| 6 | saashub.com/submit | 提交需注册并验证产品归属（Register/Login）；其 "Submit List" 汇总了 107 个可提交目录，值得人工批量使用 | ❌ 需账号 | 转人工（高价值） | — |
| 7 | 百度/搜狗/Google 收录复查（顺带） | 均被验证码拦截，见 `seo-indexing-round8-2026-08-08.md` | — | — | evidence/ 多图 |

## 二、既有渠道状态跟踪

| 渠道 | 上轮状态 | 本轮状态 | 下一步 |
|---|---|---|---|
| LaunchingNext（第三轮已提交） | 待审核 | 未收到审核邮件通知（邮箱由老板掌握，无法核验） | 请老板查收 gunser2lji90savran@gmail.com；2026-08-22 回访 |
| IndexNow 5 端点 | 307 URL 全成功 | **313 URL 全成功**（含 6 个新模板详情页） | 2026-08-22 复查 Bing/Yandex 收录 |
| ai-bot.cn | 邮箱收录（未发） | 未变 | 转人工发邮件 |
| AlternativeTo / Product Hunt / Uneed / Fazier 等 | 需注册账号 | 未变 | 见 manual-todo-round8 |

## 三、结论

- 免登录可在线提交的渠道经三轮消耗已基本枯竭；剩余高价值渠道（AlternativeTo、Product Hunt、SaaSHub、小众软件、V2EX、少数派等）全部需要账号/手机号/邮箱验证，需老板一次性注册后交回凭据或人工执行（详见 manual-todo-round8）。
- 数据中心 IP 持续触发 Cloudflare/搜索引擎风控，webwiki、百度、Google、搜狗类渠道建议统一改为本地网络人工执行。
