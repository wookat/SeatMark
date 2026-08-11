# 运营第十八轮记录（2026-08-11）

> 角色：growth/operations（参照 company-os CHARTER 与 SOP-05）。范围：收录复查、IndexNow 全量重推、素材第十八批（`marketing/batch18/`）、竞品动态速查、人工待办更新。
> 证据目录：`docs/ops-round18-evidence/`。基线：第十七轮 `docs/ops-round17.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（54.69.238.189）。百度总查询可正常取到结果页（/vs 精查仍被滑块验证码拦截）；搜狗点选验证码、Google reCAPTCHA 拦截如旧；360 可正常取到页面；Bing 仍兜底污染。均如实记录，未硬闯。

## 一、收录复查（site:www.seatmark.cn，2026-08-11）

| 引擎 | 第十六轮 | 第十七轮 | 本轮实测（2026-08-11） | 变化 |
|---|---|---|---|---|
| 百度 site: | 无法核验（滑块验证码） | 约 1 个（仅首页） | **约 1 个（仅首页）**：「找到相关结果数约1个」，唯一结果为 www.seatmark.cn 首页（`baidu-site-2026-08-11.png`） | 持平（仍仅首页） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：reCAPTCHA 图形验证拦截，IP 54.69.238.189（`google-site-2026-08-11.png`） | 不可比 |
| Bing site: | "About 767"兜底污染 | "About 33,000"兜底污染 | "About 118 results"，首屏全是 margraf-felsberg.de 等德语健身房无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-11.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（点选验证码） | 无法核验（点选验证码） | **无法核验**：点选验证码拦截（「请依次点击【锯,碍,穿,电】」）（`sogou-site-2026-08-11.png`） | 不可比（沿用 round11 实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」）（`360-site-2026-08-11.png`） | 持平 |

### 新页面收录重点检查（/vs 矩阵 + 两个长尾落地页）

- 百度总收录约 1 条且仅首页 ⇒ /vs 五页与 /desk-card-generator、/name-card-batch **均未被百度收录**；`site:www.seatmark.cn/vs` 精查被滑块验证码拦截（`baidu-vs-captcha-2026-08-11.png`），但总量约 1 已足以判定。
- 360 总收录 0 ⇒ 上述页面均未被 360 收录。
- 搜狗/Google 被验证码拦截，无法核验。
- 结论：/vs 矩阵与长尾落地页第六轮复查在可核验范围内**仍未收录**，与 round17 无增量。百度自 round14 起总量始终约 1 条（仅首页），331 页放量仍卡在站长平台主动提交（P0，连续九轮）。

## 二、IndexNow 全量重推（2026-08-11 04:02 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **331 个 `<loc>`**（与 round17 持平），全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 331 条）至五端点。**成功率 5/5 = 100%**。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、素材第十八批（已入库 `marketing/batch18/`，不发布）

- `zhihu-answer-batch18.md`：1 篇（名单敏感场景选型问答，主打可审计的隐私零外发）
- `xiaohongshu-post-batch18.md`：1 篇（行政视角「我扒了它的网络请求」）
- `wechat-article-batch18.md`：1 篇（「诚实作为产品力」四细节长文）

本批统一主打四个新卖点：**① 名单隐私零外发实证**（第 218 轮全站网络外发审计 + 第 219 轮 /seating 排座数据流走查，敏感串原文/URL 编码/base64 三重匹配命中 0）；**② 弹窗返回键体验**（#226/#228 三修：pushState 哨兵 + popstate 关顶层弹窗 + 修复配额弹窗站内链接竞态取消，线上四测全绿）；**③ 登录链路诚实容错**（第 227 轮走查：SES 未认证下明确提示不可用、零假成功、payload 仅邮箱）；**④ /account 配额说明透明**（免费额度/计量/水印规则前置写明）。所有卖点均有已上线产品事实与测试报告背书，不含虚构数据。

## 四、竞品动态速查（2026-08-11）

| 竞品 | 本轮观察 | 证据 |
|---|---|---|
| placecard.us | 首页新增置顶横幅「New: Import directly from Google Sheets - no data entry needed」，Google Sheets 直连导入成为主推能力；页脚生态入口含 Chrome Extension、Google Sheets Add-on、Amazon Listing；宣传口径「50,000+ place cards created this week」。免费 + Word/Avery 5302 模板下载口径不变。 | `placecard-us-2026-08-11.png` |
| 创客贴 chuangkit.com | `search/templates?kw=桌牌` 与 `search?kw=桌牌` 均返回 404（搜索路由变更或收紧）；模板中心访问触发腾讯滑块验证码（反爬收紧）；印刷/办公品类页可达，未见桌牌品类新专题。会员/登录墙口径不变。 | `chuangkit-2026-08-11.png` |
| WPS | 稻壳 docer.com 旧搜索路径 `search/mb/桌牌` 返回 404（旧会员中心壳页）；WPS 学堂搜「桌牌」仍是两条旧视频（「快速用 WPS 文字打印会议坐席牌」1 分 29 秒、「利用邮件合并功能制作员工工牌」），无新增桌牌相关教程/能力。 | `wps-learning-2026-08-11.png`、`wps-docer-404-2026-08-11.png` |

小结：placecard.us 在数据导入便捷性（Google Sheets 直连）与分发渠道（Chrome 插件/Sheets 插件/Amazon）上持续加码，但仍主打海外婚礼场景、无中文本地化，与我方「中国市场 + 名单隐私 + 打印校准」定位不冲突；创客贴/WPS 桌牌相关面无新动作。

## 五、人工待办

见 `docs/ops/manual-todo-round18.md`。P0 仍为四大站长平台注册验证（连续九轮未破口）；P0.5 运维项（EdgeOne KV 绑定、SES 发信认证、AI 通道 key）承接；P6 建议优先发布第十八批素材（隐私零外发实证是差异化最强口径）。

## 六、结论与下一步

1. 收录线：百度总量仍约 1 条（仅首页），/vs 矩阵与长尾落地页第六轮复查仍未收录；360 仍为 0。与 round17 零增量，站长平台验证提交仍是 P0 唯一破口。
2. IndexNow 331 条五端点全部成功（连续多轮全绿）。
3. 素材第十八批已入库 `marketing/batch18/` 不发布；隐私零外发实证（r218/r219）为本批最强差异化口径。
4. 竞品：placecard.us 新增 Google Sheets 直连导入横幅，值得关注其导入便捷性叙事；创客贴搜索路由 404 + 滑块反爬收紧；WPS 无新动作。
5. 下一轮建议：站长平台未验证前收录线只做例行复查；可评估我方是否跟进「在线表格直连导入」类能力叙事（当前 Excel/CSV 本地导入已覆盖主场景，且外部表格直连与「名单不出浏览器」承诺存在张力，需产品侧权衡后再定）。
