# 人工必须项清单（第三轮，按 ROI 排序）

> 只列需要真实账号/手机号/本地网络、无法由 Devin 代办的项；每项附入口与预计耗时。上两轮 P0（站长平台四件套）仍未完成，继续置顶。

| 优先级 | 事项 | 入口 | 预计耗时 | 为什么值得做（预期收益） |
|---|---|---|---|---|
| **P0-1** | 百度站长平台验证 + 提交 sitemap + 领普通收录 API token（验证文件放 `app/public/` 提交 PR 即部署；token 存为 Devin 密钥 `BAIDU_ZIYUAN_PUSH_TOKEN`，之后每日推送可完全自动化） | https://ziyuan.baidu.com | 20 min | 百度是教师人群第一入口；当前仅收录首页 1 页，238 页长尾全部未收录=自然流量为 0 |
| **P0-2** | Bing Webmaster 验证（文件验证或从 GSC 导入） | https://www.bing.com/webmasters | 10 min | 验证后 IndexNow 推送即时生效（本轮已推 238 条在排队）；顺带解锁 api.indexnow.org 聚合端点 |
| **P0-3** | Google Search Console 验证 + 提交 sitemap | https://search.google.com/search-console | 10 min | Google 已收录首页，验证后可请求全站抓取 |
| **P0-4** | 站点接入访问统计（百度统计或自托管 Umami） | https://tongji.baidu.com | 30 min | 没有统计则所有渠道 ROI 无法验收（连续三轮的前置缺口） |
| **P1-1** | 知乎发布 3 篇回答（素材 `zhihu-answers-round3.md`，问题链接已选定验证） | 知乎账号（手机号） | 30 min | 目标问题现有回答质量低，卡位后单篇稳态 50-300 阅读/天 |
| **P1-2** | 搜狗 + 360 站长平台验证提交 | https://zhanzhang.sogou.com / https://zhanzhang.so.com | 各 15 min | 搜狗已自然收录 5 条（承接微信搜一搜）；360 仍为 0，提交是唯一破冰口 |
| **P1-3** | 小红书发布 3 篇图文（素材+截图清单 `xiaohongshu-posts-round3.md`） | 小红书账号（手机号） | 60 min（含截图制作） | 开学季流量峰值窗口只有 4 周，错过再等半年 |
| **P1-4** | V2EX「分享创造」+ 小众软件论坛发帖（角度见 `exposure-plan.md` §1/§3） | 邮箱注册 | 40 min | 单帖千级 UV + 高权重外链反哺收录 |
| **P2-1** | 公众号发布长文（`wechat-article-round3.md`） | 公众号后台 | 30 min | 500-2000 阅读 + 可被教师大号转载 |
| **P2-2** | 少数派 Matrix 投稿 | https://sspai.com（手机号） | 40 min | 过稿 2000-5000 阅读一次性峰值 |
| **P2-3** | 导航站需账号批次（AlternativeTo/Product Hunt/SaaSHub/Uneed + 优设导航/小众软件，清单§二） | 各站邮箱注册 | 每站 10-15 min | 长期被动流量合计 100-300 UV/月 |
| **P2-4** | 本地网络 30 秒项：打开 webwiki.com/seatmark.cn 与 sitelike.org/similar/seatmark.cn 触发自动建档（VM 的 IP 被 Cloudflare 拦截） | 浏览器直接打开 | 1 min | 两条免费外链 |
| **P3-1** | 抖音/视频号拍摄 2 条口播 + B站教程视频（脚本 `video-scripts-round3.md`） | 对应账号 | 3-4 h | 建立品牌词搜索；B站教程有长尾（"座签 批量打印"站内搜索无竞品） |
| **P3-2** | 贴吧/QQ群渗透启动（打法见 `exposure-plan.md` §10/§11） | 百度/QQ 账号 | 每周 30 min 持续 | 精准人群口碑，量小但转化高 |
| **P3-3** | twelve.tools / findly.tools 免费收录（需在官网页脚放对方徽章，需产品决策：是否接受互链） | — | 决策 + 10 min | 两条 dofollow 外链；若不接受互链则放弃 |

## 依赖说明

- P0-1 完成后：把 token 存为 Devin 密钥，后续每轮会话可自动执行「新增页面→百度推送」，人工不再介入。
- P1-1/P1-3 发布后：把帖子链接回填本目录（新建 `published-links.md`），下轮自动统计数据。
- 所有社区发帖遵守：公开利益相关身份、不伪造用户身份、不注册需手机验证的账号代发。
