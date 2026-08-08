# SEO 收录复查报告（第八轮，2026-08-08）

> 复查范围：百度 / Google / Bing / 搜狗 / 360，`site:seatmark.cn`。
> 证据目录：`docs/marketing/round8/evidence/`。
> 基线：第七轮 `docs/marketing/round7/seo-indexing-round7-2026-08-07.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（100.23.34.160），百度/Google/搜狗均触发反爬验证，与第七轮情况一致。建议后续用住宅/手机网络人工复核（已列入 manual-todo-round8）。

## 一、收录趋势表

| 引擎 | 第五轮 | 第六轮 | 第七轮 | 本轮实测（2026-08-08） | 变化 |
|---|---|---|---|---|---|
| 百度 site: | 约 1 个（首页） | 约 1 个（首页） | 无法核验（滑块验证拦截） | **无法核验**：安全验证滑块循环，多次通过仍回到验证页（`baidu-captcha-blocked-2026-08-08.png`） | 不可比 |
| Google site: | 约 1 个（首页） | 无法核验（reCAPTCHA） | 约 1 个（首页） | **无法核验**：异常流量 reCAPTCHA 图像验证循环，多轮挑战始终不放行（`google-recaptcha-blocked-2026-08-08.png`） | 不可比 |
| Bing site: | 兜底无关结果 | 兜底无关结果（约 62 条） | "约 5,140 条"兜底污染 | "约 5,370 条"，但首屏全部为 Dog Rose Productions 等无关新闻页，**仍为兜底污染，不可作证据**（`bing-fallback-polluted-2026-08-08.png`） | 持平（不可核验） |
| 搜狗 site: | 0 | 0 | 无法核验（反爬验证码） | **无法核验**：antispider 中文点选验证码拦截（`sogou-antispider-blocked-2026-08-08.png`） | 不可比 |
| 360 site: | 0 | 0 | 0 | **0**（"未找到相关搜索结果"，提示到 `http://info.so.com/site_submit.html` 提交）（`360-zero-results-2026-08-08.png`） | 持平 |

## 二、关键页收录情况（首页 / /templates / /guides）

- 由于百度/Google/搜狗均被验证码拦截、Bing 为兜底污染，本轮**无法对关键页逐一核验收录**。
- 360 明确返回 0 结果，即首页、`/templates`、`/guides` 均未被 360 收录。
- 六个新模板详情页（第 67/69 轮新增）线上均返回 HTTP 200，页面可抓取：
  - `/templates/deluxeWedFoil`、`/templates/deluxeGovGuilloche`、`/templates/deluxeKidsPastel`
  - `/templates/deluxeExamFocus`、`/templates/deluxeClassChalk`、`/templates/deluxeConfFret`

## 三、本轮索引重推（sitemap + IndexNow）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 当前含 310 个 `<loc>`；第 69 轮新增的 3 个模板详情页（deluxeExamFocus / deluxeClassChalk / deluxeConfFret）线上已 200 但**尚未进入 sitemap**，已在推送清单中手动补充（建议 SEO 会话更新 sitemap 生成逻辑）。
- IndexNow 批量推送：**313 个 URL**（sitemap 310 + 手动补 3），密钥沿用 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt`。
- 五端点结果（2026-08-08）：

| 端点 | HTTP |
|---|---|
| api.indexnow.org/indexnow | 200 |
| www.bing.com/indexnow | 200 |
| yandex.com/indexnow | 202 |
| search.seznam.cz/indexnow | 200 |
| searchadvisor.naver.com/indexnow | 200 |

## 四、结论与建议

1. 收录仍处于早期：可核验的引擎中 360 为 0，其余被反爬拦截无法取数，无证据显示收录数量变化。
2. 根因未变：百度/搜狗/360 需站长平台验证 + 主动提交（需账号，见 manual-todo-round8）；数据中心 IP 触发反爬导致复查受阻。
3. IndexNow 推送已完成且全部端点成功，Bing/Yandex 侧的收录需 1-2 周后回访复查。
4. 建议老板用住宅/手机网络人工执行一次 site: 复查并截图，作为下一轮基线。
