# SeatMark 座签 · 品牌视觉规范

> 本规范与 `app/DESIGN.md` 的 UI 设计规范衔接：DESIGN.md 管产品界面，本文件管品牌标识与对外物料。
> **正式 Logo：方案 A「座位格」（`logos/a-seatgrid-*`），已拍板采用并全站落地**（favicon / Header / Footer / PWA 图标 / OG 分享图）。
> 方案 B–F 为历史备选，仅作归档保留（见 `preview/logo-comparison.png`），不再用于任何新物料。

## 1. 品牌个性关键词

| 关键词 | 含义 | 在设计中的体现 |
|---|---|---|
| 精确 | 毫米级排版、打印可信 | 几何图形、直角网格、裁切线元素 |
| 高效 | 上传即得、批量生成 | 克制的单色、任务导向的排版 |
| 可靠 | 数据本地处理、隐私优先 | 中性灰阶为主、不做浮夸装饰 |
| 亲和 | 面向教师/考务/行政人员 | 圆角柔化、清晰的中文优先表达 |

## 2. 色板

与 DESIGN.md「单一品牌主色」体系一致，不新增第二强调色。

| 角色 | 色值 | 用途 |
|---|---|---|
| 品牌主色 Brand 600 | `#4f46e5` | Logo 图形、主按钮、链接、强调 |
| Brand 700 | `#4338ca` | 主色 hover / 深色场景 |
| Brand 100 | `#e0e7ff` | 浅色底、标签底 |
| Brand 50 | `#eef2ff` | 大面积浅底（Hero / 物料底色） |
| 墨色 Ink | `#0f172a` (slate-900) | 标题文字、暗底 |
| 正文灰 | `#475569` (slate-600) | 正文 |
| 辅助灰 | `#94a3b8` (slate-400) | 次要信息 |
| 边框灰 | `#e2e8f0` (slate-200) | 分隔、描边 |
| 纸白 | `#ffffff` / `#f8fafc` | 底色 |

语义色沿用 DESIGN.md：成功 emerald / 警告 amber / 危险 red，仅用于状态反馈。

## 3. 字体

- 中文：系统字体优先 `PingFang SC / Microsoft YaHei / Noto Sans CJK SC`；物料标题可用思源黑体 Bold。
- 西文/数字：`Inter / SF Pro / Segoe UI / system-ui`。
- 字标「座签」用 700 字重；"SeatMark" 用 600 字重、字距 +0.05em。
- 不使用书法体、艺术字与多字体混排。

## 4. Logo 使用规则

### 结构
- 图形标（mark）：64×64 视区的「座位格」——2×2 圆角格，右下一格实心并带白点，表达「在座位表中定位到你的座位」。
- 组合标（lockup）：图形标 + 中文「座签」+ 英文 "SeatMark" 左右排布（`logos/a-seatgrid-lockup-light.svg`）。

### 安全区与最小尺寸
- 安全区：Logo 四周留白 ≥ 图形标高度的 1/4（16px@64px），区内不得出现其他图形或文字。
- 最小尺寸：图形标单独使用 ≥ 16px（favicon 可用）；组合标 ≥ 96px 宽，小于该宽度时只用图形标。

### 配色变体
- 彩色版：图形 `#4f46e5`，用于白/浅灰底。
- 暗底版：图形保持 `#4f46e5` 或白色单色版，文字反白，用于 `#0f172a` 等深底。
- 单色版：墨色 `#0f172a`（亮底）或纯白（暗底），用于单色印刷、水印。

### 禁用示例
- 禁止拉伸、旋转、加投影、加描边、加渐变。
- 禁止改变图形与字标的相对位置或比例。
- 禁止在低对比底色（如中灰、照片）上直接使用彩色版而不加底板。
- 禁止用 emoji 或其他图标替代图形标。

## 5. 应用示例

| 物料 | 文件 | 尺寸 |
|---|---|---|
| 社交头像 | `materials/avatar.svg/.png` | 512×512 |
| 微信公众号封面 | `materials/wechat-cover.svg/.png` | 900×383 |
| 小红书封面 | `materials/xhs-cover.svg/.png` | 1242×1660 |
| OG 分享图 | `materials/og-image.svg/.png` | 1200×630 |
| 名片（正/反） | `materials/business-card.svg/.png` | 90×54mm（1063×638px @300dpi 按比例） |

第二轮物料（`assets/`，SVG+PNG 成对）：

| 物料 | 文件 | 尺寸 |
|---|---|---|
| 头像·微信公众号 | `assets/avatar-wechat-mp-500.*` | 500×500 |
| 头像·知乎 | `assets/avatar-zhihu-400.*` | 400×400 |
| 头像·小红书 | `assets/avatar-xiaohongshu-1080.*` | 1080×1080 |
| 头像·抖音 | `assets/avatar-douyin-1080.*` | 1080×1080 |
| 封面模板 1「浅底网格」 | `assets/cover-1-grid-zhihu-1200x675.*` / `assets/cover-1-grid-xhs-1242x1660.*` | 1200×675 / 1242×1660 |
| 封面模板 2「暗底数据」 | `assets/cover-2-dark-zhihu-1200x675.*` / `assets/cover-2-dark-xhs-1242x1660.*` | 1200×675 / 1242×1660 |
| 封面模板 3「纸张场景」 | `assets/cover-3-paper-zhihu-1200x675.*` / `assets/cover-3-paper-xhs-1242x1660.*` | 1200×675 / 1242×1660 |
| 微信分享卡片 | `assets/wechat-share-card-500x400.*` | 500×400 |
| PPT 模板封面 | `assets/ppt-cover-1280x720.*` | 1280×720 |

物料统一原则：浅底用 `#eef2ff`→白 的单色浅底或纯白；暗底用 `#0f172a`；主色仅一处强调；文案遵循 DESIGN.md 禁用词表。

## 6. 目录结构

```
brand/
├── BRAND.md               # 本规范
├── logos/                 # 6 方案 × (mark / mark-mono / lockup-light / lockup-dark)；a-* 为正式版，b–f 为归档备选
├── materials/             # 物料模板 SVG + PNG
├── assets/                # 第二轮物料：头像方阵 / 封面模板×3 / 微信分享卡 / PPT 封面
├── prototypes/            # UI/UX 原型（单文件 HTML）+ 各屏 PNG
├── preview/               # Logo 对比预览
└── scripts/               # generate.mjs（Logo）/ materials.mjs（物料）/ assets.mjs + export-assets.sh（第二轮物料）
```
