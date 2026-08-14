# 人工待办清单（第二十五轮，2026-08-14）

> 给老板/有账号同事的手动执行清单，按 ROI 排序。承接 `docs/ops/manual-todo-round24.md`，未完成项全部保留。

## P0 — 站长平台注册验证 + Google Search Console（约 35 分钟）

第二十五轮复查（证据 `docs/ops-round25-evidence/`）：**Google 首次实测确认收录、核心页（/、/templates、/guides、/vs、/papers）全覆盖**；百度仍约 1 条仅首页、搜狗 0、360 0。国内 334 个页面放量只差站长平台主动提交（连续十六轮）：

1. **Google Search Console**（search.google.com/search-console，本轮新增）：Google 账号 → 添加资源 `www.seatmark.cn` → DNS 或 HTML 文件验证 → 提交 sitemap。Google 已实测收录，验证后可看真实展现/点击数据并加速新页收录，**当前 ROI 最高**。
2. **百度站长平台**（ziyuan.baidu.com）：注册/登录 → 添加站点 → 验证 → 提交 sitemap（334 条）→ 开通普通收录 API 并保存 token。
3. **Bing Webmaster Tools**（bing.com/webmasters）：Microsoft 账号 → 添加站点 → 提交 sitemap（IndexNow 已连续多轮五端点全绿）。
4. **搜狗站长平台**（zhanzhang.sogou.com）：注册 → 验证 → 提交 sitemap（连续三轮实测 0）。
5. **360 站长平台**（zhanzhang.so.com）：注册 → 验证 → 提交 sitemap。本轮实测 `info.so.com/site_submit.html` 免登录提交入口已强制跳转 360 账号登录，无免登录通道。
6. **神马站长平台**（zhanzhang.sm.cn）：注册 → 验证 → 提交 sitemap（round24 实测 0）。

## P1 — B 站教程视频（本轮新增，脚本已备好）

7. **注册/使用 B 站账号发布教程视频**：分镜脚本见 `marketing/batch25/bilibili-video-script-batch25.md`（3–4 分钟考场座签实操，含断网演示信任分镜）。录屏 + 简单剪辑约 1–2 小时。注册需手机号，故列人工项。

## P2 — 社群发帖（本轮新增，素材已备好，注意遵守社区规则不刷帖）

8. **百度贴吧**（班主任吧/教师吧/行政吧）：以经验分享帖发布 batch25 素材改写版，需百度账号。
9. **豆瓣小组**（备婚/行政类小组）：发布婚宴席位卡 DIY 帖（`marketing/batch25/xiaohongshu-post-batch25-2.md` 改写），需豆瓣账号。

## P2.5 — 产品线上能力相关运维（承接 round24 P0.5）

10. **EdgeOne KV 绑定**、11. **SES 发信认证**、12. **AI 设计免费通道 API key**：详见 `docs/ops/manual-todo-round24.md` #7–#9，未变。

## P3 — 目录站/回访（承接）

13. **站长之家 top.chinaz.com 申请收录**：微信扫码 1 分钟（round12 发现，仍未完成）。
14. **办公人导航 bgrdh.com** 留言提交（30 秒，人工滑块）。
15. **nav3.cn / toolnb.com 回访**：2026-08-24 到期，下一轮执行。
16. AlternativeTo / SaaSHub / Product Hunt / 小众软件 / V2EX / 少数派等注册类清单：见 round24 清单 #14–#16，未变。
17. webwiki / 邮箱投稿 / LaunchingNext 回访 / twelve.tools 决策 / sitelike.org：见 round24 清单 #17–#21，未变。

## P4 — 内容发布（素材已备好）

18. **优先发布第二十五批素材**：`marketing/batch25/`（小红书 2、知乎 2、公众号 2、B 站脚本 1，主打免费/无需安装/名单不出浏览器/Excel 一键导入，覆盖考场座签、会议桌牌、婚宴席位卡、幼儿园姓名贴四场景）；第二十四批（诚信配额）、第二十三批（搜索隐私）可组合投放。

## 已下线/放弃渠道

沿用 round12 清单，不再跟进。
