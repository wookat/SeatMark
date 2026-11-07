# SeatMark 英文教程中心扩容调研与选题方案

- 调研日期：2026-11-08（Google 检索当日实查；竞品页面实际抓取）
- 角色：内容 SEO 研究员 + 产品策略
- 结论先行：**英文教程不应从中文 78 篇翻译，应按「竞品已验证的关键词矩阵」原生重写**。英语市场 2024-2026 年涌入大量同形态 indie 工具（paste 名单 → 本地生成 PDF → free/no upload），它们的引流公式高度一致：how-to 长尾文章 + 程序化落地页 + 免费可下载资产三层结构。我们当前只有 3 篇英文教程且**无图**，并存在 2 个会拖住转化的产品缺口（无 US Letter 纸型、无 Avery 编号预设）。下面先拆竞品打法与用户痛点，再给完整选题与执行清单。

---

## 1. 竞品内容打法拆解：它们靠什么引流

### 1.1 同形态工具（直接对标）

| 竞品 | 内容资产（实测） | 打法 |
|---|---|---|
| **placecard.us** | blog 文章按「数据源」拆：from Word / from Google Sheets / from CSV / from Canva / in Word 小批量；`/guides` hub 页按用户卡点分组；免费空白 PDF 下载页（blank 6-up、wedding 6-up、meal choice、tent、Avery 5302、flat 3×2、wide 4×2）；`/microsoft-word-templates`；另有 **Google Sheets 插件**导流 | 「how to X from Y」一词一篇 + 免费 PDF 做 link bait + hub 页承接导航；水印发 PDF 免费、干净 PDF 收 credits |
| **seatful.app**（婚礼排座，iOS+Web） | `/guides/` 约 17 篇编辑教程（seating chart 做法、礼仪、head table、RSVP "M" 行、每桌坐几人、ideas）+ **程序化分页**：按人数 50/60/…/400 guests 一页一个；按场景 banquet/corporate/gala/quinceañera 一页一个；「用你已有的工具做」系列（in Excel / in Google Sheets / in Canva）+ 免费 template 下载（seating chart template、guest list template）；已做日语/西语版 | 编辑部教程打权威 + 程序化页面扫长尾 + 免费模板换链接与邮件 |
| **labelpeel.com** | **每个 Avery 编号一页**：5302、5390…，页面含精确尺寸表（含 mm）、纸张方向、"要印几张要几页"速查表、FAQ；页内嵌 paste-list 工具 + 免费 Word/PDF 空白模板下载 | Avery 编号词的程序化收割；顺带卖「免打字」工具 |
| **badgeflow.app** | 每个 Avery 胸卡编号一篇博客：`print-avery-5392-name-badges-from-excel`、`print-avery-5390-...` | 同上，blog 形态 |
| **sheetstolabels.com** | 按数据源/平台拆：`name-badges-from-excel`、blog 有「from Excel, Google Sheets, or Eventbrite」；主推 QR check-in badge | 平台导出词（Eventbrite/Cvent/Google Forms export）是会议场景的真实搜索词 |
| **lineuplabels.com** | 单页工具：paste Excel/Sheets 名单 → Avery 5011/5302 PDF；"no upload, no account, name twice upside-down" | 轻工具页 + FAQ 直接收「from excel」长尾 |
| **puzzlepage.app / freeclasstool.com** | 教师向名牌生成器：desk name plate、cubby/locker label、book bin tag、supply label、word wall card 多品类；卖点是 **"no Canva"**、"Last, First 自动翻转"、"names never uploaded"、200 名上限 | 打 TPT/Etsy「可编辑模板仍要手打 30 个名字」的落差；按教具品类分页 |
| **makemystickers.app / anytool.tech / printmigo.com** | 轻量 name tag maker 单页 + 大 FAQ 块（尺寸对照、要不要覆膜、Avery 5395/5390/5392 预设） | 「name tag maker」工具词首页全是 indie 站，证明可打 |
| ** meadowtools / floorplanmaker.app / plan.numbersplainly** | 浏览器本地排座工具页 + 打印套件（floor plan / find-your-seat 字母序表 / place cards / table numbers） | 「seating chart maker」词 indie 可上首页；本地处理已成标准话术 |
| **weddingdraft.com / lovelyseating（英国）** | UK 市场用 **"table plan"** 而非 "seating chart"；输出 A3/A2/A1 海报、top table 礼仪、5ft/6ft round、trestle 桌 | 英美用词/纸张/礼仪不同——英文内容要兼顾 en-US 与 en-GB 词面 |

### 1.2 生态位玩家（内容参照物）

