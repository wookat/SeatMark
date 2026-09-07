# 第 306 轮：PR #314 底边细线签名水印视觉复测（生产）+ UI 小改走查

代码依据：`app/src/components/label/LabelCard.vue` L131/139（watermark prop，带水印导出/打印时开启）、L166-231（细线签名布局：字号 = min(max(min(w,h*2.4)*0.032,2),3.2)mm；底边 band 被字段占用退顶边，双占仍贴底边）、L378-388（DOM = rule span + text + rule span，无 svg logo）；`app/src/assets/main.css` L277-308（.label-watermark letter-spacing .14em 透明度 0.5、--light 反色、__rule 0.12mm/min1px background:currentColor）；`app/src/components/studio/PreviewArea.vue` L157-158（hostWatermark：带水印导出且非纯黑白 PNG）。部署确认：生产 CSS `index-6XEkK5P2.css` 含 `label-watermark__rule`（22:09）。

环境：生产 https://www.seatmark.cn ，全程未登录（匿名带水印导出不限次）。模板：standard 标准考场版（浅色 60×32）、navyConfCard 深蓝会议桌牌（深色 180×90 全称）、drinkCup 饮品杯贴（36×24 小标签短域名）。旧版对比：本地 checkout f5b8103（#314 前一提交）起 vite 截同模板旧徽章水印图（测后回滚）。

## A1 浅色 standard：PNG + PDF 带水印导出
- /studio 载入演示数据，选 standard，图片 PNG →「带水印导出」；解包 zip 检查单枚 PNG 底部。
- PASS：底边呈「细线—文字—细线」横贯样式；文字含 seatmark 字样、极小字距；无旧徽章方格 Logo 图形；细线在位图中可见未丢失（放大裁底部条带，线像素存在）。若线消失=FAIL（P1）。
- 同模板「图片版 PDF · 带水印导出」→ pdftoppm 首页，底部同样呈细线签名式 — PASS/FAIL 同上。

## A2 深色 navyConfCard：反色可见
- 选 navyConfCard（模板库搜「深蓝」或 event 分类），带水印 PNG 导出。
- PASS：深蓝底上水印为浅色（白系半透明）细线+文字，肉眼可辨；大标签（180mm）应显示全称「SeatMark 座签 · seatmark.cn」。文字不可见或仍深灰=FAIL。

## A3 小标签 drinkCup：短域名
- 选 drinkCup（36mm 宽），带水印 PNG 导出。
- PASS：水印文字为短版「seatmark.cn」（宽度不足放不下全称），字号≈2mm 下限仍可辨；细线存在。

## A4 底边被字段占用：退顶边
- /studio 新建模板设计器：造一个字段贴近底边（如 y 接近 height-字段高）的自定义标签，开水印预览（或带水印导出）。
- PASS：水印条带出现在顶边（style top≈inset 小值）而非底边、不遮字段；预览截图可见顶边细线。仍压住底部字段=FAIL。

## A5 打印通道抽 1 例
- standard 带水印「打印 / 矢量 PDF」：stub window.print 后点打印按钮，在宿主挂载窗口 Page.printToPDF 抓首页。
- PASS：打印输出底边同样呈细线签名水印。

## A6 新旧对比
- 本地 f5b8103 起 vite，同模板（standard）带水印导出/截图旧版徽章 Logo 水印，与生产新版并排留存。测后 git 回滚、停 vite。

## B UI 小改走查（不改代码）
- 生产 1280 与 390（设备模式）双宽度走查 / 、/studio、/templates、/pricing、/account 五页，截图并列出 5–10 个具体微调点（间距/对齐/层次/细节），P2/P3 标注。判据：每条给出页面+元素+现象+建议，不做主观空评。

## 健康与收尾
- 全程 pageerror=0；导出文件落 ~/Downloads 核对；结束清浏览器状态；报告置顶 test-report.md 第 306 轮；skill 增量（水印验证方法）。
