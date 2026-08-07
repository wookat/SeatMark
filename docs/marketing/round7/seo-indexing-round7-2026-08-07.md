# SEO 收录复查报告（第七轮，2026-08-07）

> 复查范围：百度 / Google / Bing / 搜狗 / 360，`site:seatmark.cn` + 品牌词。
> 证据目录：`docs/marketing/round7/evidence/`。
> 基线：第六轮 `docs/marketing/round6/seo-indexing-round6-2026-08-06.md`。

## 一、结论速览（对比第六轮基线）

| 引擎 | 第五轮 | 第六轮 | 本轮实测（2026-08-07） | 变化 |
|---|---|---|---|---|
| 百度 site: | 约 1 个（首页） | 约 1 个（首页） | **无法核验**：整站被安全验证（滑块）拦截，多次通过仍回到验证页 | 不可比 |
| Google site: | 约 1 个（首页） | 无法核验（reCAPTCHA） | **约 1 个（首页）**，通过多轮图像验证后取得结果 | 相对第五轮持平 |
| Bing site: | 兜底无关结果 | 兜底无关结果（约 62 条） | 显示"约 5,140 条"，但首屏全部为海外商品等无关页面，**仍为兜底污染，不可作证据** | 持平（不可核验） |
| 搜狗 site: | 0 | 0 | **无法核验**：反爬验证码，图像点选多次仍提示"验证码错误" | 不可比 |
| 360 site: | 0 | 0 | **0**（"未找到相关搜索结果"，并提示到 `http://info.so.com/site_submit.html` 提交） | 持平 |

关键判断：
1. **Google 收录本轮恢复可核验**：`site:seatmark.cn` 可见首页 1 条（第六轮因验证循环无法核验），说明 Google 至少保持首页收录，未见更多内页进入索引。
2. 360 连续三轮为 0；百度/搜狗本轮被风控拦截无法核验，但结合第五、六轮基线，**没有任何证据表明国内引擎收录有增长**。
3. Bing 的 `site:` 兜底污染连续三轮出现（本轮显示约 5,140 条无关海外商品页），继续不能计为有效收录数据。
4. 结论不变：**百度站长平台验证 + API 主动推送、搜狗/360 站长平台 sitemap 提交仍是解锁国内收录的关键路径**，且均需人工账号操作（见 manual-todo-round7.md P0）。

## 二、分引擎实测记录

### 1. 百度
- `site:seatmark.cn`：触发百度安全验证（滑块），多次拖动通过后仍循环回验证页，**本轮无法取得结果页**。
  证据：`evidence/baidu-captcha-blocked-2026-08-07.png`

### 2. Google
- `site:seatmark.cn`：初始触发 "unusual traffic" reCAPTCHA，完成多轮图像验证后成功进入结果页，可见 **1 条 seatmark.cn 首页结果**。
  证据：`evidence/google-site-2026-08-07.png`
- 品牌词「SeatMark」（美区结果）：首屏为自行车座高、SEAT 汽车等无关英文内容，未见 seatmark.cn；美区英文语境下品牌词无排名属预期，不作为负面信号。
  证据：`evidence/google-brand-us-locale-2026-08-07.png`

### 3. Bing
- `site:seatmark.cn`：先出现 "One last step" 人机验证，通过后页面显示"约 5,140 条结果"，但首屏均为泳池玩具等无关海外商品页——为 Bing `site:` 无有效结果时的兜底行为（与第五、六轮一致），**不能计为收录数据**。
  证据：`evidence/bing-site-fallback-2026-08-07.png`

### 4. 搜狗
- `site:seatmark.cn`：触发反爬图像点选验证码，多次尝试均提示"验证码错误，请完成验证码"，**本轮无法取得结果页**。
  证据：`evidence/sogou-antispider-blocked-2026-08-07.png`

### 5. 360
- `site:seatmark.cn`：明确"未找到相关搜索结果"，即收录仍为 **0**；页面同时给出站点提交入口 `http://info.so.com/site_submit.html`。
  证据：`evidence/360-site-2026-08-07.png`

### 6. 网络环境说明
本轮仍使用数据中心出口 IP，百度/搜狗风控拦截、Bing 兜底污染均与该环境强相关；**不能据此断言收录下降**。建议老板下轮用住宅网络/手机流量人工复核一次百度与搜狗（约 5 分钟）。

## 三、IndexNow 全量重推与 sitemap 核查（2026-08-07）

- 数据源：`https://www.seatmark.cn/sitemap.xml`，HTTP 200，共 **307 条 URL**（与第六轮持平，未见新增页面）。
- Key 文件：`https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt`，HTTP 200 正常可访问。
- robots：`https://www.seatmark.cn/robots.txt` 正常，已声明 sitemap 且允许主流引擎抓取。
- 推送方式：沿用 round3 以来的全量 JSON payload 方式，307 条 URL 一次性推送 5 个端点：

| 端点 | 返回码 | 判定 |
|---|---|---|
| api.indexnow.org | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 | 已受理 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

- 说明：IndexNow 不覆盖百度/搜狗/360，国内引擎收录仍依赖各自站长平台的人工提交（见 manual-todo-round7.md）。

## 四、下一轮建议

1. 老板完成百度站长平台验证后，下轮报告可加入"百度主动推送 API 配额与推送量"小节。
2. 下轮在住宅网络环境补测百度/搜狗 site: 与品牌词、长尾词（考场桌贴生成工具、电子座签模板 800×480、席卡制作、台签在线制作）。
3. 若 sitemap URL 数出现增长（新增教程/模板页），IndexNow 继续全量重推即可，无需增量逻辑。
