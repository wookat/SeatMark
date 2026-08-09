# 人工待办清单（第九轮，2026-08-09）

> 给老板/有账号同事的手动执行清单，按 ROI 排序。承接 `round8/manual-todo-round8.md`，未完成项全部保留。通用文案见 `round3/directory-submissions-round3.md` 第三节（模板数口径：**222 款**）。

## P0 — 四大站长平台注册验证（解决收录为 0 的根因，约 30 分钟）

第九轮复查确认（证据 `docs/ops-round9-evidence/`）：360 收录仍为 0，百度/Google/搜狗被数据中心 IP 反爬拦截无法核验。收录破零唯一可靠路径仍是站长平台验证 + 主动提交：

1. **百度站长平台**（ziyuan.baidu.com）：注册/登录 → 添加 `www.seatmark.cn` → HTML 标签或文件验证 → 提交 sitemap `https://www.seatmark.cn/sitemap.xml`（现 323 条）→ 开通普通收录 API 并保存 token（给后续轮次自动推送用）。
2. **Bing Webmaster Tools**（bing.com/webmasters）：Microsoft 账号 → 添加站点 → 提交 sitemap。IndexNow 已连续多轮全量推送成功（本轮 323 条五端点全 200/202），验证后可看收录明细并加速生效。
3. **搜狗站长平台**（zhanzhang.sogou.com）：注册 → 验证 → 提交 sitemap。
4. **360 站长平台**（zhanzhang.so.com）：注册 → 验证 → 提交 sitemap；另在 `info.so.com/site_submit.html` 提交首页（需登录，360 结果页明确提示此入口）。
5. **本地网络 site: 复查并截图**：请用家庭/手机网络查 `site:www.seatmark.cn`（百度/Google/搜狗/必应）并截图发回，作为下一轮基线（VM 数据中心 IP 已连续三轮被拦截）。

## P1 — 高价值目录站人工提交（需注册账号）

6. **AlternativeTo**：邮箱注册 → Add application → 对标 "name tag generator / seating chart maker / place card maker"，英文文案见 round3 第三节。
7. **SaaSHub**（saashub.com/submit）：注册 → 提交产品 → 用其免费 "Submit" 工具向 107 个目录批量分发。
8. **Product Hunt**：注册 → 3-5 张英文截图 → 周二至周四发布。
9. **小众软件 Appinn**（meta.appinn.net）：Discourse 注册 → 发现频道发帖，标题「SeatMark 座签——纯前端批量生成考场座签/桌牌，名单零上传」。
10. **V2EX 分享创造节点** / **少数派 Matrix 投稿**：需注册（V2EX 新号需积累）。
11. Uneed / Microlaunch / Fazier / Startup Stash / Indie Hackers / turbo0 / CtrlAlt.cc / Toolfolio：邮箱注册即可的免费队列，见 round3 清单 #23-#40。

## P2 — 30 秒/邮件类

12. **webwiki.com/seatmark.cn**：本地网络打开一次即自动建档（VM 被 Cloudflare 拦）。
13. **邮箱投稿**（模板见 round3 第三节）：ai-bot.cn（info@ai-bot.cn）、果核剥壳、异次元、反斗软件、大眼仔旭、龙轩导航。
14. **爱达杂货铺 adzhp.cc**：注册站内账号后按留言板既有格式（名称/地址/介绍）留言申请收录。
15. **LaunchingNext 回访**：查收 gunser2lji90savran@gmail.com 是否有审核通过邮件（第三轮提交）。

## P3 — 决策项

16. **twelve.tools / findly.tools 互链决策**：免费档要求首页/页脚放对方徽章（dofollow 互链）；或 twelve.tools Pro $25.20 一次性付费免互链。请老板拍板。
17. **sitelike.org**：疑似不收 .cn，2026-09-08 后再试一次，不行则放弃。

## P4 — 内容发布（素材已备好）

18. 发布第九批素材：`docs/promo/xiaohongshu-posts-round9.md`（3 篇）、`docs/promo/zhihu-answers-round9.md`（2 篇）、`docs/promo/wechat-articles-round9.md`（2 篇）；第五至八轮未发布素材同样有效（round8 及更早见 `docs/marketing/`）。
