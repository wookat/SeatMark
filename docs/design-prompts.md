# SeatMark 设计站与 AI 设计提示词清单（2026-08）

## 一、设计灵感站（按用途分类）

### 1. 综合 UI/网页设计参考（视觉语言升级用）
| 站点 | 地址 | 用途 |
|---|---|---|
| Mobbin | https://mobbin.com | 60万+ 真实产品截图与用户流，查「onboarding / 导出弹窗 / 配额提示」等交互模式 |
| Awwwards | https://www.awwwards.com | 高端网页视觉与动效标杆，首页/落地页参考 |
| Muzli | https://muz.li | 每日设计聚合（Dribbble/Behance/Awwwards 一站看） |
| Dribbble | https://dribbble.com | 搜 "place card" "name tag" "label design" 找桌牌/标签视觉方案 |
| Behance | https://www.behance.net | 完整品牌/印刷项目案例，含桌牌席卡物料系统 |
| Land-book / Godly | https://land-book.com · https://godly.website | 落地页排版与转化区块参考 |
| UXMaps | https://uxmaps.co | 4万+ 大厂网页设计示例，按行业/流程筛选 |

### 2. 国内设计站（更贴中国市场审美）
| 站点 | 地址 | 用途 |
|---|---|---|
| 站酷 ZCOOL | https://www.zcool.com.cn | 搜「桌牌」「席位卡」「台签」「胸牌」，大量国内印刷物料实例 |
| 花瓣网 | https://huaban.com | 采集画板做灵感库；搜「婚礼席卡」「年会桌牌」「考场标签」 |
| UI 中国 | https://www.ui.cn · 灵感库 https://idea.ui.cn | 国内 UI/UX 作品与经验文章 |
| 优设网灵感频道 | https://www.uisdc.com/inspiration | 设计趋势解读 + 520 个设计网站导航 |

### 3. 印刷/桌牌垂直参考（模板库直接对标）
- placecard.net（座位卡/桌牌模板站，3.5"×4" 对折桌牌规范，风格标签体系值得抄：elegant/floral/minimal/gold/boho…）
- Canva 席卡类目、稻壳/稿定的桌牌专题页（既有竞品，继续对标风格覆盖面）
- Zazzle / Minted place cards（海外高端婚礼席卡审美）

### 4. 配色与字体
- Coolors / Color Hunt（配色板）；中国色 https://colors.ico.bid（国风色谱，适合政务/婚宴模板）
- Google Fonts + 思源黑体/宋体、阿里巴巴普惠体、OPPO Sans（可商用中文字体）

## 二、AI 设计提示词

### 1. 提示词库站
- Superdesign 提示词库 https://superdesign.dev/blog/ui-design-prompts —— 「强默认 + 3-6 条硬约束 + 增量迭代」方法论，v0/Lovable/Cursor 各有方言
- God of Prompt（UI/图标 70 条）https://godofprompt.ai/prompt-library/category/icon-and-ui-design
- wireframes.online（Midjourney UI 提示词生成器，可选 Tailwind/Shadcn 框架风格）

### 2. 通用 UI 提示词骨架（v0/Lovable/Claude 用）
```
[一句强默认] 一个面向中国用户的在线桌牌/席卡批量制作工具的{页面}，现代 SaaS 风格，简体中文。
[硬约束]
- 技术：Vue3 + Tailwind CSS 4，组件圆角 12px，主色 {#hex}
- 版式：{具体区块清单，如 Hero + 三步流程 + 模板橱窗 + 信任点}
- 信任点必须体现「名单不上传服务器，浏览器本地生成」
- 移动端 390px 优先，禁止 emoji 图标，用线性 SVG 图标
- 避免：{赛博渐变紫 / 过度玻璃拟态}
```

### 3. 模板视觉提示词骨架（Midjourney/即梦/堆友 生成装饰底纹参考）
```
{场景} place card / table tent design, {风格词}, {配色}, printable A4 layout,
clean typography with large Chinese name area, subtle {装饰元素} border,
flat vector style, high resolution, white background --ar 18:7 --style raw
```
风格词库（对应我们六大分类）：
- 婚宴：elegant floral, gold foil accent, blush pink, botanical line art, watercolor
- 年会：festive red & gold, ribbon, star burst, corporate premium
- 会议政务：minimal navy, authoritative serif, thin gold rule, guilloché pattern
- 考场教学：clean institutional, high-contrast, utilitarian grid
- 电竞/科技：neon gradient cyan-purple, diagonal slash, dark slate
- 幼儿园：soft pastel, rounded shapes, playful hand-drawn animals

### 4. 提示词使用要点（Superdesign 方法论提炼）
1. 先给一句「像给资深设计师下 brief」的强默认，再层层加硬约束。
2. 迭代只发增量 delta（改哪一条约束），不要整段重写。
3. 附上下文块：目标用户、平台、既有设计规范、禁用项。
4. 生成后用「审查提示词」让 AI 自查对齐/对比度/间距一致性。

## 三、落地建议（如无异议按此执行）
1. 用花瓣建「SeatMark 灵感库」画板（婚宴/年会/政务/考场/电竞五板），持续采集。
2. 把上面第 2/3 节骨架沉淀进仓库 docs/design-prompts.md，后续模板扩充轮直接复用。
3. 下一模板扩充轮先用 Midjourney 风格词生成 3 组底纹参考图，再转成 SVG 装饰入库。
