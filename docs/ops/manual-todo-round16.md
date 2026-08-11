# 人工待办清单（第十六轮，2026-08-11）

> 给老板/有账号同事的手动执行清单，按 ROI 排序。承接 `docs/ops/manual-todo-round15.md`，未完成项全部保留。通用文案见 `docs/promo/round3/`（如无则用 round10 目录站文案，模板数口径 **222 款**）。

## P0 — 四大站长平台注册验证（约 30 分钟，历史 P0，连续七轮未破口）

第十六轮复查（证据 `docs/ops-round16-evidence/`）：本轮出口 IP 54.201.200.193，风控格局与 round15 一致——**百度总查询仍被滑块验证码拦截**，搜狗被点选验证码拦截，Google 被 reCAPTCHA 拦截，360 实测仍为 **0**，Bing "About 767 results" 首屏全是 Farm Aid 音乐节等无关结果（兜底污染，不可作证据）。/vs 矩阵与 /desk-card-generator、/name-card-batch 两个长尾落地页在唯一可核验引擎（360）中**仍未收录**。331 个页面放量只差站长平台主动提交：

1. **百度站长平台**（ziyuan.baidu.com）：注册/登录 → 添加 `www.seatmark.cn` → 验证 → 提交 sitemap（331 条）→ 开通普通收录 API 并保存 token。**round14 前连续五轮确认百度仅收录首页，验证后放量收益最直接。**
2. **Bing Webmaster Tools**（bing.com/webmasters）：Microsoft 账号 → 添加站点 → 提交 sitemap。IndexNow 已连续多轮全端点成功（本轮 331 条五端点全绿）。
3. **搜狗站长平台**（zhanzhang.sogou.com）：注册 → 验证 → 提交 sitemap（round11 实测搜狗真实收录为 0，提交即有从 0 到 1 收益）。
4. **360 站长平台**（zhanzhang.so.com）：注册 → 验证 → 提交 sitemap；另在 `info.so.com/site_submit.html` 提交首页。
5. **本地网络 site: 复查并截图**：用家庭/手机网络查 `site:www.seatmark.cn`（百度/Google/搜狗/必应）并截图发回，作为下一轮基线；重点确认 `/vs`、`/desk-card-generator`、`/name-card-batch` 是否已被收录。数据中心 IP 连续两轮被百度全面拦截，本地网络复查价值持续上升。

## P0.5 — 产品线上能力相关运维（需要老板账号权限）

6. **EdgeOne KV 绑定**：账号体系线上因 KV 未绑定暂不可用，配额/付费承接受阻（见 `docs/competitive-analysis.md` P0-3）。在 EdgeOne 控制台为 Pages 项目绑定 KV 命名空间并核对环境变量后重新部署。绑定前落地页勿显性宣传登录权益。
7. **SES 发信认证**：为发信域名完成邮件服务（如腾讯云 SES）的域名所有权验证、SPF/DKIM/DMARC 记录配置及发信地址审核，打通注册/找回密码等邮件链路。DNS 记录可由 Devin 协助生成，控制台操作需老板账号。

## P1 — 高性价比项（承接）

8. **站长之家网站排行榜 top.chinaz.com 申请收录**：https://topuser.chinaz.com/shoulu.aspx → 微信扫码登录 → 提交 `www.seatmark.cn`。约 1 分钟，权重高（round12 新发现，仍未完成）。

## P2 — 30 秒可完成项（承接）

9. **办公人导航 bgrdh.com**：https://www.bgrdh.com/zxly 底部留言框，粘贴 round10 文案，人工拖滑块提交。
10. **发现导航 nav3.cn 回访**：round11 已在线提交，round12 复查仍未过审，2026-08-24 回访「工具大全」分类。
11. **爱资料工具 toolnb.com 回访**：round12 复查仍未过审，2026-08-24 最后回访，仍无则放弃。

## P3 — 高价值目录站人工提交（需注册账号，承接）

12. **AlternativeTo** / **SaaSHub** / **Product Hunt** / **小众软件 Appinn** / **V2EX 分享创造** / **少数派 Matrix**：见 round11 清单 #9-#13。
13. Uneed / Microlaunch / Fazier / Startup Stash / Indie Hackers / turbo0 / CtrlAlt.cc / Toolfolio：邮箱注册即可的免费队列，见 round3 清单 #23-#40。
14. 网际科 webjike.com / 笔点导航 bidianer.com / iTab itab.link / 在线工具 tool.lu / 虫部落 chongbuluo.com：需注册，低优先级。

## P4 — 30 秒/邮件类（承接）

15. **webwiki.com/seatmark.cn**：本地网络打开一次即自动建档（VM 被 Cloudflare 拦）。
16. **邮箱投稿**（模板见 round3 第三节）：ai-bot.cn、果核剥壳、异次元、反斗软件、大眼仔旭、龙轩导航、优设·设计导航。
17. **LaunchingNext 回访**：查收 gunser2lji90savran@gmail.com（第三轮提交）。

## P5 — 决策项（承接）

18. **twelve.tools / findly.tools 互链决策**：免费档要求首页/页脚放对方徽章；或 twelve.tools Pro $25.20 一次性付费免互链。请老板拍板。
19. **sitelike.org**：疑似不收 .cn，2026-09-08 后再试一次，不行则放弃。

## P6 — 内容发布（素材已备好）

20. **优先发布第十六批素材**：`docs/promo/round16/`（小红书 3 篇、知乎 2 篇、公众号 1 篇，主打**「导出即所见、坏页零交付」可靠性叙事**——预览/导出所见即所得（#200/#202）、截断自动重渲+持续截断报错拦截（#207/#208）、76 篇教程全量质检（#204）、300dpi、打印校准 ≤0.35mm、离线可用、数据不出浏览器，另带**组合字段**（多列拼一格，如「第{班级}·{姓名}」，r199 实测可用）新卖点）；第十五批（少数民族文字/生僻字）及此前各轮未发布素材同样有效。

## 已下线/放弃渠道（不再跟进）

沿用 round12 清单：AI导航网 ainav.cn、百宝箱 tbox.cn、码力全开 maliquankai.com、华军软件园 onlinedown.net、帮小忙 tool.browser.qq.com、书签地球 bookmarkearth.cn 及 round11 前全部已放弃项。
