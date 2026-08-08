# 竞品曝光对照与缺失长尾关键词清单（第八轮，2026-08-08，供 SEO 会话使用）

## 一、竞品搜索曝光方式核查（2026-08-08 实测页面 title）

> 方法：直接抓取竞品分类/搜索页 `<title>`（curl），数据中心 IP 无法用搜索引擎侧验证排名，故只对照竞品自身的 title 词构造方式。

| 竞品 | 实测页面 | title 构造 | 可借鉴点 |
|---|---|---|---|
| 稻壳儿 Docer | `docer.com/search/preview?keyword=桌牌` | 「最多收藏的桌牌PPT模板素材-PPT模板下载-PPT图片素材库-Docer稻壳儿」 | ①每个关键词都有独立可收录搜索落地页；②title 用「最多收藏的{词}」情感前缀 + 载体词「PPT模板/下载/素材库」堆长尾；「席卡模板」「座位牌」等词均同样生成 |
| 稿定设计 | `gaoding.com/templates/桌牌`、`/templates/席卡` | title 恒为「稿定设计」（前端渲染，SSR 未输出关键词 title） | 其分类页 SEO 反而弱于稻壳，SeatMark 的 SSR 模板详情页有机会截胡 |
| Canva 中国 | `canva.cn/templates/?query=桌牌` | title 恒为「Canva」，description/keywords 为空 | 同上，中文长尾竞争强度低于预期 |

结论：真正在中文长尾上做透的是稻壳（关键词 × 载体词 × 场景词的组合页矩阵）。稿定/Canva 中国的模板检索页对搜索引擎几乎不可见，**「XX模板+免费+在线制作」类长尾是可攻窗口**。

## 二、SeatMark 现状（线上 title 实测）

- 首页：`座签·桌牌席卡·门贴证卡批量生成 - SeatMark 座签 | Excel 批量打印`
- /templates：`标签模板库：座签·桌牌·证卡免费模板 - SeatMark 座签`
- /guides：`教程中心：座签·桌牌·标签打印教程 - SeatMark 座签`

覆盖了「座签/桌牌/席卡/证卡/批量」，但缺「在线制作/生成器/打印模板/word」等检索意图词。

## 三、缺失长尾关键词清单（10 个，按优先级）

| # | 关键词 | 意图 | 建议落地页 |
|---|---|---|---|
| 1 | 桌牌在线制作 免费 | 工具型，稻壳只给下载不给在线做 | 首页或 /templates 类目页 title 加「在线制作」 |
| 2 | 席卡模板 免费下载 | 稻壳主打词，我们可用「免费+无需注册」差异化 | /templates 席卡分类页 |
| 3 | 会议桌牌怎么做 word | 教程型高频问句，可从 Word 用户截流 | /guides 新增「Word 邮件合并 vs 在线批量」教程 |
| 4 | 考场座位牌批量打印 | 教务场景词，「座位牌」与现有「座签」不同词 | /templates 考场分类 + 考场高对比详情页 |
| 5 | 婚礼席位卡在线生成 | 「席位卡」变体词 + 鎏金水彩新模板 | deluxeWedFoil 详情页 title/正文 |
| 6 | 姓名牌制作 幼儿园 | 幼师场景，云朵模板对口 | deluxeKidsPastel 详情页 |
| 7 | 台签模板 电子版 | 政企采购常搜「台签/电子版」 | deluxeGovGuilloche 详情页 |
| 8 | 班牌设计 模板 免费 | 班主任场景，黑板报班牌对口 | deluxeClassChalk 详情页 |
| 9 | excel 批量生成桌牌 | 精准工具意图词，竞争极低 | 首页已有「Excel 批量打印」，建议 /guides 出同名教程页 |
| 10 | 座位签 打印 a4 | 纸张规格长尾，打印意图明确 | /guides 打印校准教程页 |

## 四、给 SEO 会话的执行建议

1. 6 个新模板详情页（deluxeWedFoil/GovGuilloche/KidsPastel/ExamFocus/ClassChalk/ConfFret）的 title/description 中植入上表 #5-#8 对应长尾词。
2. 修复 sitemap：第 69 轮 3 个新详情页（ExamFocus/ClassChalk/ConfFret）线上 200 但未进 sitemap（本轮 IndexNow 已手动补推）。
3. 参考稻壳做法，为「桌牌/席卡/座位牌/台签/班牌/姓名牌」等同义词建立可收录的模板筛选落地页（title 含「免费·在线制作·无需注册」）。
4. /guides 新增两篇教程承接 #3、#9、#10 问句词。
