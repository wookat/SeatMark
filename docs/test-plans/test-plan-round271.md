# 第 271 轮：模板发现链路质量专项（/templates 搜索·筛选·详情·进工坊，生产，无代码变更轮）

代码依据（09bfa47）：`TemplatesView.vue:79-117` 搜索×分类叠加+类内无命中回退全库（提示文案 searchScopeNote）、`:213-252` 无结果态（「没有匹配“q”…」+「清除搜索条件」+3 款推荐）、`:69-76` 分类计数；`pinyin.ts:59-63` 简拼（首字母）支持、`:73-97` 全拼懒加载 pinyin-pro（q≥2 字母触发加载，ready 后 computed 重算）；`TemplateDetailView.vue:49-60` 规格徽章（label mm/列×行·枚每页/纸张 mm）、`:73-77`「用此模板开始」→ `/studio?template=slug`、`:196` 无 slug 匹配渲染 NotFoundView；`StudioView.vue:108` 读取 query.template。

环境：生产 https://www.seatmark.cn/templates ，CDP 29229 全新 incognito context；lazy 缩略图 defer（r99）——断言卡片渲染前滚动+等待。

## T1 搜索质量
- 中文「考场」「婚礼」「桌牌」：各返回 >0 卡片，且首屏卡片名称/场景文本确实含关键词（抽验前 3 张逐字），计数=实际卡片数。
- 全拼「hunli」：命中数应与「婚礼」命中集合近似（≥1 且卡片含婚礼类模板）；输入后等 2s（pinyin-pro 懒加载 ready 重算）再断言。
- 简拼「jkz」：应命中「监考证」类模板（placeholder 自证支持简拼）；命中 >0 且卡片名首字母串含 jkz——历史开放项就此闭环记录。
- 无结果：输入「zzzzzz不存在」→ 显示「没有匹配“zzzzzz不存在”的模板」+「清除搜索条件」按钮 + 3 款推荐卡片；点清除 → 恢复全量（卡片数=222 或页首宣称数一致）。
- 健壮性：输入 `<script>alert(1)</script>`、1000 字符长串、`%%%'"` → 无 pageerror、无结果态正常显示原文（XSS 不执行）。
## T2 筛选与叠加（r81 回归）
- 分类 chips：点某分类（如含「婚礼」的分类）→ 卡片数=该 chip 计数；子分类 chips 出现时点一个子类 → 数量=子类计数。
- 叠加：分类 A + 搜索该类内存在的词 → 提示「在「A」分类中找到 N 款」且 N=卡片数、所有卡片属 A 类；分类 A + 搜索仅它类存在的词 → 回退提示「「A」分类下无匹配，已在全部分类中找到 N 款」且卡片数=N（对照：若回退逻辑破坏则显示无结果态——可区分）。
## T3 详情页与进工坊（3 款不同场景抽样：standard 考场 / 婚礼席位卡 / 签到桌牌版）
- 每款：从列表点卡片进详情 → 预览缩略图渲染（截图像素级非空白）、规格徽章（label mm、列×行·枚/页、纸张 mm）与 defaultTemplates 源数据逐字一致、含「用此模板开始」。
- 「用此模板开始」→ URL=/studio?template=<slug> → 工坊预览渲染该模板版式且演示数据跟随场景（r115：如婚礼模板演示数据为宾客类而非考号类——断言预览文本含场景相符字段）。
## T4 深链与 404（r85 回归）
- 直开（新 context goto）`/templates/standard`：预渲染 HTML 直出正文（curl 静态源含模板名）+ 浏览器渲染正常。
- 无效 slug `/templates/no-such-slug-xyz`：渲染 NotFound 视图（页面含 404/未找到文案），非空白非崩溃；curl 该 URL 记录 HTTP 状态如实。
## T5 移动端 390×844
- /templates：搜索框可用、分类 chips 可点、卡片单列无横溢（scrollWidth≤390）；搜索「考场」正常；进详情页规格/CTA 可见可点、无横溢。
## T6 常规
- 全程 pageerror=0；请求 URL/body 无搜索词外发（遥测面：搜索词「考场」等不出现在任何第三方请求）；storage 清理、context 全关、常驻 Chrome 不动。

## 报告
- test-report.md 第 271 轮置顶章节 + 本计划 + 简拼开放项结论 + 如有 SKILL.md 建议。
