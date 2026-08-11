# 运营第二十轮记录（2026-08-11）

> 角色：growth/operations（参照 company-os CHARTER 与 SOP-05）。范围：收录复查、IndexNow 全量重推、素材第二十批（`marketing/batch20/`）、竞品动态速查、人工待办更新。
> 证据目录：`docs/ops-round20-evidence/`。基线：第十九轮 `docs/ops-round19.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（54.201.200.193）。百度总查询正常取到结果页；360 正常取到页面；搜狗点选验证码、Google reCAPTCHA 拦截如旧；Bing 仍兜底污染。均如实记录，未硬闯。

## 一、收录复查（site:www.seatmark.cn，2026-08-11）

| 引擎 | 第十八轮 | 第十九轮 | 本轮实测（2026-08-11） | 变化 |
|---|---|---|---|---|
| 百度 site: | 约 1 个（仅首页） | 约 1 个（仅首页） | **约 1 个（仅首页）**：「找到相关结果数约1个」，唯一结果为 www.seatmark.cn 首页（`baidu-site-2026-08-11.png`） | 持平（仍仅首页） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：reCAPTCHA 图形验证拦截，IP 54.201.200.193（`google-site-2026-08-11.png`） | 不可比 |
| Bing site: | "About 118"兜底污染 | "About 6,270"兜底污染 | "About 50 results"，首屏全是 bigcommerce.com 等电商无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-11.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（点选验证码） | 无法核验（点选验证码） | **无法核验**：点选验证码拦截（「请依次点击【具,菜,齐,蓄】」）（`sogou-site-2026-08-11.png`） | 不可比（沿用 round11 实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」）（`360-site-2026-08-11.png`） | 持平 |

### 新页面收录重点检查（/vs 矩阵 + 两个长尾落地页 + 热门模板/教程页）

- 百度总收录约 1 条且仅首页 ⇒ /vs 五页、/desk-card-generator、/name-card-batch 及全部模板/教程页**均未被百度收录**（总量约 1 已足以判定，未再触发精查验证码）。
- 360 总收录 0 ⇒ 上述页面均未被 360 收录。
- 搜狗/Google 被验证码拦截，无法核验。
- 结论：与 round19 **零增量**。百度自 round14 起总量始终约 1 条（仅首页），331 页放量仍卡在站长平台主动提交（P0，连续十一轮）。

## 二、IndexNow 全量重推（2026-08-11 11:20 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **331 个 `<loc>`**（与 round19 持平），全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 331 条）至五端点。**成功率 5/5 = 100%**。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、素材第二十批（已入库 `marketing/batch20/`，不发布）

- `zhihu-answer-batch20.md`：1 篇（「网页工具换浏览器就翻车？」问答，主打三引擎验证方法论）
- `xiaohongshu-post-batch20.md`：1 篇（Mac/Safari 行政用户视角「工具终于不挑浏览器」）
- `wechat-article-batch20.md`：1 篇（「『请使用 Chrome 打开』是一种偷懒：三引擎真机验证记」长文）

本批统一主打「**全浏览器兼容、真机可靠**」质量叙事（第 240–243 轮）：**① 三大浏览器引擎全链路验证收口**（Chromium/Firefox/WebKit 主链路真机验证）；**② Safari 用户可放心用**（第 243 轮 WebKit 专项全绿：导入/整页/逐张/PDF/电子墨水 800×480 精确像素/4096px 大宽度/超长姓名溢出）；**③ 敢公开翻车记录**（第 240 轮发现 Firefox 电子墨水逐标签导出 P2 → 第 241 轮 #244 修复 → 第 242 轮复测全绿）；**④ 生僻字（𱁬）/维吾尔文 RTL 跨引擎渲染一致**（零缺字/零 tofu/零平切）；**⑤ 排座与分享全引擎可用 + 隐私零外发逐引擎验证**。所有卖点均有已上线产品事实与测试报告背书，不含虚构数据。

## 四、竞品动态速查（2026-08-11）

| 竞品 | 本轮观察 | 证据 |
|---|---|---|
| placecard.us | 与 round19 对照**无新增变化**：置顶横幅仍为「New: Import directly from Google Sheets - no data entry needed」；页脚生态入口仍为 Chrome Extension、Google Sheets Add-on、Amazon Listing；宣传口径仍「50,000+ place cards created this week」（数字未变）。免费 + Word/Avery 5302 模板口径不变。 | `placecard-us-2026-08-11.png` |
| 创客贴 chuangkit.com | 模板搜索页（sj-pi25 路由 kw=桌牌）仍直接触发腾讯滑块验证码，反爬持续收紧，与 round19 一致；无法进入模板列表核对桌牌品类，未见新专题迹象。 | `chuangkit-2026-08-11.png` |
| WPS | WPS 学堂搜「桌牌」仍是两条旧视频（「快速用 WPS 文字打印会议坐席牌」1 分 29 秒 7.7 万人已学、「利用邮件合并功能制作员工工牌」2 分 26 秒 18.4 万人已学），人数与 round19 完全一致，无新增桌牌相关教程/能力。 | `wps-learning-2026-08-11.png` |

小结：三家均无新动作，竞争面稳定。值得注意的是三家竞品均无公开的跨浏览器测试记录，「三引擎真机验证」是我方本批素材的独有差异化叙事。

## 五、人工待办

见 `docs/ops/manual-todo-round20.md`。P0 仍为四大站长平台注册验证（连续十一轮未破口，331 页收录放量唯一通道）；素材侧建议优先发布第十九批（稳健性五卖点）与本批（三引擎兼容）素材。

## 六、结论与下一步

1. 收录线：与 round19 零增量。百度仍约 1 条（仅首页）、360 仍 0、搜狗/Google 验证码拦截、Bing 兜底污染。站长平台验证提交仍是 P0 唯一破口。
2. IndexNow 331 条五端点全部成功（连续多轮全绿）。
3. 素材第二十批已入库 `marketing/batch20/` 不发布；「敢公开翻车与修复记录」是本批最具说服力的传播点，Mac/Safari 办公人群是明确的新触达人群。
4. 竞品：三家均无实质新动作；跨浏览器可靠性叙事暂无竞品跟进，窗口期可用。
5. 下一轮建议：站长平台未验证前收录线只做例行复查；素材线可考虑开学季排座 + 课桌贴场景长文（承接 round19 建议，时点更近）；若老板完成站长平台验证，立即执行百度普通收录/快速收录 API 全量提交。
