# 运营第九轮记录（2026-08-09）

> 角色：growth/operations。范围：收录复查、IndexNow 全量重推、素材第九批、人工待办更新。
> 证据目录：`docs/ops-round9-evidence/`。基线：第八轮 `docs/marketing/round8/seo-indexing-round8-2026-08-08.md`。
> 网络环境说明：本轮出口 IP 仍为数据中心 IP（100.23.34.160），百度/Google/搜狗继续触发反爬验证，与第七、八轮一致，如实记录并跳过。

## 一、收录复查（site:www.seatmark.cn，2026-08-09）

| 引擎 | 第六轮 | 第七轮 | 第八轮 | 本轮实测（2026-08-09） | 变化 |
|---|---|---|---|---|---|
| 百度 site: | 约 1（首页） | 无法核验（滑块） | 无法核验（滑块循环） | **无法核验**：安全验证「拖动滑块使图片为正」拦截（`baidu-captcha-blocked-2026-08-09.png`） | 不可比 |
| Google site: | 无法核验（reCAPTCHA） | 约 1（首页） | 无法核验（reCAPTCHA） | **无法核验**：异常流量 reCAPTCHA 拦截，IP 100.23.34.160（`google-recaptcha-blocked-2026-08-09.png`） | 不可比 |
| Bing site: | 兜底约 62 条 | "约 5,140"兜底污染 | "约 5,370"兜底污染 | "About 3,970 results"，但首屏全部为 Bray FTG 阀门手册等无关结果，**仍为兜底污染，不可作证据**（`bing-fallback-polluted-2026-08-09.png`） | 持平（不可核验） |
| 搜狗 site: | 0 | 无法核验（验证码） | 无法核验（antispider） | **无法核验**：antispider 中文点选验证码拦截（`sogou-antispider-blocked-2026-08-09.png`） | 不可比 |
| 360 site: | 0 | 0 | 0 | **0**（"抱歉，未找到相关搜索结果"，提示到 `info.so.com/site_submit.html` 提交）（`360-zero-results-2026-08-09.png`） | 持平 |

结论：与第七、八轮相同——数据中心 IP 被百度/Google/搜狗全面拦截，Bing 为兜底污染不可用，360 明确为 0。收录破零仍依赖站长平台注册验证 + 主动提交（见 `docs/marketing/round9/manual-todo-round9.md` P0）。

## 二、IndexNow 全量重推（2026-08-09 19:27 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 当前含 **323 个 `<loc>`**（第八轮为 310+手动补 3=313；第八轮缺失的 3 个模板详情页已进入 sitemap，本轮无需手动补充）。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：与前几轮一致，POST JSON（host/key/keyLocation/urlList 全量 323 条）至五端点。
- 五端点结果（**323/323 全量成功**）：

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、素材第九批（已入库 `docs/promo/`）

- `docs/promo/xiaohongshu-posts-round9.md`：3 篇
- `docs/promo/zhihu-answers-round9.md`：2 篇
- `docs/promo/wechat-articles-round9.md`：2 篇

本批统一突出的新卖点：222 款模板、教程 quickStart 一键开始、纸型深链自动适配模板、手机端全流程可用、名单/照片不上传（浏览器本地生成）、60 页 PDF 仅约 2MB、300dpi 高清 PNG。

## 四、人工待办

见 `docs/marketing/round9/manual-todo-round9.md`（四大站长平台注册验证仍为 P0 根因项；目录站人工提交承接前几轮未完成项）。

## 五、结论与下一步

1. 可核验引擎（360）收录仍为 0，其余被反爬拦截，无证据显示收录变化；根因（站长平台未验证）未解除。
2. IndexNow 五端点全部成功，Bing/Yandex 侧收录建议 1-2 周后回访。
3. 建议老板尽快完成 P0 站长平台四件套，并用住宅/手机网络人工 site: 复查截图作为下一轮基线。
