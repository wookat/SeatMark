# 第 309 轮：全站视觉审计 + 模板全量视觉质检 + 导出物视觉检查 + 覆盖面盘点（生产，匿名）

依据：router/index.ts 全路由清单（/、/studio、/templates(+/:slug)、/papers(+/:slug)、/guides(+/:slug)、/pricing、/account、/seating、/vs(+/:slug)、/desk-card-generator、/name-card-batch、/terms、/privacy）；defaultTemplates* 共 222 款（exam 31 / teaching 43 / event 54 / life 52 / wedding 23 / kids 19，photo 字段 6 款）。

## A 全站页面视觉走查（硬判据 + 软清单）
- CDP 设备仿真 390/768/1280 三宽度 × 13 个静态路由 + 2 篇代表教程页 + 1 个模板详情页 + 1 个纸型详情页 ≈ 17 页 × 3 宽 = 51 组：整页截图、`scrollWidth ≤ innerWidth`、window error 收集。
- PASS 硬判据：51 组全部无横向溢出、pageerror=0。软判据：肉眼扫截图列 P2/P3 精调点（对齐/间距/截断/换行/对比度/拥挤），每条含页面+宽度+元素+现象+建议。

## B 模板全量视觉质检（222 款）
- /templates 1280 下分类逐屏滚动截图（或全页长截图切片），肉眼扫 222 款缩略图：文字溢出字段、装饰错位、对比度不足、演示数据与场景不符。
- 代表 12 款进 /studio 实际预览（点模板卡「以此为基础设计」或 /studio 内搜索选择）：standard、navyConfCard（深色）、drinkCup 36×24（小）、weddingCandy 36×24、libraryCall 36×28、kidsCandy（底占退顶边）、withPhoto（照片）、staffIdCard（照片）、tentBilingual（双语大幅 190×130）、deluxeGovGuilloche（复杂装饰 180×70）、deskName、lotteryTicket。
- PASS：预览无字段溢出/装饰错位/照片占位破图；发现问题按 P 级记录。

## C 导出物视觉检查（抽样）
- standard：带水印 整页 PNG + 逐张 PNG + 图片版 PDF；navyConfCard：逐张 PNG；withPhoto：逐张 PNG（照片占位）；tentBilingual：打印/矢量 PDF（printToPDF throw-stub 保活法）。
- 逐像素/放大检查：字形完整（无缺笔/糊边）、裁切线存在且直、水印细线未丢、颜色保真（深色底反白）、页边距对称。
- PASS：无 P1（丢线/丢字/破图）；瑕疵按 P2/P3 列。

## D 模板覆盖面盘点
- 以 222 款清单按场景维度归组（考务/教学/会议活动/婚庆/儿童/生活办公…），对照用户提出的行业维度（医疗/政务/零售/餐饮等）找缺口，产出建议新增模板清单（场景+建议尺寸+字段）。

## 产出
- test-report.md 第 309 轮置顶：P1/P2/P3 分级清单 + 覆盖矩阵 + 缺口建议；关键截图；全程录屏；P1 立即上报。
