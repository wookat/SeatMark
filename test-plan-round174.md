# 第 174 轮：#183 `.offscreen-host` forced-color-adjust: none 线上验收（第 172 轮 P3 闭环复测）

代码依据：`app/src/assets/main.css` L440-449 `.offscreen-host` 加 `forced-color-adjust: none`（可继承，覆盖全部后代）；导出/打印离屏宿主为 `PreviewArea.vue` L1407 与 `SeatingView.vue` L714 的 `.offscreen-host`。第 172 轮已建立失败基线：forced-colors 下导出品牌青 rgb(13,148,136) 全部丢失、与正常基线像素差 70.6 万点——判据天然可区分。部署前置：entry js + css 文件名 + sw md5 三指标翻转且二次采样确认（当前 old：`index-BTp5Le9S.js` / `index-CTzSm9NE.css` / sw `e7e91bb4…`；旧 CSS 实测无 forced-color-adjust）。

## T0 部署翻转
- 轮询三指标都变 + 复采样一致；并 curl 新 CSS 断言含 `forced-color-adjust:none`（构建产物级确认）。

## T1 forced-colors 下导出保留设计色（核心判据）
- /studio?template=deskName&demo=1 → Emulation.setEmulatedMedia forced-colors:active → 整页 PNG 导出。
- 断言：产物 2481×3509 @ pHYs 11811；**顶部主色含品牌青 rgb(13,148,136)**（r172 failed 版为 0 像素）；与同 tab 非 forced 基线 numpy 像素 diff = 0（或仅编码级差异）。若仍出现纯黑 (0,0,0) 大面积替换设计色即 fail。

## T2 屏上 UI 仍被强制配色（负向对照，防豁免范围过大）
- 同 forced-colors 状态下 / 与 /studio 截图：UI 仍可读（文本带非空白）且屏上样式确被强制改写（对照 r172 forced 截图/正常截图，页面级颜色应不同于正常态——`.offscreen-host` 豁免不应外溢到可见 UI）。

## T3 冒烟（Regression）
- 清除模拟后正常导出整页 PNG：md5 应与 r170/172 基线 `3e8fdf3e0c8530297998d8ad25623f21` 一致（若新 CSS 影响渲染则如实分析）、pHYs=11811。
- 打印通道：hook `window.print()` 被调起 1 次、pageerror 0。

产出：test-report.md 第 174 轮（94→95 节）、截图 r174_*、产物 /home/ubuntu/r174_dl/。headless 不录屏。每脚本重连 browser WS 重设 downloadPath。收尾重置模拟 + 关闭测试 tab。
