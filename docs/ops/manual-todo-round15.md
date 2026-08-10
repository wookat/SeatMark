# 人工待办清单（第十五轮，2026-08-10）

> 给老板/有账号同事的手动执行清单，按 ROI 排序。承接 `docs/ops/manual-todo-round14.md`，未完成项全部保留。通用文案见 `docs/promo/round3/`（如无则用 round10 目录站文案，模板数口径 **222 款**）。

## P0 — 四大站长平台注册验证（约 30 分钟，历史 P0，连续六轮未破口）

第十五轮复查（证据 `docs/ops-round15-evidence/`）：本轮出口 IP 54.69.238.189 风控更严——**百度连总查询都被滑块验证码拦截**（上一轮还能取到"约 1 条"），360 实测仍为 **0**，搜狗被点选验证码拦截，Google 被 reCAPTCHA 拦截，Bing "About 51 results" 全是无关结果（兜底污染，不可作证据）。/vs 矩阵与 /desk-card-generator、/name-card-batch 两个长尾落地页在唯一可核验引擎（360）中**仍未收录**。331 个页面放量只差站长平台主动提交：

1. **百度站长平台**（ziyuan.baidu.com）：注册/登录 → 添加 `www.seatmark.cn` → 验证 → 提交 sitemap（331 条）→ 开通普通收录 API 并保存 token。**round14 前连续五轮确认百度仅收录首页，验证后放量收益最直接。**
2. **Bing Webmaster Tools**（bing.com/webmasters）：Microsoft 账号 → 添加站点 → 提交 sitemap。IndexNow 已连续多轮全端点成功（本轮 331 条五端点全绿）。
3. **搜狗站长平台**（zhanzhang.sogou.com）：注册 → 验证 → 提交 sitemap（round11 实测搜狗真实收录为 0，提交即有从 0 到 1 收益）。
4. **360 站长平台**（zhanzhang.so.com）：注册 → 验证 → 提交 sitemap；另在 `info.so.com/site_submit.html` 提交首页。
5. **本地网络 site: 复查并截图**：用家庭/手机网络查 `site:www.seatmark.cn`（百度/Google/搜狗/必应）并截图发回，作为下一轮基线；重点确认 `/vs`、`/desk-card-generator`、`/name-card-batch` 是否已被收录。**本轮数据中心 IP 已被百度全面拦截，本地网络复查的价值比以往更高。**

## P1 — 高性价比项（承接）

6. **站长之家网站排行榜 top.chinaz.com 申请收录**：https://topuser.chinaz.com/shoulu.aspx → 微信扫码登录 → 提交 `www.seatmark.cn`。约 1 分钟，权重高（round12 新发现，仍未完成）。

## P2 — 30 秒可完成项（承接）

7. **办公人导航 bgrdh.com**：https://www.bgrdh.com/zxly 底部留言框，粘贴 round10 文案，人工拖滑块提交。
8. **发现导航 nav3.cn 回访**：round11 已在线提交，round12 复查仍未过审，2026-08-24 回访「工具大全」分类。
9. **爱资料工具 toolnb.com 回访**：round12 复查仍未过审，2026-08-24 最后回访，仍无则放弃。

## P3 — 高价值目录站人工提交（需注册账号，承接）

10. **AlternativeTo** / **SaaSHub** / **Product Hunt** / **小众软件 Appinn** / **V2EX 分享创造** / **少数派 Matrix**：见 round11 清单 #9-#13。
11. Uneed / Microlaunch / Fazier / Startup Stash / Indie Hackers / turbo0 / CtrlAlt.cc / Toolfolio：邮箱注册即可的免费队列，见 round3 清单 #23-#40。
12. 网际科 webjike.com / 笔点导航 bidianer.com / iTab itab.link / 在线工具 tool.lu / 虫部落 chongbuluo.com：需注册，低优先级。

## P4 — 30 秒/邮件类（承接）

13. **webwiki.com/seatmark.cn**：本地网络打开一次即自动建档（VM 被 Cloudflare 拦）。
14. **邮箱投稿**（模板见 round3 第三节）：ai-bot.cn、果核剥壳、异次元、反斗软件、大眼仔旭、龙轩导航、优设·设计导航。
15. **LaunchingNext 回访**：查收 gunser2lji90savran@gmail.com（第三轮提交）。

## P5 — 决策项（承接）

16. **twelve.tools / findly.tools 互链决策**：免费档要求首页/页脚放对方徽章；或 twelve.tools Pro $25.20 一次性付费免互链。请老板拍板。
17. **sitelike.org**：疑似不收 .cn，2026-09-08 后再试一次，不行则放弃。

## P6 — 内容发布（素材已备好）

18. **优先发布第十五批素材**：`docs/promo/round15/`（小红书 3 篇、知乎 2 篇、公众号 1 篇，主打**少数民族文字/生僻字姓名桌牌不再豆腐块**——维吾尔文 RTL 连写、藏/蒙/彝文、𱁬𰻝 等生僻字全链路渲染 + 缺字导入提醒，机关/学校/医院多民族场景刚需，差异化卖点竞品均无）；第十三、十四批（离线/乱码/对比选型/排座联动）及第五至十二轮未发布素材同样有效。

## 已下线/放弃渠道（不再跟进）

沿用 round12 清单：AI导航网 ainav.cn、百宝箱 tbox.cn、码力全开 maliquankai.com、华军软件园 onlinedown.net、帮小忙 tool.browser.qq.com、书签地球 bookmarkearth.cn 及 round11 前全部已放弃项。
