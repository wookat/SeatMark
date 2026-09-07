# 第 318 轮：英文版国际化生产复测（PR #328 i18n 架构 + #329 英文 SEO 着陆页，已合并，EdgeOne 部署）

环境：生产 https://www.seatmark.cn 。部署判定：curl `/en` 预渲染 HTML 出现 `<html lang="en">`（静态变更，rev 头不变）。>20 分钟未更新则改本地 `npm run build` + preview 验证并如实注明。无需登录、不发邮件、不注册账号。
代码依据：app/src/i18n/index.ts（LOCALE_STORAGE_KEY='seatmark.locale'，切换器 rememberLocale）；AppHeader.vue 语言切换 switchTarget；utils/banquet.ts 拉丁字母片段不按空格拆分；data/seo.ts EN_LOCALIZED_BASES 5 核心页 + 镜像页 noindex,follow；scripts/prerender.mjs lang/hreflang/og:locale/sitemap xhtml:link；HomeView.vue HERO_EN_NAMES（Emma Johnson…）；locales/en.ts「PNG 已导出」→'PNG exported'。

## T1 /en 预渲染 HTML 口径（curl，shell 证据）
- `curl /en`：`<html lang="en">`；title 含 "Seating Chart Maker"；canonical=`https://www.seatmark.cn/en`；hreflang 三连 zh-CN(`/`)/en(`/en`)/x-default；og:locale=en_US；JSON-LD 存在。
- `curl /en/studio /en/pricing /en/seating /en/banquet`：均 lang="en" + 各自 canonical/hreflang，且**无** noindex。
- 对照 `curl /`：lang="zh-CN"、canonical=`/`、hreflang 亦互挂、og:locale=zh_CN。
- 未本地化镜像抽 1 页（如 `/en/templates`）：`<meta name="robots" content="noindex, follow">` 且 canonical 指回中文原页。
- `curl /sitemap.xml`：总 url 数 340；含 /en /en/studio /en/pricing /en/seating /en/banquet 5 条 loc；url 条目含 `xhtml:link rel="alternate" hreflang`。

## T2 /en 首页浏览器渲染 + 语言切换器（录屏）
1. 打开 https://www.seatmark.cn/en 。PASS：整页英文（hero 标题英文、按钮 "Start Creating" 类）、hero 预览卡为英文演示数据（Emma Johnson / Liam Smith…非张伟）、模板橱窗英文名。
2. 点击头部语言切换器（EN↔中文）切回中文。PASS：URL 变 `/`、页面变中文、hero 恢复张伟等；localStorage `seatmark.locale`='zh'。
3. 再切英文。PASS：URL `/en`、`seatmark.locale`='en'；**刷新后仍停留 /en 且英文**（记忆生效）。

## T3 /en 核心页 UI + Studio 英文导出 toast
- /en/pricing、/en/seating：首屏核心 UI 英文（标题/按钮），截图。
- /en/studio：载入演示数据（demo）→ 导出 PNG 一次。PASS：导出成功 toast 为英文（'PNG exported' 类），非中文「PNG 已导出」。

## T4 /en/banquet 西文姓名不拆分
- /en/banquet 名单粘贴 `Alice Wang\nBob Li` 导入。PASS：识别 **2** 位宾客 "Alice Wang"、"Bob Li"（若旧逻辑会拆成 Alice/Wang/Bob/Li 4 人）。
- 中文对照：同框粘贴 `张伟 王芳`（同行空格分隔）。PASS：仍拆成 2 位（中文空格分隔行为不变）。

## T5 中文站无回归（Regression）
- / 首页中文、hero 中文演示数据张伟等、视觉正常（截图）。
- 中文 /studio：演示数据 → 导出 PNG 一次成功，toast 中文「PNG 已导出」。

## T6 390px + pageerror
- CDP 390×844：/en 首页与 /en/banquet scrollWidth ≤ 390；error/unhandledrejection=0。

收尾：清浏览器存储。产出：录屏（T2–T5 浏览器部分）、报告第 318 轮置顶 test-report.md。
