# 运营第十二轮记录（2026-08-10）

> 角色：growth/operations。范围：收录复查、IndexNow 全量重推、目录站第五批尝试、素材第十二批、长尾词缺口清单、人工待办更新。
> 证据目录：`docs/ops-round12-evidence/`。基线：第十一轮 `docs/ops-round11.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（100.23.34.160）；百度/必应/360 取到页面，Google 被 reCAPTCHA 拦截，搜狗被点选验证码拦截。

## 一、收录复查（site:www.seatmark.cn，2026-08-10）

| 引擎 | 第十轮 | 第十一轮 | 本轮实测（2026-08-10） | 变化 |
|---|---|---|---|---|
| 百度 site: | 约 1 个（首页） | 约 1 个（首页） | **约 1 个**：「找到相关结果数约1个」，首条即 SeatMark 首页 title+描述（`baidu-site-2026-08-10.png`） | 持平（连续三轮确认首页收录，其余 322 页仍未放量） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：异常流量 reCAPTCHA 拦截，IP 100.23.34.160（`google-site-2026-08-10.png`） | 不可比 |
| Bing site: | "About 50"兜底污染 | "About 50"兜底污染 | "About 307,000 results"，首屏全是 google.com/wikipedia 等无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-10.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（antispider） | 0（首次实测） | **无法核验**：点选验证码拦截（「请依次点击【醛,壕,晚,淬】」）（`sogou-site-2026-08-10.png`） | 不可比（沿用上轮实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」，提示提交 `info.so.com/site_submit.html`）（`360-site-2026-08-10.png`） | 持平 |

- 结论：百度连续三轮仅收录首页；360 仍为 0；搜狗本轮被拦（上轮实测 0 仍是基线）；Google 被拦；Bing 兜底污染。P0（四大站长平台验证）依旧未解除，且论据未变——322 个内页放量只差站长平台主动提交。

## 二、IndexNow 全量重推（2026-08-10 08:56 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **323 个 `<loc>`**，全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 323 条）至五端点。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、目录站/导航站第五批尝试

详见 `docs/marketing/round12/directory-submissions-round12.md`。本轮实测 8 个未尝试过的渠道：**0 个可免登录在线提交**。最有价值发现是**站长之家网站排行榜 top.chinaz.com**——有正式「申请收录」入口（topuser.chinaz.com/shoulu.aspx），但需微信扫码登录，转人工 P1（约 1 分钟）。其余：龙轩工具箱需兔小巢登录、ainav 仅收 AI 工具、tbox/华军/帮小忙无入口、码力全开非目录站、iTab 无公开入口。

上轮渠道回访：**nav3.cn 提交仍未过审显示**（首页/工具大全分类未见 SeatMark，`nav3-recheck-2026-08-10.png`）；**toolnb 留言板仍未过审**（仍为 16 条留言停留 2020 年，`toolnb-recheck-2026-08-10.png`）。均按原计划 2026-08-24 回访。

## 四、素材第十二批（已入库 `docs/promo/round12/`）

- `xiaohongshu-posts-round12.md`：3 篇
- `zhihu-answers-round12.md`：2 篇（问答式）
- `wechat-article-round12.md`：1 篇

本批统一主打：**不干胶套打毫米级精度 + 打印校准向导**（打印偏移是同类工具高频差评点，实测精度 ≤0.35mm）与**电子墨水桌签导出**（会议室电子桌牌新场景，eink 三档分辨率精确像素导出）。

## 五、长尾词缺口清单

见 `docs/marketing/round12/seo-keywords-round12.md`：基于百度下拉实测（12 个种子词），围绕「不干胶打印偏移/标签纸套打/电子桌牌」筛出 10 个尚未覆盖的长尾词（与 round8/round10/round11 共 30 词清单已去重）。核心发现：「偏移/错位/对不准」三个同义表述在不干胶场景下拉全是问句、几乎无在线工具型竞品承接；「电子桌牌」下拉已出现硬件品牌词但无「怎么打印/导出」教程承接。

## 六、人工待办

见 `docs/marketing/round12/manual-todo-round12.md`。P0 仍为四大站长平台注册验证；本轮新增 P1：站长之家网站排行榜微信扫码提交（约 1 分钟，权重高）。

## 七、结论与下一步

1. 百度连续三轮仅收录首页，322 个内页放量的唯一破口仍是站长平台验证提交（P0，依赖老板人工，约 30 分钟）。
2. IndexNow 323 条五端点全部成功（连续第 N 轮），Bing/Yandex 建议 2026-08-24 回访。
3. 目录站免登录渠道连续五轮摸底确认枯竭（累计 30+ 站，仅 nav3 一家可免登录且尚未过审）。本轮唯一新增可行项是站长之家收录（需微信扫码，转 P1）。**建议后续轮次本渠道线只做回访不再新找**，产出重心转向内容素材 + 教程页长尾承接。
4. 长尾词方向建议：优先做一篇「不干胶打印偏移校准」权威长文（一次承接 6 个缺口词）+ 一篇「电子墨水桌牌导出」教程（新场景无竞品承接）。
