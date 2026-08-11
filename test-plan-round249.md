# 第 249 轮：#253 图片版 PDF dpi 降档提示（生产，Chromium CDP）

代码依据：#253（149f058）仅在 `PreviewArea.vue:1307` 导出选择弹窗 pendingAction='pdf' 的体积预估行内，`exportEstimate.dpi < 240` 时新增 `span.text-amber-700`「页数较多时清晰度自动降档以控制体积；追求最高打印清晰度请改用「打印 / 矢量 PDF」。」。r247 实测 dpi：40 行=300、300 行=192、1000 行=168。部署确认：生产 entry 已翻转 `index-B7iIsDpm.js` → `index-DL6SyG-8.js`。

环境：CDP 29229 全新 incognito context；夹具复用 `~/r247_fixtures/big300.xlsx`；toast observer + expect_download。

## T1 阳性（300 行 → 13 页 ≈192dpi）
- /studio?template=standard 导入 big300.xlsx →「共 300 条」→ 点「图片版 PDF」打开导出选择弹窗。
- 判据：预估行含「共 13 页 · 每页约 192dpi」；琥珀提示 span 可见且文案逐字=「页数较多时清晰度自动降档以控制体积；追求最高打印清晰度请改用「打印 / 矢量 PDF」。」；计算色为 amber-700（rgb(180, 83, 9)）；**截图像素可见**（弹窗截图）。
- 三宽度 390/768/1280：弹窗打开时 `document.documentElement.scrollWidth <= innerWidth` 且弹窗元素自身无横向溢出（dialog.scrollWidth<=clientWidth）；各截图。

## T2 阴性（40 行 → 2 页 300dpi）
- 全新 context 导入 `~/r240_fixtures/ff240.xlsx` → 同弹窗。
- 判据：预估行含「300dpi」；页面中降档提示文案出现次数=0（且弹窗截图无琥珀行）。

## T3 回归：图片版 PDF 实际导出
- T1 弹窗内选「带水印」→ toast「图片版 PDF 已生成」、expect_download 落盘、pypdfium2 13 页 p1 非空白>0.5%、文件名秒级。

## T4 常规
- pageerror=0；请求标记串（张伟247/隐私学校247）命中 0；清 storage、关自建 context（常驻 Chrome 不动）。

## 报告
- 追加 test-report.md 第 249 轮章节（不提交）；如有新坑记 SKILL.md 建议。
