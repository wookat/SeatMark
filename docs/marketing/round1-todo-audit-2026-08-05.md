# 第一轮引流待办盘点与自动执行回执（2026-08-05）

> 说明：本次盘点时，仓库全部分支与 17 个历史 PR 中均未找到第一轮引流报告 / 知乎小红书素材包文件（docs/ 下仅有 content-matrix.md、template-audit.md、compliance-audit-2026-08.md）。以下待办基线依据任务描述中提到的典型待办类型（站长平台验证、导航站提交等）重建，并逐项确认当前状态。

## 一、待办完成度盘点

| # | 待办事项 | 类型 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | 百度站长平台（ziyuan.baidu.com）站点验证 + 普通收录/快速收录提交 | 人工（需百度账号） | ❌ 未完成 | 站点未被百度收录（见收录报告）；验证需账号登录 + 文件/HTML 标签验证 |
| 2 | Bing Webmaster Tools 站点验证 + sitemap 提交 | 人工（需微软账号） | ❌ 未完成 | Bing 当前查询不到任何收录结果 |
| 3 | 360 站长平台（zhanzhang.so.com）验证 + 提交 | 人工（需 360 账号） | ❌ 未完成 | 360 site: 查询 0 收录；公开提交入口 info.so.com/site_submit.html 也强制 360 账号登录（本次已尝试，见回执） |
| 4 | 搜狗站长平台（zhanzhang.sogou.com）验证 + 提交 | 人工（需搜狗/微信账号） | ❌ 未完成 | 搜狗 site: 查询 0 收录 |
| 5 | robots.txt 放行全部主流引擎与 AI 爬虫 | 自动 | ✅ 已完成 | 线上 robots.txt 已显式放行 Baiduspider/Sogou/360Spider 等 |
| 6 | sitemap.xml 生成并可访问 | 自动 | ✅ 已完成 | https://www.seatmark.cn/sitemap.xml 返回 200，构建期自动同步（当前构建生成 116 条 URL） |
| 7 | 导航站/工具站收录提交（如 hao.uisdc、爱达杂货铺、AI 工具集等） | 大多人工 | ❌ 未完成 | 主流导航站提交普遍需要注册账号或审核留邮箱，见下方人工清单 |
| 8 | IndexNow 接入（Bing/搜狗等即时推送协议） | 可自动 | 🆕 本 PR 完成接入 | 本 PR 已在 `app/public/` 放置 IndexNow key 文件，部署后即可推送（见下） |

## 二、本次自动执行回执

1. **四引擎收录核验**：已执行（结果与截图见 `seo-indexing-report-2026-08-05.md`）。
2. **360 收录提交尝试**：打开 `https://info.so.com/site_submit.html`，被重定向到 `i.360.cn/login` 强制登录，无账号无法匿名提交 → 转入人工清单。
3. **百度 site: 查询**：连续 5 次触发「百度安全验证」旋转验证码且提示「存在安全风险，请再次验证」（数据中心 IP 风控），无法完成 → 收录数待人工在本地网络核验。
4. **IndexNow 接入（本 PR）**：
   - 新增密钥文件 `app/public/f04fd03b147f6e5178d97e8e20770a6d.txt`（内容即密钥本身，纯静态、不含隐私）。
   - 合并部署后执行一次推送即可（可加入 CI 或手动执行）：
     ```bash
     curl -s "https://api.indexnow.org/indexnow" -H 'Content-Type: application/json' -d '{
       "host": "www.seatmark.cn",
       "key": "f04fd03b147f6e5178d97e8e20770a6d",
       "keyLocation": "https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt",
       "urlList": ["https://www.seatmark.cn/"]
     }'
     ```
   - 更完整做法：从 sitemap.xml 提取全部 116 条 URL 填入 `urlList`（单次上限 10000 条）。IndexNow 会同步分发给 Bing、Seznam、Naver、Yandex 等成员引擎。

## 三、人工必须项清单（需真实账号，按优先级）

| 优先级 | 事项 | 入口 | 预计耗时 | 备注 |
|---|---|---|---|---|
| P0 | 百度站长平台验证 + 提交 sitemap + 手动提交首页/教程页 | https://ziyuan.baidu.com | 20 min | 百度是国内考务老师第一入口，未收录 = 流量为 0；验证后可拿到普通收录 API token，之后可自动化每日推送 |
| P0 | Bing Webmaster 验证（可用「从 Google Search Console 导入」或文件验证） | https://www.bing.com/webmasters | 10 min | 验证后 IndexNow 推送生效更快 |
| P1 | 搜狗站长平台验证 + 提交 | https://zhanzhang.sogou.com | 15 min | 搜狗承接微信搜一搜部分流量 |
| P1 | 360 站长平台验证 + 提交 | https://zhanzhang.so.com | 15 min | 需 360 账号；或用 info.so.com/site_submit.html 匿名口（也要登录） |
| P2 | 导航站提交：AI 工具集（ai-bot.cn）、爱达杂货铺、优设导航（hao.uisdc.com）、小众软件、appinn 论坛 | 各站「提交收录」入口 | 各 10-20 min | 多数需留邮箱或注册；SeatMark「免费+隐私优先」定位适合小众软件/少数派投稿 |
| P2 | 少数派 / V2EX「分享创造」/ 即刻 发布产品介绍帖 | sspai.com、v2ex.com/go/create | 30 min | 开发者向社区，外链质量高，利于收录与口碑 |

> 提示：完成百度站长验证后，把验证文件（如 `baidu_verify_codeva-xxxx.html`）提交到 `app/public/` 即可随构建部署，后续会话可自动完成剩余提交动作。
