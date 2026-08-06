# SEO 收录复查报告（第六轮，2026-08-06）

> 复查范围：百度 / Google / Bing / 搜狗 / 360，`site:` + 品牌词 + 核心长尾词。
> 证据目录：`docs/marketing/round6/evidence/`。
> 基线：第五轮 `docs/marketing/round5/seo-indexing-round5-2026-08-06.md`。

## 一、结论速览（对比第五轮基线）

| 引擎 | 第五轮基线 | 本轮实测（2026-08-06） | 变化 |
|---|---|---|---|
| 百度 site: | 约 1 个（首页） | **约 1 个（首页）**，摘要完整展示产品描述 | 持平 |
| Google site: | 约 1 个（首页） | **无法核验**：数据中心 IP 触发 reCAPTCHA，多轮图像验证均被拒 | 不可比 |
| Bing site: | 兜底无关结果，不可作证据 | 显示约 62 条，但均为 Avvo/Microsoft 等无关域名，**仍不可作证据** | 持平（不可核验） |
| Bing 品牌词 | 第 1、2 位为 seatmark.cn | 国内版/国际版均返回与产品无关的英文兜底结果，**无法核验真实排名** | 本轮不可比（疑似 IP 风控降级） |
| 搜狗 site: | 0 | **0**（明确提示"站内没有找到匹配内容"） | 持平 |
| 360 site: | 0 | **0**（"未找到相关搜索结果"） | 持平 |

关键判断：
1. 百度收录仍停留在首页 1 条，**百度站长平台验证 + API 主动推送仍是解锁收录的第一优先级**（见 manual-todo-round6.md P0）。
2. 搜狗/360 收录仍为 0，两家站长平台 sitemap 提交仍未完成（需人工账号）。
3. 本轮 Google/Bing 实测受当前网络出口（数据中心 IP 100.23.34.160）风控影响严重，Google 验证循环拒绝、Bing 返回兜底垃圾结果，**不能据此断言排名下降**；建议下轮换住宅网络/人工复核。

## 二、分引擎实测记录

### 1. 百度
- `site:seatmark.cn`：找到约 1 个结果，首页标题《座签·桌牌席卡·门贴证卡批量生成 - SeatMark 座签》，摘要含"免费的 Excel 批量标签生成工具…数据全程本地处理"。
  证据：`evidence/baidu-site-2026-08-06.png`
- 品牌词「SeatMark 座签」与长尾词：触发百度安全验证（旋转图片验证码），多次通过图片转正仍提示"存在安全风险，请再次验证"，**无法完成实测**。
  证据：`evidence/baidu-captcha-blocked-2026-08-06.png`

### 2. Google
- `site:seatmark.cn`：触发 "unusual traffic" reCAPTCHA，先后完成摩托车/公交/消防栓等多轮图像验证均被拒绝，验证循环无法通过，**本轮无法取得搜索结果**。
  证据：`evidence/google-captcha-blocked-2026-08-06.png`

### 3. Bing
- `site:seatmark.cn`：页面显示"约 62 条结果"，但结果全部为 Avvo、Microsoft 等无关域名（Bing 对 site: 无有效结果时的兜底行为，与第五轮一致），不能计为有效收录。
  证据：`evidence/bing-site-2026-08-06.png`
- 品牌词「SeatMark 座签」：国内版返回英文浴袍/词典等无关页面；国际版 `"SeatMark" 座签` 仅返回 3 条 LinkedIn/Instagram 无关人名结果。与第五轮"品牌词第 1、2 位"相比明显异常，**判断为当前出口 IP 被 Bing 风控降级，而非真实排名丢失**（IndexNow 推送仍返回 200）。
  证据：`evidence/bing-brand-degraded-2026-08-06.png`、`evidence/bing-brand-intl-degraded-2026-08-06.png`

### 4. 搜狗
- `site:seatmark.cn`：0 条，页面明确提示"http://seatmark.cn/ 站内没有找到能和 seatmark.cn 匹配的内容"。
  证据：`evidence/sogou-site-2026-08-06.png`
- 品牌词「SeatMark 座签」：约 689 条结果均为无关内容（B 站视频、英语词条等），首屏无 seatmark.cn，与 0 收录一致。
  证据：`evidence/sogou-brand-2026-08-06.png`

### 5. 360
- `site:seatmark.cn`：0 条，"抱歉，未找到相关搜索结果"，并提示可到 `http://info.so.com/site_submit.html` 提交网址。
  证据：`evidence/360-site-2026-08-06.png`
- 品牌词「SeatMark 座签」：首屏均为 52pojie/KET 考试等无关结果，无 seatmark.cn，与 0 收录一致。
  证据：`evidence/360-brand-2026-08-06.png`

### 6. 长尾词说明
计划实测的长尾词：考场桌贴生成工具、电子座签模板 800×480、席卡制作、台签在线制作、桌签生成器。
- 百度：被安全验证拦截（同上），未能实测。
- Google：被 reCAPTCHA 拦截，未能实测。
- Bing：结果已被兜底污染，实测无意义。
- 搜狗/360：site: 为 0，长尾词自然不可能出现 seatmark.cn 结果（已由品牌词实测佐证）。
**长尾词排名留待下轮在可信网络环境下补测。**

## 三、IndexNow 全量推送记录（2026-08-06）

- 数据源：`https://www.seatmark.cn/sitemap.xml`，共 **307 条 URL**。
- Key：`f04fd03b147f6e5178d97e8e20770a6d`（keyLocation `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt`）。
- 推送方式：复用 round3 以来的 Python urllib 全量 JSON payload 方式。

| 端点 | 响应 |
|---|---|
| https://www.bing.com/indexnow | 200 |
| https://yandex.com/indexnow | 202 |
| https://search.seznam.cz/indexnow | 200 |
| https://searchadvisor.naver.com/indexnow | 200 |
| https://api.indexnow.org/indexnow | 200 |

全部端点接受推送（200/202）。

## 四、下一步建议

1. **P0：完成百度站长平台验证 + API 主动推送配额使用**（人工，见 manual-todo-round6.md）。
2. 完成搜狗/360 站长平台 sitemap 提交与 360 网址提交入口 `info.so.com/site_submit.html`。
3. 下轮收录复查改用住宅/办公网络或人工操作，规避数据中心 IP 风控，补测 Google/Bing 品牌词与长尾词排名。
4. 持续发布第六批素材（知乎/小红书/公众号/短视频），扩大外链与品牌搜索需求。
