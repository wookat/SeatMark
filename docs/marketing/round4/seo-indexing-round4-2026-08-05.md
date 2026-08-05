# 第四轮收录进展报告（2026-08-05）

> 核验方式：Playwright/浏览器逐一执行 `site:seatmark.cn` 查询（2026-08-05 21:4x UTC）。
> 上轮基线见 `../round3/seo-indexing-round3-2026-08-05.md`。证据截图存 `evidence/`。

## 收录快照（与第三轮对比）

| 引擎 | 第三轮（08-05 晚） | 本轮（08-05 深夜） | 变化 | 证据 |
|---|---|---|---|---|
| 百度 | 约 1 个（首页） | **1 个**（首页正常展示，标题/描述完整；经 m.baidu.com 核验，PC 端触发安全验证） | ➖ 持平 | `evidence/baidu-site-query-2026-08-05.png` |
| Google | 1 个（首页） | **1 个**（首页正常展示） | ➖ 持平 | `evidence/google-site-query-2026-08-05.png` |
| 必应 Bing | ≥1（/guides 曾展示） | **无有效展示**（"About 50 results" 全部为 reddit 等无关兜底结果，无 seatmark.cn 页面；Bing 兜底结果不可作为收录证据） | ⚠️ 波动/展示不稳定 | `evidence/bing-site-query-2026-08-05.png` |
| 搜狗 | 约 5 条 | **0**（m.sogou.com 明确返回"未找到 seatmark.cn 站内的内容"） | ⚠️ 回落（搜狗新站收录波动常见） | `evidence/sogou-site-query-2026-08-05.png` |
| 360 搜索 | 0 | **0**（"未找到相关搜索结果"） | ➖ 无变化 | `evidence/360-site-query-2026-08-05.png` |

**结论**：收录仍停留在首页级（百度/Google 各 1 条），Bing/搜狗展示出现波动，302+ 条 URL 的长尾页收录深度是核心瓶颈。**最大杠杆不变：百度站长平台验证 + API 主动推送（人工 P0）**，其次为 Bing Webmaster Tools 与 360/搜狗站长平台提交（均需账号）。

## IndexNow 全量推送回执（本轮已执行）

从线上 `https://www.seatmark.cn/sitemap.xml` 提取 **302 条 URL**，追加本轮新增 4 篇教程 URL（合并后 **306 条**）：

- `/guides/desk-sign-online-maker`（台签在线制作）
- `/guides/place-card-generator-online`（席卡生成器）
- `/guides/seat-back-sticker-batch`（批量座位背签）
- `/guides/eink-800x480-desk-card`（电子座签 800×480）

| 端点 | HTTP 状态 | 结论 |
|---|---|---|
| `https://www.bing.com/indexnow` | **200** | ✅ 接收成功 |
| `https://yandex.com/indexnow` | **202** `{"success":true}` | ✅ 接收成功 |
| `https://search.seznam.cz/indexnow` | **200** | ✅ 接收成功 |
| `https://searchadvisor.naver.com/indexnow` | **200** | ✅ 接收成功 |
| `https://api.indexnow.org/indexnow` | **200** | ✅ **本轮首次成功**（第三轮为 403 SiteVerificationNotCompleted，key 校验已生效） |

> 注：4 条新 URL 在本 PR 合并部署后才会返回 200。**合并部署后请再重跑一次推送脚本**（脚本见 round3 报告，直接复用即可，线上 sitemap 届时自动含新 URL）。

## 免登录目录站提交执行情况（本轮）

| 入口 | 结果 | 证据 |
|---|---|---|
| IndexNow 五端点 306 条 | ✅ 已推送（含聚合端点首次 200） | 见上表 |
| 爱达杂货铺 adzhp.cc | ❌ 提交方式为留言板评论，**需登录**（round3 清单标注 🅰 有误，已更正） | `evidence/adzhp-submit-needs-login-2026-08-05.png` |
| webwiki.com/seatmark.cn 自动建档 | ❌ Cloudflare 人机验证循环（数据中心 IP 风控，与 round3 一致），转人工 30 秒项 | `evidence/webwiki-cf-blocked-2026-08-05.png` |
| free8.net 免费吧 | ❌ 全站 Cloudflare 人机验证循环，无法进入 | `evidence/free8-cf-blocked-2026-08-05.png` |
| wow.xmgho.com 哇哦导航 | ❌ 域名已失效（DNS NXDOMAIN），从清单移除 | — |
| LaunchingNext | ✅ round3 已提交，等待免费队列审核，无需重复提交 | — |

**免登录渠道已基本穷尽**：剩余目录站均需注册账号（邮箱/手机号/微信），见 round3 清单第二部分；建议老板批量走一遍 🅱 类（邮箱注册即可）：AlternativeTo、SaaSHub、Uneed、V2EX、小众软件。

## 人工 P0 清单（不变，再次强调）

1. **百度站长平台**（ziyuan.baidu.com）：验证 www.seatmark.cn → 获取 token → API 主动推送全量 URL——对百度收录深度是数量级差异；
2. Bing Webmaster Tools：导入 sitemap，可顺带诊断本轮 Bing 展示波动；
3. 360/搜狗站长平台：注册提交 sitemap。
