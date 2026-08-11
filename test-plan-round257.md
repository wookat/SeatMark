# 第 257 轮：#261 /seating 移动端横滑提示线上复测（生产，Chromium CDP）

代码依据：#261（eefd229）`app/src/views/SeatingView.vue:638`——视角切换/选中提示行 `</div>` 之后、`previewContainer`（overflow-auto 网格容器）之前新增一行：`<p class="mb-1 text-[11px] leading-5 text-slate-400 sm:hidden">← 座位表超宽时可左右滑动查看 →</p>`。Tailwind `sm:hidden` = ≥640px 隐藏。r246 已证移动端网格容器可横滚、点选换座可用。

环境：CDP 29229 全新 incognito context；SeatingView 是懒加载 chunk，页面 HTML 不含其哈希——部署确认用浏览器 DOM 是否出现提示文案（或抓 entry JS→chunk 内容 grep）。移动口径用 CDP 窄视口 390×844（不必开 WebKit，判据是 CSS 断点与 DOM，引擎无关；r246 已做过移动 WebKit 全量）。

## T0 部署确认
- 打开 /seating（390px 视口），DOM 出现「座位表超宽时可左右滑动查看」即部署完成；未出现则轮询（每 60s 重开新 context，~30 分钟未翻转如实报 blocked）。

## T1 390px 移动端：提示可见+位置+无溢出
- 视口 390×844 打开 /seating，粘贴 10 行名单生成排座（r246 方法：完全随机）。
- 判据：提示文案**截图像素可见**；DOM 位置 = 提示元素紧邻 previewContainer 之前（`hint.nextElementSibling` 为 overflow-auto 网格容器，且位于视角/选中提示行之后）；`document.documentElement.scrollWidth<=390` 无横向溢出；`getComputedStyle(hint).display!=='none'`。
- 换座冒烟（Regression）：点选两个座位名互换（下标互换实证）。网格容器仍可横滚（scrollWidth>clientWidth 或容器 overflow-auto 且内容超宽时）。

## T2 ≥640px 桌面：提示隐藏
- 视口 1280×800 打开 /seating：`getComputedStyle(hint).display==='none'` 且 `offsetParent===null`；截图中不出现该文案。

## T3 常规
- pageerror=0；请求无隐私标记外发（本轮名单用 张伟257-* 标记，命中 0）；storage 清理、context 关闭、常驻 Chrome 不动。

## 报告
- test-report.md 第 257 轮章节 + 本计划 + #261 复测评论文案；如有新坑 SKILL.md 建议。
