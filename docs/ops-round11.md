# 运营第十一轮记录（2026-08-10）

> 角色：growth/operations。范围：收录复查、IndexNow 全量重推、目录站第四批尝试、素材第十一批、长尾词缺口清单、人工待办更新。
> 证据目录：`docs/ops-round11-evidence/`。基线：第十轮 `docs/ops-round10.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（100.23.34.160）；百度/搜狗/必应/360 均取到页面，Google 被 reCAPTCHA 拦截。

## 一、收录复查（site:www.seatmark.cn，2026-08-10）

| 引擎 | 第九轮 | 第十轮 | 本轮实测（2026-08-10） | 变化 |
|---|---|---|---|---|
| 百度 site: | 无法核验（滑块） | 约 1 个（首页） | **约 1 个（首页已收录）**：首条即 SeatMark 首页 title+描述（`baidu-1-result-2026-08-10.png`） | 持平（连续两轮确认首页收录，其余 322 页仍未放量） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：异常流量 reCAPTCHA 拦截，IP 100.23.34.160（`google-recaptcha-blocked-2026-08-10.png`） | 不可比 |
| Bing site: | "About 3,970"兜底污染 | "About 50"兜底污染 | "About 50 results"，首屏全是 support.google.com 等无关结果，**仍为兜底污染，不可作证据**（`bing-fallback-polluted-2026-08-10.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（antispider） | 无法核验（antispider） | **0（首次取到实测数据）**：「搜狗已为您找到约0条相关结果……站内没有找到能和 www.seatmark.cn 匹配的内容」（`sogou-zero-results-2026-08-10.png`） | **新基线**：搜狗真实收录为 0（非拦截） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」，提示到 `info.so.com/site_submit.html` 提交）（`360-zero-results-2026-08-10.png`） | 持平 |

- 结论：百度连续两轮确认首页收录（约 1 条）；**搜狗本轮未被 antispider 拦截，首次实测收录为 0**——与 360 一样属「真实 0」，站长平台提交是唯一破口；Google 仍被拦；Bing 兜底污染。P0（四大站长平台验证）依旧未解除。

## 二、IndexNow 全量重推（2026-08-10 05:47 UTC）

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

## 三、目录站/导航站第四批尝试

详见 `docs/marketing/round11/directory-submissions-round11.md`。本轮实测 7 个未尝试过的渠道：**1 个成功在线提交**（发现导航 nav3.cn，开放式「+」提交无需登录，待审核）；tool.lu/虫部落需登录；hao.logosc.cn、guozhivip.com 已下线/停止；67tool、addog 无收录入口。

上轮 toolnb 留言板回访：**仍未过审显示**（留言板停留在 2020 年的 16 条留言），2026-08-24 最后回访一次。

## 四、素材第十一批（已入库 `docs/promo/round11/`）

- `xiaohongshu-posts-round11.md`：3 篇
- `zhihu-answers-round11.md`：2 篇（问答式）
- `wechat-article-round11.md`：1 篇

本批统一主打：**生僻字姓名不出豆腐块**（婚宴/考场点名场景痛点，第 123–125 轮扩展字库置栈首 + 生僻字检测提醒）与 **Firefox/Safari 导出一致**（第 127 轮修复 Firefox 导出字形平切）。

## 五、长尾词缺口清单

见 `docs/marketing/round11/seo-keywords-round11.md`：基于百度下拉实测，围绕「生僻字/名字打印/席位卡」筛出 10 个尚未覆盖的长尾词（与 round8/round10 共 20 词清单已去重）。核心发现：「生僻字」族群问句几乎无工具型竞品承接，是本站独有卖点的天然流量洼地。

## 六、人工待办

见 `docs/marketing/round11/manual-todo-round11.md`。P0 仍为四大站长平台注册验证（本轮新增论据：搜狗实测 0 收录，提交即有从 0 到 1 收益）。

## 七、结论与下一步

1. **搜狗收录首次实测为 0**（此前四轮均被验证码拦截）：与 360 一致，均为「已知真实 0」，站长平台提交是唯一破口，P0 论据更充分。
2. 百度连续两轮确认首页收录；322 个内页放量仍需百度站长平台验证提交。
3. IndexNow 323 条五端点全部成功（连续第 N 轮），Bing/Yandex 建议 2026-08-24 回访。
4. 目录站免登录渠道第四轮摸底后彻底见底：新增 nav3.cn 在线提交成功（待审核）；2 站已死亡。后续轮次建议不再消耗时间找免登录渠道，重心转向老板人工执行 P0/P2。
