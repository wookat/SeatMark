# 运营第十四轮记录（2026-08-10）

> 角色：growth/operations（参照 company-os CHARTER 与 SOP-05）。范围：收录复查、IndexNow 全量重推、素材第十四批、人工待办更新。
> 证据目录：`docs/ops-round14-evidence/`。基线：第十三轮 `docs/ops-round13.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（54.201.200.193）；百度首查取到页面（`/vs` 精查被滑块验证码拦截），360 取到页面，搜狗被点选验证码拦截，Google 被 reCAPTCHA 拦截，Bing 仍兜底污染。

## 一、收录复查（site:www.seatmark.cn，2026-08-10）

| 引擎 | 第十二轮 | 第十三轮 | 本轮实测（2026-08-10） | 变化 |
|---|---|---|---|---|
| 百度 site: | 约 1 个（首页） | 约 1 个（首页） | **约 1 个**：「找到相关结果数约1个」，首条即 SeatMark 首页（`baidu-site-2026-08-10.png`） | 持平（连续五轮仅首页） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：reCAPTCHA 拦截，IP 54.201.200.193（`google-site-recaptcha-2026-08-10.png`） | 不可比 |
| Bing site: | "About 307,000"兜底污染 | "About 22,100"兜底污染 | "About 344 results"，首屏全是 AMP Research 汽车踏板等无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-10.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（点选验证码） | 无法核验（点选验证码） | **无法核验**：点选验证码拦截（「请依次点击【锻,阑,慨,罢】」）（`sogou-site-captcha-2026-08-10.png`） | 不可比（沿用 round11 实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」）（`360-site-2026-08-10.png`） | 持平 |

### 新页面收录重点检查（/vs 矩阵 + 两个长尾落地页）

- 百度：总收录仍约 1 条（仅首页），故 **/vs 五页（/vs、/vs/chuangkit、/vs/wps-mail-merge、/vs/placecard-us、/vs/canva）与 /desk-card-generator、/name-card-batch 均未被百度收录**；尝试 `site:www.seatmark.cn/vs` 精查时被滑块验证码拦截（`baidu-site-vs-captcha-2026-08-10.png`），未硬闯。
- 360：总收录 0，新页面自然未收录。
- 搜狗/Google：被验证码拦截，无法核验。
- 结论：新页面上线后第二轮复查，在可核验引擎（百度/360）中**仍未收录**——站长平台注册验证（P0）仍是唯一破口，未解除前放量无从谈起。

## 二、IndexNow 全量重推（2026-08-10 15:57 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **331 个 `<loc>`**（与 round13 持平），全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 331 条）至五端点。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、素材第十四批（已入库 `docs/promo/round14/`）

- `xiaohongshu-posts-round14.md`：3 篇
- `zhihu-answers-round14.md`：2 篇（问答式）
- `wechat-article-round14.md`：1 篇

本批统一主打：**座位表 → 课桌贴一键联动（/seating 名单含座位号/排/列带入标签工坊，StudioView 已实现）**、**/vs 对比矩阵选型（创客贴/WPS邮件合并/placecard.us/Canva，官方写明对方更合适的场景）**、**CSV 多编码兼容（GBK/GB18030/无 BOM UTF-8 自动检测）+ PWA 离线组合**。所有卖点均有已上线产品事实背书，不含虚构数据。

## 四、人工待办

见 `docs/ops/manual-todo-round14.md`。P0 仍为四大站长平台注册验证（连续五轮确认百度仅收录首页，330 个内页 + /vs 矩阵放量的唯一破口）；P1 站长之家收录（round12 发现，仍未完成）。

## 五、结论与下一步

1. 百度连续五轮仅收录首页；/vs 矩阵与两个长尾落地页第二轮复查在可核验引擎中仍未收录。站长平台验证提交仍是 P0 唯一破口（依赖老板人工，约 30 分钟）。
2. IndexNow 331 条五端点全部成功（连续多轮全绿），Bing/Yandex 建议 2026-08-24 回访。
3. 素材第十四批已入库不发布；发布动作列入人工待办 P6。第十三、十四两批合计 12 篇覆盖「离线/乱码/对比选型/排座联动」四大卖点，与 /vs、/seating 形成引流闭环。
4. 下一轮建议：站长平台未验证前收录线只做例行复查；产出重心转向 round12 提出的「不干胶打印偏移校准」「电子墨水桌牌导出」两篇权威长文，以及 /seating 排座功能的补齐（随机排座/整排交换，见 deep-experience-audit）。
