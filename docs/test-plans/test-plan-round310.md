# 第 310 轮：PR #317 生产复测（双语英文名修复 + 3 款新模板 + 225 计数）

前置（已完成）：main=f1ba201；新 bundle `index-CLPzfp2I.js` 已上线（旧 `index-BDLw0dx-.js`）；rev 头仍 r304；浏览器硬刷新绕过 SW 缓存。

## T1 双语英文名修复（修第309轮 P2）
- /studio?template=tentBilingual 预览：前 3 卡英文名各不相同且与中文名拼音对应（demoDatasets EN_NAMES 逐行：张伟→ZHANG Wei、王芳→WANG Fang、李娜→LI Na）。FAIL 判据：任意两卡同为 CHEN Jiaming 或与中文名不对应。
- UI 带水印导出逐张 PNG，解包抽 2-3 张放大：英文名逐卡不同、字形完整、水印细线存活。

## T2 三款新模板
- /templates 搜索「生鲜价签」「预订席位卡」「输液座位签」各命中 1 款，缩略图无溢出/错位（截图证明）。
- /templates/freshPrice、/templates/dinerReserve、/templates/infusionSeat 详情页可打开、标题/尺寸/描述与源码一致（60×36 / 90×55 / 70×40）。
- 各自 /studio 预览：逐卡字段随演示数据变化（品名/单价、宾客/时间、姓名/座位号/过敏史逐卡不同，无固定回退值），水印/布局正常。
- 每款抽 1 种带水印导出（PNG）并放大检查字形/裁切线/水印细线。FAIL 判据：字段全卡相同、溢出、丢线。

## T3 计数 225
- 首页「内置专业模板」统计与文案显示 225（旧为 222）；/studio 左栏「浏览全部 225 款模板」；/templates 分类「全部 225」。

## T4 回归：医院数据集新列不破坏 wardBed
- /studio?template=wardBed 预览：床号逐卡正确映射（01、02…不为空/不错位）。

硬判据：pageerror=0；以上页面无横向溢出异常。产出：录屏、报告第 310 轮置顶。
