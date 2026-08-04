# SeatMark 座签 - 考场座位标签在线生成

面向考务场景的座位标签生成产品：上传 Excel 名单，批量生成排版精确到毫米的标签打印页（A4 / A5 / A3 横竖向），支持照片核验、可视化模板设计、中英文开源字体、PDF 导出与浏览器打印。**所有数据仅在浏览器本地处理，不经过服务器。**

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Vue 3.5 + TypeScript（严格模式） | Composition API + `<script setup>` |
| 构建 | Vite 7 | 按需代码分割，xlsx / pdf 依赖懒加载 |
| 状态 | Pinia 3 | `workspace`（工作区）/ `templateLibrary`（模板库）/ `toast` |
| 路由 | Vue Router 4 | `/` 落地页、`/studio` 工坊、`/templates` 模板库、`/guides` 教程、`/pricing` 定价、`/terms` `/privacy` 法务页 |
| 样式 | Tailwind CSS 4 | 设计令牌 + mm 物理单位打印样式 |
| Excel | SheetJS（xlsx 0.20.3 官方源） | 动态导入 |
| PDF | jsPDF 4 + html2canvas-pro 2 | 图片型 PDF 直接下载；矢量 PDF 经浏览器打印「另存为 PDF」输出 |

## 开发与部署

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器
npm run test     # 单元测试（Vitest + @vue/test-utils）
npm run build    # 类型检查 + 产物构建（输出 dist/）
npm run preview  # 本地预览构建产物
```

`dist/` 为纯静态产物，可直接部署到 Vercel / Netlify / Cloudflare Pages / 任意静态服务器或对象存储 + CDN。部署到子路径时在 `vite.config.ts` 中设置 `base`。

## 目录结构

```
src/
├── types/template.ts        # 模板 / 字段 / 页面规格类型（单位 mm）
├── data/
│   ├── defaultTemplates.ts  # 内置模板（61 款：座签 / 桌牌 / 席卡 / 门贴 / 证卡等场景，支持分类筛选）
│   └── fonts.ts             # 字体目录（系统本地 + 在线开源；中英文栈合并）
├── utils/
│   ├── layout.ts            # mm 几何计算：标签定位、裁切线、溢出检测、居中
│   ├── paper.ts             # 纸张规格（A3/A4/A5 横竖向）与打印 @page 注入
│   ├── excel.ts             # Excel 解析 / 示例下载 / 演示数据
│   ├── autoMap.ts           # 表头智能映射（避免多字段抢同一列）
│   ├── photos.ts            # 照片批量读取与文件名匹配
│   ├── share.ts             # 模板分享链接（deflate 压缩 + base64url 编码进 URL hash）
│   └── pdfExport.ts         # 按模板纸张分页栅格化导出 PDF
├── stores/
│   ├── workspace.ts         # 核心工作区：模板副本、数据、映射、照片、预览状态
│   ├── templateLibrary.ts   # 自定义模板持久化（兼容旧版 localStorage 键自动迁移）
│   ├── fonts.ts             # 在线字体按需加载（多源回退 + FontFace 探测）
│   └── toast.ts             # 全局通知
├── components/
│   ├── label/               # LabelCard（单枚标签）、LabelSheet（整页）、TemplateThumb
│   ├── studio/              # 模板选择、数据导入、字段映射、页面与版式、字体选择、预览导出
│   ├── designer/            # 可视化模板设计器（拖拽吸附对齐线 / 八向缩放 / 键盘微调 / 预设字段库）
│   └── ui/                  # 头尾、通知、加载遮罩、对话框
└── views/                   # 落地页 / 工坊 / 模板库 / 教程 / 定价 / 用户协议 / 隐私政策
```

## 核心设计

- **单一渲染源**：`LabelCard` 是唯一的标签渲染实现，屏幕预览、缩略图、设计器、PDF 导出、打印全部复用，保证所见即所得。
- **毫米单位贯穿**：模板数据与 CSS 均使用 mm 物理单位，屏幕缩放仅通过 `transform: scale` 完成，不破坏打印精度。
- **多纸张规格**：模板内记录纸张尺寸（A4 / A5 / A3 横竖向），预览、PDF 导出与打印 `@page` 全部跟随模板动态调整；切换纸张时自动按标签尺寸重算每页行列数并居中边距（`fitToPaper`）。
- **导出 / 打印宿主**：导出时临时在 `<body>` 下挂载离屏页面（Teleport），打印时通过 `@media print` 隐藏应用壳、仅输出该宿主，避免受应用布局与缩放影响；最后一页不再强制分页，杜绝末尾空白页。
- **两种 PDF 路径**：「打印 / 矢量 PDF」走浏览器打印引擎，内嵌系统字体子集、文字可选中、体积小；「导出图片 PDF」逐页 288dpi 栅格合成，跨阅读器兼容性最好。网页脚本读取不到宋体等系统字体文件，因此纯前端无法直接生成中文矢量 PDF，矢量输出统一经打印对话框完成。
- **隐私优先**：默认零网络请求（数据、界面字体均本地），可完全离线运行；仅当用户主动选择在线开源字体时才从公共 CDN 拉取字体文件（多镜像回退），不涉及任何用户数据上传。
- **中英文字体分离**：模板与字段均可分别配置中文与西文字体，西文栈置前仅覆盖英文/数字字形，中文字体兜底汉字；标签默认宋体（系统本地渲染），另备黑体/楷体/仿宋等系统字体与多款在线开源字体。
- **Excel 式数据视图**：「全部数据」表格支持点击列头排序（数值感知 + 中文拼音序）与逐列勾选筛选（Excel 自动筛选风格），预览、导出与打印严格按筛选排序后的顺序排版，可一键恢复导入原序。
- **字段三种内容来源**：文本字段支持「Excel 数据列 / 固定文本」，图片字段支持「按列匹配照片 / 固定图片（Logo）」，外加可选的填充背景色，可在设计器中自由组合出桌贴、桌牌、胸卡等各类标签。
- **标签名前缀（caption）**：文本字段可设置标签名（如「姓名」），纸面渲染为「姓名 张三」式的小字标题 + 内容；设计器「+ 添加字段」提供带标签名的预设，内置「标签名版」模板开箱即用。
- **零后端模板分享**：模板 JSON 经 `CompressionStream`（deflate-raw）压缩 + base64url 编码进链接 hash，对方打开 `/studio#tpl=…` 即弹窗确认导入；含 Logo 等超长模板自动提示改用 JSON 文件分享。
