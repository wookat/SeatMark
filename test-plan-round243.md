# 第 243 轮：WebKit/Safari 跨引擎专项回归（生产，无代码变更）

环境：Playwright webkit-1967 headless（WPE WebKit 2.43.1，UA Safari/605.1.15）——host 校验对 bundled libjxl 误报，需 `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` 启动；生产 bundle `index-B7iIsDpm.js`（与 r242 相同，无部署变化）。夹具：r240 `ff240.xlsx`（40 行含 𱁬田240/维文 RTL/张伟240）、r231 `eink234.xlsx`（3 行）、r242 `long242.xlsx`（60 字超长名）。判据沿用 r240/r242：toast（MutationObserver）+ page.on('download')+save_as 落盘 + PIL/zipfile/pypdfium2 产物核验；页头常驻 CTA「正在制作中」不作判据；文件名秒级；标准模板测试用全新 context（/studio localStorage 记忆模板坑）。

## T1 核心链路冒烟
- 首页 title 含 SeatMark、/templates 模板卡片 ≥5、40 行导入 toast「Excel 导入成功 已读取 40 条数据」+ 映射面板齐全，截图留档。

## T2 标准模板导出三链路（全新 context，toast 文案须为标准模板口径非「精确 800×480」）
- 整页 PNG：成功 toast、zip 2 页 2481×3509、非空白 >0.5%。
- 逐张 PNG：zip 40 张 1000×534、抽 3 张 md5 互异非空白。
- 图片版 PDF：toast「图片版 PDF 已生成」、落盘、pypdfium2 p1 非空白 >0.5%。

## T3 eink 精确像素（重点：r241/#244 截断判据在 WebKit scrollHeight 口径首验）
- `/studio?template=eink800` + 3 行夹具逐标签 800×480：成功 toast、3 张恰 800×480、恰 2 色、无 pHYs、md5 互异（若出现「页面渲染不完整」失败 toast = 类似 Firefox 的引擎级问题 → P2 即时上报）。
- 40 行逐标签 800×480 + 4096 自定义（≤120s、40 张 4096×2458）。
- 整页 800×480：恰 800×480、纯二值、无 pHYs。
- 误截观察：eink 3 行夹具单行姓名（张伟234）产物与 Chromium 基线（r242 CR 产物）墨量比对——若 WebKit 出现异常省略号（单行名被截）为误截回归。

## T4 字体（𱁬 + 维文 RTL）
- 标准逐张 zip 中 𱁬田240/维文/张伟240 三张与 r242 Chromium 同素材产物列分段（blob）+ 墨量比对：无缺字/tofu/顶部平切，允许引擎差异；蒙太奇留档人工终判。

## T5 超长姓名真溢出
- 全新 context + long242.xlsx 逐张导出：成功 toast，导出宿主 `.label-field__content` 轮询捕获含「…」文本；产物姓名区单一文本带无叠压。

## T6 隐私与收尾
- 全程请求监听：𱁬田240/维文串/张伟240/超*10/张伟242/eink234 命中 0；pageerror=0；清 storage、关全部 context；写 test-report.md 第 243 轮章节（不提交）。
