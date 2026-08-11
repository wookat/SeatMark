# 第 259 轮：系统外观偏好稳健性专项（生产，Playwright emulate_media 口径）

代码依据：站点浅色单主题——`app/src` 无任何 Tailwind `dark:` 变体；`index.html` 与 CSS 均**未声明 `color-scheme`**（UA 默认 normal → Chromium 深色偏好下原生控件应保持浅色，不套深色 UA 皮）。reduced-motion 已有降级：`main.css:233`（`.reveal-init` 立即可见、transition:none）+ `HomeView.vue:18`（v-reveal 命中 matchMedia 直接加 reveal-in、不挂 IntersectionObserver）。口径：Playwright `page.emulate_media(color_scheme=…, reduced_motion=…, contrast=…, forced_colors=…)`（context 级偏好模拟，等价系统设置）。

## T1 prefers-color-scheme: dark（核心）
- 四页 `/`、`/studio`、`/templates`、`/seating`（1280×800）dark 下截图 + 与 light 基线像素比对。
- 判据：① 页面整体仍浅色——body 背景 computed 非深色（亮度>200/255），整页截图平均亮度与 light 基线差 <5%；② `getComputedStyle(document.documentElement).colorScheme` 应为 `normal`（无深色声明）；③ 原生控件不混搭深色 UA 样式——/studio 导入区 checkbox（裁切线/高亮缺失）、SelectField、file input 区域截图；dark vs light 对应控件区域逐像素 diff（差异像素占比 <1%，UA 深色控件会产生显著暗色差）；④ 导出弹窗（图片 PNG）dark 下打开截图，弹窗区域 vs light 基线像素 diff <1%。
- dark 下全链路：导入 good40.xlsx →「已读取 40 条数据」→ 逐张 PNG 导出 → zip 40 张 1000×534、0 空白；与 r258 base100（light 100%）按序号逐像素比对（沿用 r258 法：字节全同或仅抗锯齿亚像素差、diff bbox 仅字形轮廓级；若出现内容/配色差异 → fail）。

## T2 prefers-reduced-motion: reduce
- `/` 首页：`.reveal-init` 元素应全部立即带 `.reveal-in`（或 computed transition 为 none/瞬时）——判据：加载后不滚动即 `document.querySelectorAll('.reveal-init:not(.reveal-in)').length === 0`（对照 normal 模式下该值 >0，证明模拟生效）；页面底部元素滚动前 opacity=1。
- 功能回归：/studio 导入 40 行 + 开导出弹窗正常；toast/弹窗过渡属轻量可接受（如仍有 transition 只记录不定级）。
- 全站扫描：reduce 下统计四页 computed `animation-name!=none` 或 `transition-duration>0.3s` 的可见元素数量，如存在大面积长动画未降级按 P4/P3 定级（spinner 类 loading 动画可接受）。

## T3 prefers-contrast: more
- 四页无破版：scrollWidth≤innerWidth、关键按钮（开始制作/图片 PNG/搜索框/完全随机）rect 非零、截图与基线像素 diff <5%（无 contrast 特化样式，预期几乎无差）。

## T4 forced-colors 冒烟（r172-175 已闭环，不重复全量）
- forced_colors='active' 下 /studio 打开：pageerror=0、页面可交互（导入按钮可点）、截图留档即可。

## T5 常规
- pageerror=0；标记串（张伟250/隐私学校250）零外发；storage 清理、context 全关、常驻 Chrome 不动。

## 定级
- dark 下控件深色混搭/页面发暗 = P3（视觉突兀，全体深色系统用户可见）；reduced-motion 大面积未降级 = P4/P3 视影响；均给最小复现（emulate_media 参数 + 页面 + 元素）。

## 报告
- test-report.md 第 259 轮章节 + 本计划 + 如有 SKILL.md 建议。
