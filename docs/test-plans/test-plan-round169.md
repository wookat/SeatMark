# 第 169 轮：前进/后退与 bfcache + 导出 PNG 物理 DPI 元数据 + 模板缩略图灰字对比度复查（生产站，无新部署，bundle index-BPYEjASD.js）

代码依据：`app/src/router/index.ts` L114-127 scrollBehavior——savedPosition 经双 rAF 恢复（后退应回到原滚动位）、锚点正则排除 `#tpl=` 分享 hash；studio 状态在 sessionStorage（`seatmark.workspace-roster.v1`/`workspace-template.v1`），SPA 内后退不重挂载即不丢。`app/src/utils/pngExport.ts` L274-291 canvasToPngBlob：索引色 PNG（rasterizeIndexedPng）或原生 toBlob——**仓库内无任何 pHYs 写入代码**，预期导出 PNG 无 pHYs chunk（需在真实产物上核验）。`app/src/components/label/TemplateThumb.vue` L55 缩略图容器 `aria-hidden="true"`（纯装饰语义已具备），需实测其内部小灰字 computed color 与背景对比度。

## T1 浏览器前进/后退与 bfcache
1. /studio 导入 CSV（复用 r156_fix_bom.csv 10 行）+ 切模板（标准考场版→课桌姓名贴，等 toast）。记录 roster 键值长度、预览枚数、模板名。
2. history.pushState 不算——用真实 UI 点导航链接去 /templates，滚动到页面中部（记录 scrollY>0）。
3. **浏览器后退**（CDP `Page.navigateToHistoryEntry` 或 history.back()）回 /studio：断言 roster/模板/字段映射与步骤 1 完全一致（名单 10 条、课桌姓名贴、预览正常）——若状态丢失即 fail。
4. 多跳链：/ → /studio → /templates → /seating，后退×3 逐站断言：每站 URL 正确、页面渲染正常（关键元素存在）、pageerror 0；回 /templates 时 scrollY 恢复到步骤 2 记录值 ±100px（scrollBehavior savedPosition 判据）。
5. 前进×1（history.forward()）回 /seating 正常。截图 r169_back_studio.png、r169_back_templates_scroll.png。

## T2 导出 PNG pHYs 元数据（报告 only）
1. /studio 演示数据 → 「图片 PNG」→ 标准清晰度（300dpi）导出整页 PNG，捕获产物。
2. 解析 PNG chunk 列表：是否含 pHYs；若含，px/m 应 ≈11811（300dpi）；若不含，如实记录「无 pHYs，打印软件将按默认 72/96dpi 解释，物理尺寸约放大 3-4 倍」，结合像素尺寸（A4@300dpi≈2481×3509）评估影响并定级建议（预期 P3 裁量：主推打印链路是 PDF/打印，PNG 多用于屏显）。
3. 顺带记录逐张 PNG（单标签）同样有无 pHYs。

## T3 模板缩略图灰字对比度复查（第 122 轮裁量项收口）
1. /templates 实测：TemplateThumb 容器 aria-hidden=true 确认（装饰语义）；取缩略图内最浅小字的 computed color 与其有效背景，手算对比度。
2. 结论输出：若 aria-hidden 且纯装饰 → 建议维持现状（WCAG 1.4.3 不适用装饰文本）；若有信息性文字 <3:1 则给修复建议。截图 r169_thumb.png + 放大裁片。

产出：test-report.md 第 169 轮（90→91 节）、截图 r169_*、PNG 产物 /home/ubuntu/r169_dl/。headless 不录屏。收尾清理 sessionStorage/测试 tab。