- **Avery 官博**：节假日内容矩阵（"53 Free Printable Thanksgiving Place Cards"），证明季节词量级大。
- **Canva / Adobe Express**：落地页占位大词，但 bulk create 是隐藏功能——placecard.us 专门写「Canva 逐页改名的痛」截流。
- **Etsy / Templett / Corjl 模板商**：可编辑 place card 模板 $4-8、buffet/food label 卡同价、**meal choice icons 还是加价项**——验证付费意愿，也暴露「买了模板仍要逐张手打」的效率缺口。
- **101planners.com**：免费 Word/Excel/PowerPoint 模板下载站，「seating chart template」类大词竞争者——下载型词面需要可下载资产才能打。
- **pc/nametag BadgeStream / conferencebadge.com**：会议胸卡 $499+/场或按张收费代印 → 「小活动自己印胸卡」正是免费工具缺口。
- **tallcoleman.me / thetenttown / tentrm / macmyths**：Word 里做双面 tent card 的 20 步 workaround 教程被大量引用——**这是真实且未被官方解决的用户痛点**。

### 1.3 共同公式（可直接复用的单篇结构）

搜索词作标题 → 3-5 步 how-to（**每步配截图**）→ 尺寸/纸张/张数表格 → 打印防坑（100% scale、测试页、纸向）→ FAQ（兼做 FAQPage 结构化数据）→ 直达工具 CTA（预载演示数据）→ ≥2 条相关内链。站层再配：hub 分组页、免费 PDF/模板资产、程序化分页。

## 2. 用户痛点（来自真实讨论，按人群）

### 2.1 所有人群共通

- **Word/Avery mail merge 做 tent card 是重灾区**。Microsoft Q&A 多条：官方 5302 模板打完"整张卡都在孔线以下"、加图后 merge 丢图、双面板要把文字旋转 180° 的手工 ritual（tallcoleman 教程 20+ 步）。→ 「No mail merge」是最强钩子。
- **打印缩放/错位**是第二大抱怨。每篇都要教固定动作：print at 100% / Actual Size、先打一张普通纸对光检查、关 borderless。→ 我们的 ≤0.35mm 校准向导是竞品没有的差异化，值得每篇提一次。

### 2.2 婚礼/宴会 DIY 人群

- 名单在 Excel，seating chart 在 Word 里做大字再拿 Office Depot/Staples 印 18×24 海报——真实工作流（WeddingWire 讨论）。
- **escort cards vs place cards** 是高频概念题（brides/weddingwire/planning.wedding 都有专文）；meal choice 图标（牛/鸡/素）是 Etsy 加价项，caterer 要看。
- RSVP 最后一刻变动 → 需要"名单改一行，卡与图同步重出"。
- 美国特有场景被竞品单独开页：**quinceañera、bar/bat mitzvah、sweet 16、gala/fundraiser、graduation、baby shower、corporate dinner**（seatful、planseats、seatedbytini 实证）。
- 季节脉冲：Thanksgiving/Friendsgiving/Christmas place cards（11-12 月）、婚礼季（春夏 + 1-4 月筹备期）。

### 2.3 教师人群

- TPT 上「name tags editable」48,000+ 资源、$1-5 还**要手打 30 个名字**——puzzlepage 的「paste roster → regenerate」打法正中痛点。
- ProTeacher 讨论证实：name plates 要 laminate/velcro、考试时要撕下或遮盖（→ plain/简单款需求）、学生流动要随时重打、花名册导出常是 **"Last, First"**（puzzlepage 把自动翻转做成卖点）。
- 同一份名单出多品类是教室刚需：desk plate + cubby label + book bin + supply label + word wall——正好对应我们"一份名单多模板"的能力。

### 2.4 会议/办公人群

- 会议双面 name tent 是刚需（workshop/training/board meeting），Word 做法同样痛苦。
- Event badge 印制 SaaS 贵（BadgeStream $499 起/场、conferencebadge 按张）；Eventbrite/Cvent/Meetup 导出 CSV → 自助打印是长尾词。
- 参会名单 = PII，企业环境对上传最敏感——本地处理卖点在这群最值钱。

## 3. 关键词格局 → 内容形态映射

