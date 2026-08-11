# 运营第十九轮记录（2026-08-11）

> 角色：growth/operations（参照 company-os CHARTER 与 SOP-05）。范围：收录复查、IndexNow 全量重推、素材第十九批（`marketing/batch19/`）、竞品动态速查、人工待办更新。
> 证据目录：`docs/ops-round19-evidence/`。基线：第十八轮 `docs/ops-round18.md`。
> 网络环境说明：本轮出口 IP 为数据中心 IP（100.23.34.160）。百度总查询正常取到结果页；360 正常取到页面；搜狗点选验证码、Google reCAPTCHA 拦截如旧；Bing 仍兜底污染。均如实记录，未硬闯。

## 一、收录复查（site:www.seatmark.cn，2026-08-11）

| 引擎 | 第十七轮 | 第十八轮 | 本轮实测（2026-08-11） | 变化 |
|---|---|---|---|---|
| 百度 site: | 约 1 个（仅首页） | 约 1 个（仅首页） | **约 1 个（仅首页）**：「找到相关结果数约1个」，唯一结果为 www.seatmark.cn 首页（`baidu-site-2026-08-11.png`） | 持平（仍仅首页） |
| Google site: | 无法核验（reCAPTCHA） | 无法核验（reCAPTCHA） | **无法核验**：reCAPTCHA 图形验证拦截，IP 100.23.34.160（`google-site-2026-08-11.png`） | 不可比 |
| Bing site: | "About 33,000"兜底污染 | "About 118"兜底污染 | "About 6,270 results"，首屏全是 zs.com/wikipedia 等医疗咨询无关结果，**仍为兜底污染，不可作证据**（`bing-site-2026-08-11.png`） | 持平（不可核验） |
| 搜狗 site: | 无法核验（点选验证码） | 无法核验（点选验证码） | **无法核验**：点选验证码拦截（「请依次点击【滥,从,潞,杠】」）（`sogou-site-2026-08-11.png`） | 不可比（沿用 round11 实测 0 作基线） |
| 360 site: | 0 | 0 | **0**（「抱歉，未找到相关搜索结果」）（`360-site-2026-08-11.png`） | 持平 |

### 新页面收录重点检查（/vs 矩阵 + 两个长尾落地页 + 热门模板/教程页）

- 百度总收录约 1 条且仅首页 ⇒ /vs 五页、/desk-card-generator、/name-card-batch 及全部模板/教程页**均未被百度收录**（总量约 1 已足以判定，未再触发 /vs 精查验证码）。
- 360 总收录 0 ⇒ 上述页面均未被 360 收录。
- 搜狗/Google 被验证码拦截，无法核验。
- 结论：/vs 矩阵与长尾落地页第七轮复查在可核验范围内**仍未收录**，与 round18 零增量。百度自 round14 起总量始终约 1 条（仅首页），331 页放量仍卡在站长平台主动提交（P0，连续十轮）。

## 二、IndexNow 全量重推（2026-08-11 09:52 UTC）

- sitemap：`https://www.seatmark.cn/sitemap.xml` 实取 **331 个 `<loc>`**（与 round18 持平），全量推送。
- key 文件 `https://www.seatmark.cn/f04fd03b147f6e5178d97e8e20770a6d.txt` 线上 200，密钥沿用。
- 推送方式：POST JSON（host/key/keyLocation/urlList 331 条）至五端点。**成功率 5/5 = 100%**。

| 端点 | HTTP | 结果 |
|---|---|---|
| api.indexnow.org/indexnow | 200 | 成功 |
| www.bing.com/indexnow | 200 | 成功 |
| yandex.com/indexnow | 202 `{"success":true}` | 成功 |
| search.seznam.cz/indexnow | 200 | 成功 |
| searchadvisor.naver.com/indexnow | 200 | 成功 |

## 三、素材第十九批（已入库 `marketing/batch19/`，不发布）

