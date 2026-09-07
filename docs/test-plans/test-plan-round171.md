# 第 171 轮（小轮补测）：小尺寸标签自动提清（>300dpi）分支的 pHYs 取样

代码依据：`app/src/utils/pngExport.ts` L159-176 `pngRasterScale`（`PNG_BASE_SCALE=3.125`、`PNG_MIN_OUTPUT_WIDTH=1000`、`PNG_MAX_SCALE=8`，`CSS_PX_PER_MM=96/25.4≈3.77953`）；逐张 pHYs=`output.width/rect.width×1000`（L493/L515）；整页 pHYs=`pxPerMm×1000`（L362，按页宽 210mm → base 3.125 → 11811）。小标签模板选 **drinkCup（36×24mm，defaultTemplatesLife.ts）**：need=1000/(36×3.77953)=**7.349**（<8 不封顶）→ 逐张输出宽 ≈**1000px**、pHYs≈1000/36×1000≈**27778 px/m（≈705.6dpi）**，显著 >11811，与 300dpi 基准可区分。#180 已上线（`index-BTp5Le9S.js`），无需等部署。

## T1 逐张 PNG（提清分支）
- `/studio?template=drinkCup&demo=1` →「图片 PNG」（默认按标签逐张）→ 带水印导出。
- 断言：zip 抽 3 张，每张 IHDR 宽 ≈1000px（±5px，允许取整）；**pHYs 存在**、x=y=round(output.width/36×1000)（实测宽代入公式一致 ±2）、≈27778 px/m（>11811，即 ≈706dpi）；unit=1；内容非空白。

## T2 整页 PNG（同模板对照）
- 同 tab 切「按整页导出」再导出，抽 1 张。
- 断言：整页仍 **2481×3509**、pHYs=**11811 px/m**（300dpi 基准，不随小标签提倍）。

注意：每个导出脚本内重连 browser WS 重设 `Browser.setDownloadBehavior` downloadPath（r170 教训）。
产出：test-report.md 第 171 轮（92→93 节）、截图 r171_*、产物 /home/ubuntu/r171_dl/。headless 不录屏。收尾关闭测试 tab。
