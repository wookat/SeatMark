# 运营第十七轮记录（2026-08-11）

> 角色：growth/operations（参照 company-os CHARTER 与 SOP-05）。范围：收录复查、IndexNow 全量重推、素材第十七批、人工待办更新。
> 证据目录：`docs/ops-round17-evidence/`。基线：第十六轮 `docs/ops-round16.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（100.23.34.160）。与 round16 相比风控略有松动：**百度总查询本轮可正常取到结果页**（但 /vs 与长尾页精查仍被滑块验证码拦截）；搜狗点选验证码、Google reCAPTCHA 拦截如旧；360 可正常取到页面；Bing 仍兜底污染。均如实记录，未硬闯。

## 一、收录复查（site:www.seatmark.cn，2026-08-11）

| 引擎 | 第十五轮 | 第十六轮 | 本轮实测（2026-08-11） | 变化 |
|---|---|---|---|---|
| 百度 site: | 无法核验（滑块验证码） | 无法核验（滑块验证码） | **约 1 个（仅首页）**：「找到相关结果数约1个」，唯一结果为 www.seatmark.cn 首页（`baidu-site-2026-08-11.png`） | 恢复可核验，与 round14 基线持平（仍仅首页） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：reCAPTCHA 拦截，IP 100.23.34.160（`google-site-2026-08-11.png`） | 不可比 |
| Bing site: | "About 51"兜底污染 | "About 767"兜底污染 | "About 33,000 results"，首屏全是 merriam-webster 等 disperse 词典无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-11.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（点选验证码） | 无法核验（点选验证码） | **无法核验**：点选验证码拦截（「请依次点击【吮,罕,楼,龟】」）（`sogou-site-2026-08-11.png`） | 不可比（沿用 round11 实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」）（`360-site-2026-08-11.png`） | 持平 |

### 新页面收录重点检查（/vs 矩阵 + 两个长尾落地页）

- 百度总查询本轮恢复可核验：**总收录约 1 条且仅首页**，即 /vs 五页与 /desk-card-generator、/name-card-batch **均未被百度收录**；`site:www.seatmark.cn/vs` 与 `site:www.seatmark.cn desk-card-generator` 精查均被滑块验证码拦截（`baidu-vs-2026-08-11.png`、`baidu-deskcard-2026-08-11.png`），但总量约 1 已足以判定。
- 360 总收录 0，故 /vs 与长尾落地页均未被 360 收录。
- 搜狗/Google 被验证码拦截，无法核验。
- 结论：/vs 矩阵与长尾落地页第五轮复查在可核验范围内**仍未收录**。百度自 round14 起总量始终约 1 条（仅首页），331 页放量仍卡在站长平台主动提交（P0）。

## 二、IndexNow 全量重推（2026-08-11 02:27 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **331 个 `<loc>`**（与 round16 持平），全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 331 条）至五端点。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、素材第十七批（已入库 `docs/promo/round17/`，不发布）

- `xiaohongshu-posts-round17.md`：1 篇（AI 排版+反馈直达+全键盘+坏页零交付·行政/教师口径）
- `zhihu-answers-round17.md`：1 篇（批量桌牌工具四维度选型问答）
- `wechat-article-round17.md`：1 篇（四个「较真」细节长文）

本批统一主打四个新卖点：**① AI 自动设计标签**（设计器内 AI 排版；严格遵守第 213 轮 #216 文案降级口径——免费通道限量且不保证可用、繁忙时可能失败、推荐自定义 API；只发送字段名与示例值不上传名单）；**② 用户反馈直达通道**（右下浮动反馈直推企微群，#218 内置默认 webhook）；**③ 键盘-only 全流程可用**（第 208 轮无障碍走查全绿：skip-link/下拉方向键/focus trap/全键盘导出）；**④ 导出可靠性「坏页零交付」**（#207/#208 截断检测自动重渲+持续截断报错终止）。所有卖点均有已上线产品事实与测试报告背书，不含虚构数据。

## 四、人工待办

见 `docs/ops/manual-todo-round17.md`。P0 仍为四大站长平台注册验证（连续八轮未破口）；P0.5 运维项（EdgeOne KV 绑定、SES 发信认证）承接；P6 建议优先发布第十七批素材（四大新卖点）。

## 五、结论与下一步

1. 收录线：百度总查询本轮恢复可核验，**总量仍约 1 条（仅首页）**，/vs 矩阵与长尾落地页第五轮复查仍未收录；360 仍为 0。站长平台验证提交仍是 P0 唯一破口。
2. IndexNow 331 条五端点全部成功（连续多轮全绿）。
3. 素材第十七批已入库不发布；四大新卖点（AI 设计/反馈直达/全键盘/坏页零交付）为本批主打，发布动作列入人工待办 P6。
4. 下一轮建议：站长平台未验证前收录线只做例行复查；AI 设计免费通道若配置真实 AI key 恢复可用（r212 P2），素材口径可从「限量不保证可用」上调，届时补一批 AI 排版实测图文。