- `zhihu-answer-batch19.md`：1 篇（「批量桌牌的数据导入/文件导出坑」问答，主打稳健性五卖点）
- `xiaohongshu-post-batch19.md`：1 篇（行政视角「导出总是莫名少几张」痛点切入）
- `wechat-article-batch19.md`：1 篇（「被浏览器吞掉的桌牌文件：五处较真」长文）

本批统一主打五个新卖点：**① Excel 重名列/超长表头稳健导入**（第 229 轮：重名列自动加序号后缀不丢列、超长表头映射收敛，线上复测全绿）；**② 照片链路可信闭环**（第 231 轮照片专项走查全绿 + 第 232 轮更换数据源时「照片已清除」明确提示，不再静默清空）；**③ 电子墨水屏 4096px 大宽度导出**（第 234–236 轮：大宽度关闭超采样、>2048px 不再卡死）；**④ 导出文件名秒级时间戳不丢件**（第 238–239 轮：同一分钟双导出不再被浏览器同名去重静默吞掉）；**⑤ 五页 Lighthouse 性能基线**（第 233 轮：五核心页无劣化）。所有卖点均有已上线产品事实与测试报告背书，不含虚构数据。

## 四、竞品动态速查（2026-08-11）

| 竞品 | 本轮观察 | 证据 |
|---|---|---|
| placecard.us | 与 round18 对照**无新增变化**：置顶横幅仍为「New: Import directly from Google Sheets - no data entry needed」（指向 /import-data?source=google-sheets）；页脚生态入口仍为 Chrome Extension、Google Sheets Add-on、Amazon Listing；宣传口径仍「50,000+ place cards created this week」（数字未变）。免费 + Word/Avery 5302 模板口径不变。 | `placecard-us-2026-08-11.png` |
| 创客贴 chuangkit.com | 模板搜索页（sj-pi25 路由 kw=桌牌）直接触发腾讯滑块验证码，反爬持续收紧；无法进入模板列表核对桌牌品类，未见新专题迹象。 | `chuangkit-2026-08-11.png` |
| WPS | WPS 学堂搜「桌牌」仍是两条旧视频（「快速用 WPS 文字打印会议坐席牌」1 分 29 秒 7.7 万人已学、「利用邮件合并功能制作员工工牌」2 分 26 秒 18.4 万人已学），人数与 round18 量级一致，无新增桌牌相关教程/能力。 | `wps-learning-2026-08-11.png` |

小结：placecard.us 本轮无新动作（Google Sheets 直连仍是主推，未见进一步迭代）；创客贴反爬进一步收紧（连模板搜索页都上滑块）；WPS 无新动作。竞争面稳定，我方差异化口径（中国市场 + 名单隐私 + 打印校准 + 电子墨水）不变。

## 五、人工待办

见 `docs/ops/manual-todo-round19.md`。P0 仍为四大站长平台注册验证（连续十轮未破口，331 页收录放量唯一通道）；P6 建议优先发布第十八批（隐私零外发实证）与本批（稳健性五卖点）素材。

## 六、结论与下一步

1. 收录线：与 round18 零增量。百度仍约 1 条（仅首页）、360 仍 0、搜狗/Google 验证码拦截、Bing 兜底污染。站长平台验证提交仍是 P0 唯一破口。
2. IndexNow 331 条五端点全部成功（连续多轮全绿）。
3. 素材第十九批已入库 `marketing/batch19/` 不发布；「导出丢件」这类隐蔽痛点是本批最易引发共鸣的传播点。
4. 竞品：三家均无实质新动作；创客贴反爬收紧侧面说明其流量防守姿态。
5. 下一轮建议：站长平台未验证前收录线只做例行复查；素材线可考虑围绕 /seating 排座 + 课桌贴联动做场景化长文（开学季时点临近）；若老板完成站长平台验证，立即执行百度普通收录/快速收录 API 全量提交。
