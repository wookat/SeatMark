<p align="center">
  <img src="brand/logos/a-seatgrid-lockup-light.svg" alt="SeatMark 座签 Logo" width="240" />
</p>

# SeatMark 座签 — 考场座位标签在线批量生成

<p>
  <a href="https://www.seatmark.cn"><img alt="Website" src="https://img.shields.io/website?url=https%3A%2F%2Fwww.seatmark.cn&label=seatmark.cn" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Proprietary%20(source--available)-blue" /></a>
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white" />
</p>

**官网：[https://www.seatmark.cn](https://www.seatmark.cn)** — 打开即用，无需注册安装。

面向考务、教学与会议场景的标签批量生成工具：上传 Excel 名单，批量生成排版精确到毫米的座签、桌牌席卡、门贴证卡打印页，支持照片核验、可视化模板设计、PDF 导出与浏览器打印。**所有数据仅在浏览器本地处理，不经过服务器，可完全离线使用。**

## 功能特性

| 特性 | 说明 |
|---|---|
| Excel 批量导入 | 上传名单自动解析，表头智能映射，支持排序与逐列筛选 |
| 150+ 款内置模板 | 座签 / 桌牌 / 席卡 / 门贴 / 证卡 / 医疗 / 政务 / 餐饮 / 仓储等场景，二级分类筛选 |
| 毫米级排版 | 模板与 CSS 均使用 mm 物理单位，所见即所得的打印精度 |
| 多纸张规格 | A4 / A5 / A3 横竖向，自动重算每页行列数并居中 |
| 照片核验 | 批量照片按文件名匹配到名单，适合准考核验场景 |
| 可视化设计器 | 拖拽式模板设计，八向缩放、键盘微调、毫米级吸附 |
| PDF 导出与打印 | 图片型 PDF 直接下载；矢量 PDF 经浏览器打印输出 |
| 隐私优先 | 名单与照片全程浏览器本地处理，零上传，可离线运行 |
| AI 设计辅助（可选） | 通过 Edge Function 同源代理接入大模型，免配置使用 |
| 零后端模板分享 | 模板压缩编码进链接 hash，打开即导入 |

## 快速开始

```bash
cd app
npm install
npm run dev       # 开发服务器 http://localhost:5173
npm run test      # 单元测试（Vitest）
npm run build     # vue-tsc 严格类型检查 + 构建 + 预渲染
```

## 目录结构

```
SeatMark/
├── app/                 # 前端应用（Vue 3 + TypeScript + Vite），详见 app/README.md
├── edge-functions/      # 腾讯 EdgeOne Pages Edge Function（AI 设计 / 反馈同源代理）
├── edgeone.json         # EdgeOne Pages 构建配置
└── .github/workflows/   # GitHub Pages 自动部署（备用预览环境）
```

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Vue 3.5 + TypeScript（严格模式） |
| 构建 | Vite 7（构建期预渲染全部内容路由） |
| 状态 | Pinia 3 |
| 路由 | Vue Router 4 |
| 样式 | Tailwind CSS 4 |
| Excel | SheetJS（xlsx，动态导入） |
| PDF | jsPDF 4 + html2canvas-pro 2 |
| 测试 | Vitest + @vue/test-utils |

## 核心架构

- **单一渲染源**：`LabelCard` 是唯一的标签渲染实现，预览、缩略图、设计器、导出、打印全部复用
- **毫米单位贯穿**：模板数据与 CSS 均使用 mm 物理单位，保证打印精度
- **纯静态部署**：无后端、无数据库，「数据不出浏览器」是产品承诺
- **构建期预渲染**：每个内容路由输出独立静态 HTML（SEO / AI 爬虫友好），sitemap 构建时自动生成

更多实现细节见 [`app/README.md`](app/README.md) 与 [`app/DESIGN.md`](app/DESIGN.md)。

## 部署（腾讯 EdgeOne Pages）

站点部署于 [腾讯 EdgeOne Pages](https://edgeone.cloud.tencent.com/pages)（纯静态托管），根目录 `edgeone.json` 定义构建：

```json
{
  "buildCommand": "cd app && npm run build",
  "installCommand": "cd app && npm install",
  "outputDirectory": "app/dist"
}
```

`edge-functions/api/` 下的 Edge Function 提供 AI 设计与反馈的同源代理，密钥通过 EdgeOne 控制台环境变量配置（`DEEPSEEK_API_KEY`、`AI_API_KEY` 等），不出现在前端代码中。

## 贡献

欢迎 Issue 与 Pull Request，请先阅读 [贡献指南](CONTRIBUTING.md) 与 [行为准则](CODE_OF_CONDUCT.md)。安全问题请按 [安全政策](SECURITY.md) 私下报告。

## 许可证

本项目采用专有许可证（source-available）：允许查阅、本地构建与贡献，未经书面许可不得商用或公开部署。详见 [LICENSE](LICENSE)。

用户协议与隐私政策见官网 [/terms](https://www.seatmark.cn/terms) 与 [/privacy](https://www.seatmark.cn/privacy)。
