# 第五轮收录进展报告（2026-08-06）

> 核验方式：真实浏览器逐一执行查询（2026-08-06 09:2x-09:4x UTC），证据截图存 `evidence/`。
> 上轮基线见 `../round4/seo-indexing-round4-2026-08-05.md`。

## 收录快照（与第四轮对比）

| 引擎 | 第四轮（08-05 深夜） | 本轮（08-06 上午） | 变化 | 证据 |
|---|---|---|---|---|
| 百度 site: | 1 个（首页） | **1 个**（首页，标题/描述完整展示） | ➖ 持平 | `evidence/baidu-site-2026-08-06.png` |
| 百度 品牌词「SeatMark 座签」 | — | ⚠️ 首屏未见 seatmark.cn（返回 StyleSeat 等英文结果，疑与数据中心 IP 地域判定有关，供参考） | 待观察 | `evidence/baidu-brand-2026-08-06.png` |
| 百度 长尾「考场座位标签批量生成」 | — | 首屏以图片聚合为主，未见 seatmark.cn 自然结果 | 待突破 | `evidence/baidu-longtail-2026-08-06.png` |
| Google site: | 1 个（首页） | **1 个**（首页正常展示） | ➖ 持平 | `evidence/google-site-2026-08-06.png` |
| Google 品牌词「SeatMark 座签」 | — | ✅ **自然结果第 1 位**，且触发 **AI Overview** 完整介绍产品（免费/本地处理/批量制签） | ⬆️ 明显进步 | `evidence/google-brand-2026-08-06.png` |
| 必应 Bing site: | 无有效展示（兜底结果） | 仍为兜底无关结果（不可作收录证据） | ➖ | `evidence/bing-site-2026-08-06.png` |
| 必应 Bing 品牌词「SeatMark 座签」 | — | ✅ **第 1、2 位均为 seatmark.cn**（首页 + /guides 教程中心），说明 Bing 已实际收录 ≥2 页 | ⬆️ 明显进步 | `evidence/bing-brand-2026-08-06.png` |
| 搜狗 site: | 0（明确未收录） | **0**（「未找到 seatmark.cn 站内的内容」） | ➖ 无变化 | `evidence/sogou-site-2026-08-06.png` |
| 360 site: | 0 | **0**（「未找到相关搜索结果」） | ➖ 无变化 | `evidence/360-site-2026-08-06.png` |

**结论**：
1. 本轮首次确认**品牌词已可带来精准流量**：Google 品牌词第 1 + AI Overview，Bing 品牌词包揽前两位（含 /guides 内页，证明 Bing 收录深度 > site: 展示）。
2. site: 收录深度仍是瓶颈（百度/Google 仍只展示首页；搜狗/360 为 0），**最大杠杆不变：百度站长平台验证 + API 主动推送（人工 P0）**。
3. 长尾词（考场座位标签批量生成等）尚无自然排名，需继续内容外发（知乎/公众号引用长尾教程 URL）。

## IndexNow 全量推送回执（本轮已执行，2026-08-06 09:26 UTC）

从线上 `https://www.seatmark.cn/sitemap.xml` 提取 **307 条 URL** 全量推送：

| 端点 | HTTP 状态 | 结论 |
|---|---|---|
| `https://www.bing.com/indexnow` | **200** | ✅ 接收成功 |
| `https://yandex.com/indexnow` | **202** `{"success":true}` | ✅ 接收成功 |
| `https://search.seznam.cz/indexnow` | **200** | ✅ 接收成功 |
| `https://searchadvisor.naver.com/indexnow` | **200** | ✅ 接收成功 |
| `https://api.indexnow.org/indexnow` | **200** | ✅ 接收成功 |

推送 payload：`host=www.seatmark.cn`，key 文件线上可访问（同 round3/4）。

## 人工 P0 清单（不变，再次强调）

1. **百度站长平台**（ziyuan.baidu.com）：验证 www.seatmark.cn → API 主动推送全量 URL（对百度收录深度是数量级差异）；
2. Bing Webmaster Tools：导入 sitemap（本轮已证明 Bing 对品牌词友好，导入后长尾页收录可期）；
3. 360/搜狗站长平台：注册提交 sitemap（两家目前均为 0 收录）。
