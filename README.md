# Seat - 考场座位标签生成器

本仓库包含两代实现：

| 目录 | 说明 | 状态 |
|---|---|---|
| `web/` | **SeatMark 座签**：Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS 4 的产品化重构版 | ✅ 当前主线 |
| `seat-label-generator/` | 初版：单 HTML + CDN 脚本（Vue 全局构建、Fabric.js、jsPDF） | 仅作历史参考 |

## 快速开始（新版）

```bash
cd web
npm install
npm run dev
```

构建与部署见 `web/README.md`。

## 重构要点

- 模块化：920 行单文件 `app.js` 拆分为类型层 / 工具层 / 状态层 / 组件层，全量 TypeScript 严格模式。
- 渲染统一：预览、缩略图、设计器、导出、打印共用同一 `LabelCard` 渲染源，杜绝偏差。
- 替换死代码：原 Fabric.js 模板编辑器（画布元素已不存在、实际不可用）重写为基于 Pointer Events 的可视化设计器，支持拖拽、八向缩放、键盘微调、毫米级吸附。
- 产品化：独立落地页（SEO 元信息）、演示数据一键体验、数据质量体检、排版溢出检测、自定义模板自动迁移旧版 localStorage 数据。
- 工程化：依赖按需加载（xlsx / jsPDF 仅在使用时下载）、构建产物纯静态、可部署任意静态托管。
