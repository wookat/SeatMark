# 第 357 轮调研：用户任务流走查复核 + 去 AI 味文案复核

生产 www.seatmark.cn（部署判据：x-seatmark-rev=r356、index-DM_zAX3Y.js、main=9394990），匿名、未注册未登录，CDP 驱动驻留 Chrome（29229）+ curl + 源码对照实证，测试后已清空浏览器存储（22 个标签页逐个清 localStorage/sessionStorage/IndexedDB/CacheStorage/SW 后导航离开）。本轮**只调研不改代码**，与第 344 轮同题，重点复核旧发现修复情况并挖新卡点。

证据分级：【实证】= 生产环境直接操作/观察；【代码】= 源码定位；【推断】= 未直接验证。

## 一、第 344 轮发现复核：8 项全部已修复

| r344 发现 | 本轮实证结果 |
|---|---|
| /seating 粘贴不识别 Excel Tab 多列+表头 | 【实证】已修。粘贴「姓名\t性别\t学号」4 行 →「已输入 4 名学生」，提示「识别到性别列，可用男女混排」「性别、学号已忽略 1 列附属信息（学号）」；placeholder 已写明「可直接从 Excel 复制含表头的多列粘贴」；也接受 .xlsx/.csv 上传 |
| 无性别列点「男女混排」静默 | 【实证】已修。按钮 disabled + title「名单需包含性别列（如：张伟 男）」 |
| /banquet 无分组导入、不收 xlsx | 【实证】已修。粘贴「张伟，男方亲友」6 行 → 「6 位宾客 + 新建 3 个分组」；上传按钮收 .txt/.csv/.xlsx（GUEST_FILE_ACCEPT）；批量归组底部操作条与锁桌（aria-label「锁定 N号桌」）均在 |
| /seating、/banquet 首页仅页脚 1 链 | 【实证】已修。hero 有「班主任排座位 →」「婚礼/宴会排桌 →」CTA；顶部导航新增「排座 ▾」下拉 → 教室座位表 / 宴会排桌 |
| 全角标点硬编码泄漏到英文 UI | 【代码+实证】已修。『。』『：』『（』『）』全部词条化（en.ts:1299-1301, 1455）；/en/pricing 实证渲染 "…redeem codes (Redeem now); Team plan…" 全半角 |
| '人'→guests 串台到教室场景 | 【代码+实证】已修。SeatingView 用 personUnit 语境键，/en/seating 显示 "Entered 47 students / 48 seats."（人数单位 students） |
| 模板数 150+/222+/225 三口径 | 【代码】已修。统一 TEMPLATE_COUNT=225 单一来源，旧值 0 命中 |
| 水印文案与实物不符 | 【实证】已修。导出面板与定价页均为「页脚细线签名」口径 |

## 二、本轮新发现（按严重度）

### 缺陷

1. **【实证+代码·P2】/seating 名单首行表头误判，首名学生静默丢失。**
   粘贴 `Student1\nStudent2…`（/en/seating 48 行）→ 提示 "Entered 47 students / Header row skipped: Student1"；中文首行「名字叫」同样被当表头跳过（`已跳过表头行：名字叫`，3 行变 2 人）。根因：`utils/seating.ts:42` `NAME_HEADER = /姓名|名字|^name$|student/i` —— `student` 未加首尾锚，任何首行含 "student" 子串即误判。英文名单首行是学生本名（如 Student 开头的编号制名单）时真实触发。虽有「已跳过表头行」提示，但粘贴几十行时少一人很难察觉。**建议**：`student` 改 `^students?$` 锚定；或加「首行命中表头词但其余行不像表头时不跳」的保守分支。
2. **【实证·P3】Feedback 浮动按钮压座位图右缘 31×48px（r356 遗留复现确认）。**
   1280 视口：`.seating-sheet` 右缘 x=1233，按钮 x=1202–1250 → 压图纸边界区 31px 宽；座位格本身右缘 1201 仅留 1px。纵向滚动座位图经过按钮带（y 684–732）时视觉相压。**建议**：预览容器右下加 64px 避让（padding-bottom 或 FAB 起 `bottom-5` 改 `bottom-20` 避开常用滚动区），与 NextStepBar 避让一起处理。
3. **【实证·P3】/seating 无撤销。** 手动点选换座/拖拽换座/随机打乱后，唯一回退是「还原名单顺序」整体重置；误换两个座位只能手动换回。班主任微调场景常见。**建议**：操作栈 + 「撤销」按钮（至少单步）。

### 新需求候选（真实用户场景驱动）

4. **【推断·P2】宴会「指定桌 / 必同桌 / 不同桌」硬约束**（r344 已记，本轮确认仍缺）：离异父母分桌、主桌指定席位是婚宴刚需；当前只有「同组尽量同桌」软约束 + 锁桌 + 事后逐人拖。
5. **【推断·P2】考场「固定座位」**（r344 已记，仍缺）：想把某生固定在讲台旁/前排，只能排完后逐个换，再随机会被洗走。
6. **【推断·P3】宴会宾客按「桌容量」成组拆分提示已存在**；进一步可挖「合影/敬酒顺序」类婚庆独有需求（记录在案，不做也行）。

