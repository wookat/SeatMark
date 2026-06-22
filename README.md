# SeatMark - 考场座位标签在线生成

面向考务场景的座位标签生成产品：上传 Excel 名单，批量生成排版精确到毫米的标签打印页，支持照片核验、可视化模板设计、PDF 导出与浏览器打印。**所有数据仅在浏览器本地处理，不经过服务器。**

## 项目结构

```
Seat/
├── app/                 # SeatMark 前端应用（Vue 3 + TypeScript + Vite）
├── edge-functions/      # EdgeOne Pages Edge Function（AI 设计同源代理）
└── .github/workflows/   # GitHub Pages 自动部署
```

## 快速开始

```bash
cd app
npm install
npm run dev
```

构建与部署详见 `app/README.md`。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Vue 3.5 + TypeScript（严格模式） |
| 构建 | Vite 7 |
| 状态 | Pinia 3 |
| 路由 | Vue Router 4 |
| 样式 | Tailwind CSS 4 |
| Excel | SheetJS（xlsx，动态导入） |
| PDF | jsPDF 4 + html2canvas-pro 2 |

## 核心特性

- **单一渲染源**：`LabelCard` 是唯一的标签渲染实现，预览、缩略图、设计器、导出、打印全部复用
- **毫米单位贯穿**：模板数据与 CSS 均使用 mm 物理单位，保证打印精度
- **多纸张规格**：A4 / A5 / A3 横竖向，自动按标签尺寸重算每页行列数并居中
- **可视化设计器**：基于 Pointer Events 的拖拽式模板设计，支持八向缩放、键盘微调、毫米级吸附
- **隐私优先**：默认零网络请求，可完全离线运行；仅在线开源字体按需从 CDN 拉取
- **AI 设计辅助**：可选接入大模型（如智谱 glm-4-flash），通过 Edge Function 同源代理免配置使用
