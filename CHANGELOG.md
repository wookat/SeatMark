# 更新日志

本项目的所有重要变更都记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- 仓库治理：LICENSE（专有许可证）、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、
  Issue/PR 模板、CHANGELOG
- 站点法务页：`/terms` 用户协议、`/privacy` 隐私政策（纳入预渲染与 sitemap，
  页脚接入链接）

## [1.1.0] - 2026-08-04

### 新增

- 模板库扩充至 33 款：新增 14 款场景模板（会议桌牌、婚礼席位卡、面试号牌、
  培训桌牌、讲座嘉宾、图书标签、寝室门牌、班级门牌、活动胸卡、家长会、
  多科目考试、体育检录、幼儿姓名贴、办公桌牌等），支持场景分类筛选（#1）
- SEO 基建：构建期预渲染（每个路由输出静态 HTML）、按路由 title/description/
  canonical/OG/JSON-LD、sitemap 构建时自动生成、robots.txt、llms.txt（#3）
- 内容营销页：`/guides` 教程中心（8 篇实战教程）、`/templates` 模板库详情页、
  `/pricing` 定价页（Beta 期间限时免费）（#3）

### 变更

- 全站视觉语言升级：设计令牌层，落地页 / 工坊 / 页眉页脚 UI 重塑（#2）
- 全站「去 AI 味」设计精修：对齐大厂设计规范，统一设计令牌与文案，
  新增 `app/DESIGN.md` 设计规范文档（#4）
- 高级动效专项：Hero 装配叙事、滚动绘制/数字计数、微交互与工坊过渡（#5）

## [1.0.0] - 2026-08-03

### 新增

- 首个公开版本：上传 Excel 名单批量生成毫米级精确排版的标签打印页
- 15 款内置模板（座签 / 桌牌 / 席卡 / 门贴 / 证卡）
- A4 / A5 / A3 横竖向纸张规格，自动重算行列并居中
- 可视化模板设计器：拖拽、八向缩放、键盘微调、毫米级吸附
- 照片核验：批量照片读取与文件名匹配
- PDF 导出（jsPDF + html2canvas-pro）与浏览器打印
- 隐私优先：所有数据仅在浏览器本地处理，可完全离线运行
- 可选 AI 设计辅助（EdgeOne Pages Edge Function 同源代理）

[Unreleased]: https://github.com/wookat/SeatMark/compare/main...HEAD
[1.1.0]: https://github.com/wookat/SeatMark/pulls?q=is%3Apr+is%3Amerged
[1.0.0]: https://github.com/wookat/SeatMark/commits/main