### i18n / 措辞残留（均 P4，r344 已记部分仍在）

7. `en.ts:858` '次（免费登录即升为每日' → "(free sign-in raises it to" —— sign in（登录）与 sign up（注册）混用、"raises it" 生硬；建议 "signing up free raises it to" 或 "create a free account for"。
8. "6 rows × 8 cols" rows/cols 全半词不对称（'排'→rows 已修单复数与大小写，'列'→cols 缩写仍不对称）；建议统一 "6 rows × 8 columns" 或 "6 × 8 grid"。
9. "Left today: 1"（'今日剩余'）词序别扭，建议 "1 left today"。
10. 首页 `<title>` 关键词堆叠（「座签·桌牌席卡·门贴证卡批量生成 - SeatMark 座签 | Excel 批量打印」）机读感强——可不改，记录在案。

## 三、去 AI 味复核结论

**站内文案系统性干净，三道护栏在位且有效**（【代码】`bannedCopy.spec.ts` 覆盖 SEO/专题/对比/模板/模板详情/LabelCard/教程摘要+教程正文禁词；`guideDescriptionQuality.spec.ts` 教程摘要质量；`sampleNamesRealistic.spec.ts` 演示姓名禁网文风名单）：

- 全库扫描 赋能/一站式/轻松搞定/神器/极致/告别/解放双手/助力/玩转/解锁（营销义）/效率倍增/事半功倍/保姆级/手把手/总之/综上所述/众所周知/至关重要/由此可见/不二之选/大大提升 —— **0 命中**（仅「已解锁/锁定」为锁桌功能词、「敏感度不言而喻」一处属正当使用）。
- 英文 locale 扫描 seamless/effortless/elevate/say goodbye/fast-paced/delve/empower/leverage —— **0 命中**。
- 教程正文抽样 8 篇（含 r356 新增 2 篇婚宴教程）：全是具体人话——「160g 哑光卡纸」「打印缩放设实际大小」「按桌名单 .csv 四列固定为桌名/座次/姓名/分组」「签到台要的是来了一个人马上查到在哪桌」，且有真实 FAQ 口吻（「婚礼前两天名单还在变怎么办？这是常态。」）。
- 模板详情 intro（225 款）每条开场独立、场景具体（「寄养高峰期一排笼位十几只毛孩」「网格化管理要求每个楼栋单元公…」），无公式化首句复用。
- /vs 页诚实：对比表含「两者持平」栏，结尾注明「2026-08 实际上手/公开页面调研结论，双方产品均会持续迭代」——不像 AI 一键吹自家。
- 演示数据姓名走「普通姓名池」（张伟/王建国类），有禁名单守门，演示不像展示稿。
- 残留仅上文 7–10 条 EN 措辞小修与 title 堆叠，均属可改可不改档。

## 四、正向确认（本轮实证通过）

- /seating：Tab+表头粘贴识别、完全随机排座、座格渲染、handoff → /studio（6 条名单携座位号/排/列落地，sessionStorage 一次性清除）、查找学生框、教师/学生双视角、A4 横版打印入口均在。
- /banquet：分组粘贴导入、自动分配（同组同桌）、锁桌、空桌前置检查、导出项齐（座位图 PNG/PDF、张贴版、分组色、宾客速查表、按桌 csv、席位卡 handoff）、宾客搜索输入框存在。
- /studio：xlsx 上传 → 自动映射（姓名/座位号命中）→「2 个字段未匹配…导出留空（考场、准考证号）」前置警告 → 预览实时渲染。
- 登录 fail-closed 优雅降级：/account 显示「账号服务暂时不可用…带水印导出与打印不限次」+ 本地配额提示（/api/health 503 auth_secret_missing 为既有状态，非缺陷）。
- 移动端 390px：/、/seating、/banquet、/studio、/pricing、教程页均无文档级横溢。
- /guides：78 篇、有搜索、分类筛选正常；/en/guides 有明确中文-only 声明。
- 全程 pageerror=0。

## 五、给排期的清单

| # | 严重度 | 类型 | 内容 |
|---|---|---|---|
| 1 | P2 | 缺陷 | /seating 首行表头误判（`student` 未锚定），首名学生静默丢失 |
| 2 | P2 | 新需求 | 宴会指定桌/必同桌/不同桌硬约束；考场固定座位 |
| 3 | P3 | 缺陷 | Feedback FAB 压 .seating-sheet 右缘 31×48px（r356 遗留） |
| 4 | P3 | 缺陷 | /seating 无撤销（误换座只能整体还原） |
| 5 | P4 | 措辞 | en "free sign-in raises it"、"rows × cols"、"Left today: N" |
| 6 | P4 | 风格 | title 关键词堆叠（可不改） |

原始证据：本机 /home/ubuntu/seatmark-r357/（脚本 *.mjs、截图 seat_*.png / banq_*.png / studio_*.png / fb_overlap_check.png、页面文本 dump *.txt、测试用 meeting.xlsx）。
