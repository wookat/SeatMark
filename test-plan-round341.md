# 第 341 轮：生产复测（/en 全站壳层 + 404 + 反馈 + 工坊弹窗英文化）

依据：本轮 PR（分支 devin/1788656357-r341-en-shell-i18n）——App 跳转链接 / ToastHost / ModalDialog / NumberField / SelectField / ColorField / ShareWelcomeBanner / NotFoundView / FeedbackButton / QuotaLimitDialog / FitSuggestionBanner（paperFit 展示层 `tFitReason`）/ WeChatGuideOverlay / CalibrationDialog / DuplexGuideDialog / FontPicker 接入 `t()`，prerender.mjs 在 `seo.lang==='en'` 分支追加启动遮罩两处 replace；en.ts 补齐译文。环境：生产 https://www.seatmark.cn ，匿名（不注册、不登录、不发信、不提交预订/反馈表单、不导出），先 curl 核验主包哈希已换新再开始；CDP 用 fresh tab（规避 PWA service worker 旧缓存，见 .agents/skills/testing-seatmark/SKILL.md）。

## T1 生产 curl 复扫 5 个 /en 预渲染页（curl）
- `curl -s https://www.seatmark.cn/en/`、`/en/pricing`、`/en/seating`、`/en/banquet`、`/en/studio` 各一份，剔除 `<script>…</script>`、`<style>…</style>`、`<!-- -->` 后正则 `[\u4e00-\u9fff]` 扫描。
- PASS：仅允许残留 (a) 语言切换「中文」「切换到中文」；(b) ICP 备案号「湘ICP备…号」；(c) 首页模板橱窗内的**模板设计示例内容**（如「座位号 SEAT」「考场-1」示例姓名，属模板数据非壳层文案，与上线前一致，记为既有观察不计失败）。上线前生产基线额外残留「跳到主内容」「操作提示」「反馈」三处壳层文案，上线后必须消失；/en/studio 预渲染页须为 0 CJK（含启动遮罩 `aria-label="Loading"` 与 `Loading SeatMark…`）。

## T2 /en/<不存在路径> 水合后英文 404（录屏 UI）
- 访问 https://www.seatmark.cn/en/does-not-exist-r341 ，等待水合。PASS：标题 'Page not found or moved'，按钮 'Back to home' → href `/en`、'Open Label Studio' → `/en/studio`，快捷链接 Template library / Guide center / Pricing → `/en/templates` `/en/guides` `/en/pricing`；不出现「也许你在找这些教程」区块；页面可见文本除白名单外无 CJK。
- Regression：https://www.seatmark.cn/does-not-exist-r341 仍为中文「页面不存在或已被移动」，并保留「也许你在找这些教程」三条中文教程推荐（href `/guides/<slug>`）。

## T3 /en/studio?demo=1 匿名打开各弹窗（录屏 UI，各截图一张）
- 反馈：点击右下角 'Feedback' 浮动按钮 → 弹窗标题 'Send feedback'，类型 Feature request / Bug report / Other，字段 Feedback type / Your feedback，占位英文，按钮 'Submit feedback'；**只打开/关闭，不提交**。
- 校准：打开「打印校准向导」入口 → 标题 'Print calibration wizard'，步骤说明英文，链接文字 'troubleshooting guide (Chinese)' 且 href 仍为 `/guides/print-offset-calibration-wizard`；不点下载。
- 双面：打开双面 / 对折引导 → 'Duplex / fold-over printing guide'、'Flip on long edge' / 'Flip on short edge'、'Cancel' / 'Got it, continue printing'；点 Cancel 关闭，不打印。
- 字体选择器：展开 → 默认项 'SimSun (system default)'，分组 'Chinese system fonts · offline' 等，搜索占位 'Search fonts (e.g. Kai / Noto / Serif)'，'Offline' 徽标；字体名保持原文（思源黑体 等）。
- 配额弹窗（若能匿名触发）：'Daily watermark-free exports used up' 与 'N watermark-free exports per day'；**不导出**，若需要导出才能触发则标注「未验证（需导出）」。
- PASS：以上弹窗可见文本除字体名外无 CJK。

## T4 中文回归（录屏 UI）
- /studio?demo=1：反馈按钮 aria-label「反馈」、校准向导 / 双面引导 / 字体选择器文案与上线前一致（宋体（系统默认）/ 中文系统字体 · 无需联网 / 打印校准向导 / 双面 / 对折打印引导）。
- /pricing、/：三处壳层（跳到主内容 / 操作提示 / 反馈）与页面 UI 零变化；启动遮罩仍为「SeatMark 座签加载中…」（index.html 未动）。

## T5 pageerror（CDP）
- fresh tab 依次打开 /en/studio?demo=1、/en/does-not-exist-r341、/studio?demo=1、/、/pricing。PASS：`Runtime.exceptionThrown` 均为 0；Log error 级仅允许 `net::ERR_BLOCKED_BY_CLIENT` 资源拦截噪声（第 327 轮口径）。

收尾：清 localStorage / sessionStorage / IndexedDB，关多余 tab。产出：录屏、截图、test-report.md 第 341 轮章节顶部逐项标注「直接实证 / 未验证」。