| 词群 | 量级与竞争 | 承接形态 |
|---|---|---|
| 工具词（place card maker / name tag maker / seating chart maker / name tent generator） | 量小（10-100 至 1k 级），**indie 站已占首页**，可打 | /en 程序化落地页（复用 topicPages 机制）或单页工具位 |
| 品类模板词（place card template、desk name plate、name tent template、seating chart template、printable place cards） | 量大，Avery/Canva/Etsy/101planners 占据；「+free printable」变体可打 | 模板库英文页 + **免费可下载 PDF 资产页** |
| Avery 编号词（5302/5305/5309/5011/5371/5390/5392/5395/5160/8371；兼容 25305/5914/74459…） | 官方垄断编号词本身；「编号 + from excel/generator/bulk/template」缝隙 indie 已验证 | **依赖产品加 Avery 预设**，然后一编号一页 |
| how-to 长尾（print X from excel/sheets/csv/eventbrite；escort vs place cards；double sided tent cards；how many guests per table） | 竞品内容主战场，单篇 5-8 min read | **enGuides 主战场**（本方案主体） |
| 场景词（wedding/quinceañera/gala/corporate/classroom/holiday + seating chart/place cards/badges） | 中量、分散、可程序化 | banquet/seating 视图的场景分页 |
| 概念/礼仪词（escort vs place、head table、RSVP M 行、table plan UK） | 问答型，易被 AI Overview/精选摘要摘取 | FAQ 密集短教程 |

## 4. SeatMark 现状与差距

已有：`/en` 全站架构、英文 UI 字典（~1100 条，含模板英文名）、3 篇英文教程 + 5 篇英文对比页（Article/HowTo/FAQ 结构化数据齐备）、banquet 宴会排座 + 教室排座视图、226 模板、照片按文件名匹配、0.35mm 校准、PWA 离线。

差距（按影响排序）：

1. **教程正文不支持图片**。`.article-body` 只有 h2/h3/p/ul/ol/a/strong/code/table 样式，78 篇中文教程零图；而竞品每篇 3-6 张截图/示意图/表格。用户明确要求图文结合——这是本轮必补的结构性改动（也关系 Pinterest/图片搜索分发）。
2. **无 US Letter 纸型**：`PAPER_PRESETS` 仅 A4/A5/A3。美国用户打印 Letter 会被迫缩放 → 错位——正好是教程里教他们避免的事。写 Avery/Letter 教程前必须先补。
3. **无 Avery 编号预设**：`labelPapers` 只有国内 A4 不干胶（Avery L 系列兼容标注）。5302/5305/5390/5392 是英语市场标准工作流入口，也是内容流量入口。
4. 英文教程 3 篇 vs 竞品 15-40 篇/站；`/en/guides` 无分组 hub；无免费 blank PDF 资产；topicPages 机制存在但无英文条目。
5. 文案遗留：`enGuides` FAQ 写 "Pro (normally CNY 19/mo)"——旧价且币种不对；英文站应统一 free-first 叙事（支付宝 Pro 对海外用户不可付，写进英文 FAQ 反而劝退）。
6. 名序处理：美国花名册导出常是 "Last, First"，puzzlepage 把自动翻转做成卖点——可作为小功能 + 教程卖点。

## 5. 选题方案（原生重写，不翻译）

原则：标题直接命中搜索词；每篇带 howTo + ≥2 FAQ + quickStart（预载模板+演示数据）+ ≥2 互链；写英文用户真实流程（Sheets/Excel/Eventbrite/Word 语境、inch 与 Letter、Staples 打印店、TPT/Etsy 参照物）。

### Batch 1 — 无产品依赖，可直接写（建议本轮 6 篇）

| slug | 标题（目标词） | 依据与衔接 |
|---|---|---|
| `place-cards-from-google-sheets` | How to Print Place Cards from Google Sheets | placecard.us 同款标题已验证；Sheets 导出 CSV → SeatMark import 一步衔接 |
| `double-sided-name-tents` | How to Make Double-Sided Name Tents (No Word Mail Merge) | Microsoft Q&A/tallcoleman 痛点；meetingTent 模板自动正反镜像正是解药；会议+婚礼双场景 |
| `desk-name-tags-from-class-list` | Printable Desk Name Tags from a Class List | 教师开学季词；粘贴名单→desk 牌/cubby 签多品类；写 Last,First、laminate、考试遮盖 |
| `wedding-table-numbers` | Wedding Table Numbers That Print From Your Guest List | 同名单出桌号牌（tableNoStand）；与 seating chart/place cards 互链成婚礼内容簇 |
| `escort-cards-vs-place-cards` | Escort Cards vs Place Cards: What to Print & How Many | 概念问答，AI 摘要潜力股；把 meal icons、每桌备 5-10% 余量讲透 |
| `holiday-place-cards` | Printable Holiday Place Cards (Thanksgiving & Christmas) | 正当季（11 月）；Avery 官博证明量级；图文/decor 风格适合 Pinterest |

### Batch 2 — 依赖产品补齐（US Letter / Avery 预设）或确认项

