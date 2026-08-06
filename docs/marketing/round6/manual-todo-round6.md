# 人工发布清单（第六轮，2026-08-06，按 ROI 排序）

> 说明：以下事项需要人工账号/验证，Devin 无法代办。按预期投入产出比（ROI）从高到低排列。

## P0（高 ROI，解锁收录的关键路径）

### 1. 百度站长平台验证 + API 主动推送 ⭐ 持续 P0
- 现状：百度仅收录首页 1 条（见 `seo-indexing-round6-2026-08-06.md`），是五大引擎中已收录但未展开的引擎，边际收益极高。
- 操作：
  1. https://ziyuan.baidu.com 注册/登录，添加站点 `www.seatmark.cn`，完成 HTML 文件或 DNS 验证；
  2. 提交 sitemap：`https://www.seatmark.cn/sitemap.xml`（307 条 URL）；
  3. 开通 API 主动推送（快速收录），把 token 交给 Devin 后可脚本化每日推送。
- 预期：数周内收录从 1 → 数十/上百，解锁"考场桌贴生成工具"等长尾词的百度流量。

### 2. Bing Webmaster Tools 提交 sitemap
- 现状：本轮 Bing 实测被出口 IP 风控污染，无法确认收录/排名状态；IndexNow 推送返回 200 但站长工具里才能看到真实索引数。
- 操作：https://www.bing.com/webmasters 用 Microsoft 账号验证站点，提交 sitemap，并核对"URL 检查"中首页与热门教程页的索引状态。
- 预期：确认品牌词第 1、2 位是否仍在；获得官方索引数据替代不可靠的 site: 实测。

## P1（中高 ROI，0 → 1 突破）

### 3. 搜狗站长平台提交
- 现状：搜狗收录 0（`evidence/sogou-site-2026-08-06.png`）。
- 操作：https://zhanzhang.sogou.com 验证站点，提交 sitemap 与首页 URL。
- 预期：0 → 1 的收录突破；搜狗承接微信生态搜索流量。

### 4. 360 站长平台提交
- 现状：360 收录 0（`evidence/360-site-2026-08-06.png`），结果页明确给出收录入口。
- 操作：https://zhanzhang.so.com 验证站点提交 sitemap；另在 http://info.so.com/site_submit.html 免验证提交首页。
- 预期：0 → 1 收录突破。

## P2（内容分发，积累品牌搜索需求）

### 5. 知乎回答发布（3 篇，素材见 zhihu-answers-round6.md）
- 问题链接已验证：
  - https://www.zhihu.com/question/291970168 （WPS 会议桌牌）
  - https://www.zhihu.com/question/429072237 （PS 批量工作牌）
  - https://www.zhihu.com/question/572365070 （电子墨水屏技术）
- 注意：间隔 2-3 天发布，发布后回填回答链接。

### 6. 小红书笔记发布（3 篇，素材见 xiaohongshu-posts-round6.md）
- 行政（PNG/ZIP）、行政（墨水屏）、教师（考场）三个人群，错开发布并配实拍/截图封面。

### 7. 公众号长文发布（1 篇，素材见 wechat-article-round6.md）
- 发布后向搜狗微信搜索生效，可部分弥补搜狗网页收录缺口。

### 8. 短视频发布（2 条，口播稿见 video-scripts-round6.md）
- 抖音/视频号/B 站，两条错开一周。

## P3（观察与复查）

### 9. 下轮收录复查改用可信网络
- 本轮 Google（reCAPTCHA 循环拒绝）与百度品牌词/长尾词（安全验证循环）均被数据中心 IP 拦截，Bing 结果被兜底污染。
- 建议：下轮用住宅/办公网络人工复测五引擎品牌词与长尾词排名，与本轮证据对比。

### 10. IndexNow 周期性推送
- 本轮已全量推送 307 条 URL（5 端点全部 200/202）。sitemap 更新后可随时让 Devin 复跑推送脚本，无需人工。

---

## 上轮（round5）P0 状态回顾

| 事项 | 状态 |
|---|---|
| 百度站长平台验证 | 未完成 → 本轮继续 P0 |
| Bing Webmaster Tools | 未完成 → 本轮 P0 |
| 搜狗/360 站长平台 | 未完成 → 本轮 P1 |
| 第五批素材发布 | 请人工确认发布进度，未发布的与第六批合并排期 |
