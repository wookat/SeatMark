# 第 239 轮：#241 导出文件名时间戳秒级 生产复测

代码依据：#241（a539193）pngExport.ts:140-145 `defaultPngExportName` 与 pdfExport.ts:763-768 `defaultPdfFileName` 的 stamp 均追加 `pad(getSeconds())` → `-YYYYMMDD-HHMMSS`；r237 P4 背景：分钟级同名 zip 在同一分钟内被 Chrome 下载去重静默丢弃（16 次成功 toast 仅 6 个文件落盘）。按字段命名路径（PreviewArea.vue buildFieldFileNames）不含时间戳，不受影响。判据全部以「toast + 磁盘落盘文件名」双取证。

## T0 部署确认
- 轮询 entry 直到 ≠ `index-CXMSr-GO.js`；记录新 bundle。未翻转不判定。

## T1 核心：同一分钟内连续两次相同 PNG 导出均落盘
- `/studio?template=eink800` 导入 3 行夹具，同一分钟内（导出间隔 ~3-5s，必要时对齐分钟边界重试）连续两次 800 宽精确像素导出。
- 判据：两次均出成功 toast「PNG 图片已生成（3 张标签打包为 zip）」；下载目录**新增 2 个 zip**，文件名形如 `电子座签 800×480-800x480-YYYYMMDD-HHMMSS.zip` 且秒位互异（旧行为：第二个文件不落盘——本判据在未修复时必 fail）。

## T2 PDF 文件名秒级且落盘
- 同工作区导出 PDF 一次。判据：成功 toast；落盘 `*-YYYYMMDD-HHMMSS.pdf`（文件名正则 `-\d{8}-\d{6}\.pdf$`）。

## T3 回归抽查
- 整页（非逐张）PNG 导出一次：落盘文件名亦 `-\d{8}-\d{6}`，产物可解（zip 或 png）。
- 按字段命名模式（pngNameMode=field，模板 `{姓名}`）逐张导出一次：落盘文件名为字段值（如 `张伟234-…` 或纯字段名），**不含时间戳**（该路径不受 #241 影响，命名正常即可）。

## T4 收尾
- 全程 pageerror=0；清 storage、SeatMark tabs 全关；写 test-report.md 第 239 轮章节。
