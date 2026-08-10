# 运营第十轮记录（2026-08-10）

> 角色：growth/operations。范围：收录复查、IndexNow 全量重推、目录站第三批尝试、素材第十批、长尾词缺口清单、人工待办更新。
> 证据目录：`docs/ops-round10-evidence/`。基线：第九轮 `docs/ops-round9.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（54.201.200.193），Google/搜狗仍触发反爬验证；**百度本轮未被拦截，取到实测数据**。

## 一、收录复查（site:www.seatmark.cn，2026-08-10）

| 引擎 | 第七轮 | 第八轮 | 第九轮 | 本轮实测（2026-08-10） | 变化 |
|---|---|---|---|---|---|
| 百度 site: | 无法核验（滑块） | 无法核验（滑块循环） | 无法核验（滑块） | **约 1 个（首页已收录）**：「找到相关结果数约1个」，首条即 SeatMark 首页标题+描述（`baidu-1-result-2026-08-10.png`） | **破冰确认**：首页在百度可检索（与第五/六轮口径一致） |
| Google site: | 约 1（首页） | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：异常流量 reCAPTCHA 拦截，IP 54.201.200.193（`google-recaptcha-blocked-2026-08-10.png`） | 不可比 |
| Bing site: | "约 5,140"兜底污染 | "约 5,370"兜底污染 | "About 3,970"兜底污染 | "About 50 results"，首屏全部为 liveworksheets.com 等无关结果，**仍为兜底污染，不可作证据**（`bing-fallback-polluted-2026-08-10.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（验证码） | 无法核验（antispider） | 无法核验（antispider） | **无法核验**：antispider 中文点选验证码拦截（`sogou-antispider-blocked-2026-08-10.png`） | 不可比 |
| 360 site: | 0 | 0 | 0 | **0**（"抱歉，未找到相关搜索结果"，提示到 `info.so.com/site_submit.html` 提交）（`360-zero-results-2026-08-10.png`） | 持平 |

- 必应 Webmaster：匿名无法查询站点收录明细（需 Microsoft 账号验证站点），本轮未取到数据。
- 结论：本轮首次在近四轮内核验到百度收录首页（约 1 条）；360 仍为 0；Google/搜狗被拦截；Bing 兜底污染。收录扩量（首页以外的 322 个页面）仍依赖站长平台验证 + 主动提交（P0 未解除）。

## 二、IndexNow 全量重推（2026-08-10 03:00 UTC 前后）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **323 个 `<loc>`**，与预期一致，全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 323 条）至五端点。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、目录站/导航站第三批尝试

详见 `docs/marketing/round10/directory-submissions-round10.md`。本轮实测 7 个未尝试过的渠道：1 个完成在线留言提交尝试（爱资料工具 toolnb.com），1 个表单可填但滑块验证码多次未通过（办公人导航 bgrdh.com，转人工 30 秒），其余因登录墙/无在线入口/接口损坏转人工。

## 四、素材第十批（已入库 `docs/promo/round10/`）

- `xiaohongshu-posts-round10.md`：3 篇
- `zhihu-answers-round10.md`：2 篇（问答式）
- `wechat-article-round10.md`：1 篇

本批统一突出的新卖点：**生僻字提醒**（名单里的生僻字自动检测提示，避免打印出来变方块）、**弱网可用**（页面加载后断网也能继续生成导出）、**40 张桌牌 ZIP 仅 1.5MB**、**手机直接打印**。

## 五、长尾词缺口清单

见 `docs/marketing/round10/seo-keywords-round10.md`：基于百度下拉/相关搜索实测，筛出 10 个尚未覆盖的桌牌类长尾词（与 round8 十词清单已去重）。

## 六、人工待办

见 `docs/marketing/round10/manual-todo-round10.md`。P0 仍为四大站长平台注册验证（百度已收录首页，验证后可加速放量）。

## 七、结论与下一步

1. **百度收录破冰确认**：首页可检索（约 1 条），是第七轮以来首次取到百度实测数据；其余 322 页放量仍需百度站长平台提交。
2. 360 收录仍为 0，Google/搜狗被数据中心 IP 拦截，Bing 兜底污染，结论与前几轮一致。
3. IndexNow 323 条五端点全部成功，Bing/Yandex 侧建议 1-2 周后回访。
4. 免登录目录站渠道经四轮消耗基本枯竭，本轮新试 7 站仅 1 站可能成功（toolnb 待审核）；剩余高价值渠道均需老板注册账号人工执行。
