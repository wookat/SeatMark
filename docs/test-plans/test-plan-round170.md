# 第 170 轮：#180 标准模式导出 PNG 写入 pHYs 物理分辨率块 线上验收

代码依据（origin/main 0949b44）：`app/src/utils/indexedPng.ts` L155-172 `withPngPhys`（IHDR 后 offset 33 插入 pHYs，单位=米，已有 pHYs 幂等返回）；`app/src/utils/pngExport.ts` L362 `pixelsPerMeter = options.exactPixels ? undefined : pxPerMm*1000`，L367（整页）与 L382（逐张）都经 canvasToPngBlob（L276-300，索引色与原生 toBlob 两通道均插入）；eink 模板 `eink800` 默认精确像素 800×480 + 纯黑白（PreviewArea.vue L175-190）→ exactPixels 路径 pixelsPerMeter=undefined 无 pHYs。第 169 轮已取得旧行为基线：**无 pHYs**（同一方法论产物 /home/ubuntu/r169_dl/，判据天然可区分）。当前未翻转（entry `index-BPYEjASD.js`、sw md5 `35927928…`）。

## T0 部署翻转
- 轮询 entry hash + sw.js md5 双指标（两者都变 + 复采样一致），稳定 2 分钟。

## T1 整页 PNG（标准 300dpi）
- /studio?demo=1（课桌姓名贴 24 标签）→「图片 PNG」→ 切「按整页导出」→ 导出。
- 断言：zip 内 PNG chunk 序列含 **pHYs**，x=y≈**11811 px/m**（±1）、unit=1；Pillow `img.info['dpi']`≈(300,300)；IHDR 仍 **2481×3509**；图像内容无回归（PIL 打开渲染正常、非空白、与 r169 产物视觉一致性抽查）。

## T2 逐张 PNG
- 同 tab 再导出默认「按标签逐张导出」→ 24 张 zip 抽 3 张。
- 断言：每张含 pHYs；dpi=ppm×0.0254 合理（≈300dpi 或小标签提清后更高的整倍值）；尺寸与 r169 基线一致（1063×354）；内容无回归。

## T3 eink 精确像素（负向判据）
- 切模板 eink800（电子座签）→「图片 PNG」（默认精确像素 800×480+纯黑白）→ 导出。
- 断言：产物 IHDR=**800×480**；**无 pHYs**（刻意不写，若出现即 fail）；像素值仅纯黑/纯白两色（二值化无回归）。

## T4 冒烟（Regression）
- 「打印 / 矢量 PDF」通道：导出图片版 PDF 1 份，pypdfium2 可打开渲染、页数正确；打印 toast「即将调起浏览器打印」出现即可（不必全量 r160 打印捕获）。

产出：test-report.md 第 170 轮（91→92 节）、截图 r170_*、产物 /home/ubuntu/r170_dl/。headless 不录屏。收尾清理 sessionStorage/测试 tab。