| slug | 标题 | 前置依赖 |
|---|---|---|
| `avery-5302-place-cards-from-excel` | Print Avery 5302 Tent Cards from Excel — No Mail Merge | **Avery 5302 预设 + US Letter** |
| `avery-5392-name-badges` | Print Avery 5392 Name Badges from an Attendee List | **5392/5390 预设**；badge 场景接 Eventbrite CSV |
| `word-mail-merge-place-cards` | Place Cards in Word: Mail Merge Steps & When to Skip It | 无依赖（教育+截流）；也可做 /en/vs/word-mail-merge 对比页 |
| `event-badges-from-eventbrite` | Print Event Badges from an Eventbrite Export | 确认 Eventbrite CSV 列名映射即可（产品已支持表头映射） |
| `meal-choice-icons-place-cards` | Place Cards with Meal Choice Icons (Chicken/Fish/Veg) | 需 meal icon 字段/小图标能力——若无，先用组合字段方案写，同时记为功能建议 |

### Batch 3 — 程序化与规模化（机制先行）

- **en topicPages**：给 topicPages 加 `lang`，建 `/en/place-card-maker`、`/en/name-tent-maker`、`/en/name-tag-maker`、`/en/desk-name-plate-generator`（工具词首页 indie 占位实证可打）。
- **Avery 编号页**：预设落地后每编号一页（参考 labelpeel：尺寸表+张数速查+FAQ+内嵌工具）。
- **场景分页**（banquet/seating 视图）：quinceañera、gala/fundraiser、corporate dinner、graduation、baby shower、classroom seating chart。
- **人数分页**：seating chart for 100/150/200 guests（seatful 模式）。
- **英国词面**：table plan 术语页或在婚礼页同时覆盖 "table plan (UK)" 表述。

### 不建议直译的中文教程（及改造映射）

不翻：中考/高考/四六级/艺考/考研考场系列（美国无对等考试桌贴文化）、微信内使用/支付宝分享机制、政务/医院/电竞/驿站等国内场景、双 11/开学季国内节点。
映射重写：考场座位贴 → classroom seating chart（弱化考试）；家长会桌牌 → parent-teacher conference name tents；年会物料 → corporate dinner/gala badges+tents；幼儿园姓名贴 → cubby/supply labels；档案盒/宿舍门贴 → office/dorm door signs（低优先）。

## 6. 结构与产品建议（按优先级）

**P0（写 Batch 1 前/同期）：**
1. `.article-body` 增加 `img`/`figure`/`figcaption` 样式；约定 `public/guides/<slug>/` 存 WebP 截图（lazy loading、alt 含关键词）；每篇 3-6 张：操作步骤截图、打印对话框"100% scale"标注图、纸张/裁切示意。图可被 Google Images/Pinterest 二次分发。
2. 修正 enGuides "CNY 19/mo" 表述 → free-first 口径。
3. US Letter（215.9×279.4mm）进 `PAPER_PRESETS`；/en 下默认 Letter（locale/geo 默认项），拼版自动按纸重排。

**P1（Batch 2 前置）：**
4. Avery 预设：5302（4-up tent）、5305/5309（大 tent）、5011（6-up）、5390/5392/5395（badge insert/adhesive）、5371/8371（business card 可作 place card 代用）；labelPapers 支持非 A4 基纸或建独立 "Avery 兼容" 层。
5. "Last, First" 名序自动识别/翻转开关（低成本、可写成卖点）。
6. /en/guides 索引按 blocker 分组（From a spreadsheet / Paper & printing / Weddings / Classroom / Events & badges）；zh 侧可复用。
7. 免费资产页：blank printable PDF（6-up、tent、badge grid）+ guest list template（CSV/XLSX 下载）——link bait + Pinterest 素材；机制上可用 studio 预渲染或直接静态文件。

**P2（观察期后）：**
8. en 定价/支付本地化（Stripe/Paddle）或坚持全免费叙事；现支付宝对海外不可付。
9. Google Sheets add-on（placecard.us 已卡位，评估成本后定）。
10. inch 显示切换（mm 内核不变，UI 显示换算）。

**站外分发：** 每篇配图直接产 Pinterest pin（wedding/classroom/holiday 板块，旺季前 4-6 周铺）；GSC+Bing 提交新 URL；Reddit r/weddingplanning / r/Teachers / r/EventProduction 以"免费工具+教程"真诚分享；问答（Microsoft Q&A 类）下对症回帖。

## 7. 验收口径

- 数据层：`npm run test`（enGuides.spec 已强制 slug/title 唯一、无 CJK、related≥2 有效、/en 内链、quickStart 模板 id 有效、FAQ≥2、keywords≥3、howTo、SEO 结构化数据 Article+Breadcrumb+HowTo+FAQ）。
- enContentPaths.ts 同步登记新 slug（vsPages.spec 断言一一对应）。
- 新增图片资产进 `app/public/guides/` 并在 prerender 后确认 dist 含文件；`<img>` 带 `loading="lazy"` 与描述性 alt。
