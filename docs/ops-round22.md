# 运营第二十二轮记录（2026-08-11）

> 角色：growth/operations（参照 company-os CHARTER 与 SOP-05）。范围：收录复查、IndexNow 全量重推、素材第二十二批（`marketing/batch22/`）、竞品动态速查、人工待办更新。
> 证据目录：`docs/ops-round22-evidence/`。基线：第二十一轮 `docs/ops-round21.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（54.201.200.193）。百度、360、必应正常取到结果页；搜狗点选验证码拦截如旧；神马本轮被阿里云盾「unusual traffic」直接拒绝（cloud_ip_bl，云 IP 黑名单），无法核验。均如实记录，未硬闯。

## 一、收录复查（site:www.seatmark.cn，2026-08-11）

| 引擎 | 第二十轮 | 第二十一轮 | 本轮实测（2026-08-11） | 变化 |
|---|---|---|---|---|
| 百度 site: | 约 1 个（仅首页） | 约 1 个（仅首页） | **约 1 个（仅首页）**：「找到相关结果数约1个」，唯一结果为 www.seatmark.cn 首页（`baidu-site-2026-08-11.png`） | 持平（仍仅首页） |
| Bing site: | "About 50"兜底污染 | "About 50"兜底污染 | "About 50 results"，首屏全是 courses.lumenlearning.com 等心理学课程无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-11.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（点选验证码） | 无法核验（点选验证码） | **无法核验**：点选验证码拦截（「请依次点击【全,甫,垒,乾】」）（`sogou-site-2026-08-11.png`） | 不可比（沿用 round11 实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」）（`360-site-2026-08-11.png`） | 持平 |
| 神马 site: | — | 0（首测基线） | **无法核验**：so.m.sm.cn 被阿里云盾拦截「We have detected unusual traffic from your network」（cloud_ip_bl 云 IP 黑名单）（`shenma-site-2026-08-11.png`） | 不可比（沿用 round21 实测 0 作基线） |

### 新页面收录重点检查（/vs 矩阵 + 两个长尾落地页 + 热门模板/教程页）

- 百度总收录约 1 条且仅首页 ⇒ /vs 五页、/desk-card-generator、/name-card-batch 及全部模板/教程页**均未被百度收录**（总量约 1 已足以判定）。
- 360 总收录 0 ⇒ 上述页面均未被 360 收录。
- 搜狗被验证码拦截、神马被云盾拦截，本轮均无法核验（历史实测均为 0）。
- 结论：与 round21 **零增量**。百度自 round14 起总量始终约 1 条（仅首页）；360 连续多轮 0。331 页放量仍卡在站长平台主动提交（P0，连续十三轮）。

## 二、IndexNow 全量重推（2026-08-11 14:09 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **331 个 `<loc>`**（与 round21 持平），全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 331 条）至五端点。**成功率 5/5 = 100%**（连续多轮全绿）。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |

## 三、素材第二十二批（已入库 `marketing/batch22/`，不发布）

- `zhihu-answer-batch22.md`：1 篇（「敢断网干活的桌牌工具」问答，断网实验视角）
- `xiaohongshu-post-batch22.md`：1 篇（行政视角「断网还能导出 300 张」笔记）
- `wechat-article-batch22.md`：1 篇（《把网线拔了，才知道一个「在线工具」有没有说真话》长文）

本批统一主打「**数据本地化 + 环境适应性**」质量叙事（最近质量迭代）：**① 完全断网也能导入导出——数据真的不出浏览器**（实测 300 张断网导出成功，PWA 离线快照）；**② 弱网打开有加载提示不白屏**（SSE 韧性/弱网专项）；**③ 老花放大 200% 也不破版、导出照常**（150%/200% 缩放专项，200% 全链路导出内容级一致）；**④ 深色模式用户看到的仍是设计原色、系统减少动态偏好被尊重**（系统外观偏好稳健性专项：dark/reduced-motion/contrast/forced-colors 全过）。所有卖点均有已上线产品事实与测试报告背书（test-plan-round253/258/259 系列），不含虚构数据。

## 四、竞品动态速查（2026-08-11）

| 竞品 | 本轮观察 | 证据 |
|---|---|---|
| placecard.us | 首页与 round21 对照**无新增变化**：置顶横幅仍为「New: Import directly from Google Sheets - no data entry needed」；页脚生态入口仍为 Chrome Extension、Google Sheets Add-on、Amazon Listing；宣传口径仍「50,000+ place cards created this week」（数字未变）。本轮加查定价页：三档一次性付费 Starter $12.90（划线 $19，100 客、30 天）/ Pro $39（划线 $69，500 客、1 年）/ Business Lifetime $99（划线 $149，终身），无订阅制——**首次留档定价基线**，后续轮次对照价格变化。 | `placecard-us-2026-08-11.png`、`placecard-pricing-2026-08-11.png` |
| 创客贴 chuangkit.com | 模板搜索页（sj-pi25 路由 kw=桌牌）仍直接触发腾讯滑块验证码（拖动拼图），反爬持续收紧，与 round21 一致；无法进入模板列表核对桌牌品类，未见新专题迹象。 | `chuangkit-2026-08-11.png` |
| WPS（智能表格/学堂） | WPS 学堂搜「桌牌」仍是两条旧视频（「快速用 WPS 文字打印会议坐席牌」1 分 29 秒 7.7 万人已学、「利用邮件合并功能制作员工工牌」2 分 26 秒 18.4 万人已学），人数与 round21 完全一致，无新增桌牌相关教程/能力；未见智能表格侧新增桌牌生成能力入口。 | `wps-learning-2026-08-11.png` |

小结：三家均无新动作，竞争面稳定。placecard.us 定价基线首次留档（一次性付费三档，无订阅）；竞品均无「断网可用/离线导出」类公开叙事，「数据真的不出浏览器」是我方本批素材的独有差异化卖点。

## 五、人工待办

见 `docs/ops/manual-todo-round22.md`。P0 仍为五大站长平台注册验证（连续十三轮未破口，331 页收录放量唯一通道）；素材侧建议优先发布本批（断网可用四卖点）与第二十一批（坏情况容错）素材。

## 六、结论与下一步

1. 收录线：与 round21 零增量。百度仍约 1 条（仅首页）、360 仍 0、搜狗验证码拦截、神马本轮被云盾拦截（沿用 0 基线）、Bing 兜底污染。站长平台验证提交仍是 P0 唯一破口。
2. IndexNow 331 条五端点全部成功（连续多轮全绿）。
3. 素材第二十二批已入库 `marketing/batch22/` 不发布；「断网可用」叙事（断网导出 300 张/弱网不白屏/200% 放大/深色模式原色）是可被用户自行验证的硬证据型卖点，建议与第二十一批组合投放。
4. 竞品：三家均无实质新动作；placecard.us 定价基线已留档，后续对照涨价/降价动作。
5. 下一轮建议：站长平台未验证前收录线只做例行复查；神马侧若数据中心 IP 持续被云盾拦，改由老板本地网络人工核验；若老板完成站长平台验证，立即执行百度普通收录/快速收录 API 全量提交。
