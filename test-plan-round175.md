# 第 175 轮：#184 `.sheet-page` forced-color-adjust: none 线上验收（第 174 轮 FAIL 二修复测）

代码依据：`app/src/assets/main.css` L247-257 —— 豁免属性移到捕获根 `.sheet-page` 自身（html2canvas 克隆根），`.offscreen-host` 原豁免保留（L443-453）。第 174 轮失败基线：forced-colors 下品牌青 rgb(13,148,136) 像素 0（正常基线约 113,898）、与基线 diff 861,650 点——判据天然可区分。部署前置 old 值：`index-h2r97RJA.js` / `index-VqHoINT7.css` / sw md5 `af129298df08c29759d37663326e4a39`。

## T0 部署翻转
- 轮询 entry js + css 文件名 + sw md5 三指标都变 + 二次采样一致；curl 新 CSS 断言含 `sheet-page{…forced-color-adjust:none…}`（fail 判据：新 CSS 无此规则）。

## T1 forced-colors 下导出保留设计色（核心判据）
- /studio?template=deskName&demo=1 → 同 tab 先正常导出整页 PNG 作基线（md5 应=r170 `3e8fdf3e0c8530297998d8ad25623f21`，若新 CSS 改渲染则如实分析）→ Emulation.setEmulatedMedia forced-colors:active → 再导出整页 PNG。
- 断言：产物 2481×3509 @ pHYs 11811；**品牌青 rgb(13,148,136) 像素数 >0 且 ≈113,898**；与同 tab 非 forced 基线 numpy 像素 diff = 0（或仅编码级：diff 像素 0）。r174 失败形态（青 0 像素、纯黑大面积）即 fail。

## T2 屏上 UI 强制配色边界（负向对照）
- 同 forced-colors 状态下 / 与 /studio 截图：应用壳 UI（导航/按钮/文案）仍被强制配色（与正常态截图像素差显著 >10 万点）且可读。注：/studio 预览纸张区域（.sheet-page）保留设计色为**预期**（所见即所得），不算豁免外溢。

## T3 冒烟（Regression）
- 清模拟后正常导出：md5 与 r170 基线一致、pHYs 11811。
- 打印通道：新 tab hook `window.print()` 调起 1 次、pageerror 0。

产出：test-report.md 第 175 轮（95→96 节）、截图 r175_* 入 /home/ubuntu/screenshots/、产物 /home/ubuntu/r175_dl/。headless 不录屏。每导出脚本重连 browser WS 重设 downloadPath。收尾重置模拟 + 关闭测试 tab、清理测试数据。
