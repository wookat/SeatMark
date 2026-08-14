# SeatMark 英文版（/en）i18n 技术方案

日期：2026-08-14 ｜ 状态：本轮落地（架构 PR + 着陆页 PR 分批）

## 1. 目标与约束

- 海外用户（wedding seating chart / place card / name tag / conference tent card 需求）可用英文完整使用产品。
- **中文站现有行为与视觉零改动**：默认路由仍是中文，英文只通过 `/en` 前缀进入。
- 主包 gzip 预算敏感：不引入大依赖；英文文案不得增加中文用户的下载量。
- 复用现有 prerender/SEO 体系（`app/scripts/prerender.mjs` + `src/data/seo.ts`）。

## 2. i18n 库选型

| 方案 | 运行时体积（gzip） | 迁移成本 | 结论 |
| --- | --- | --- | --- |
| vue-i18n v11（完整） | ~15 kB | 全站字符串需抽 key，中英双份维护 | 否 |
| petite-vue-i18n | ~7 kB | 同上，仍需全量抽 key | 否 |
| **自研 gettext 风格字典（本方案）** | **< 1 kB 运行时** | 中文串保持内联为源文案，只需包一层 `t('中文')` | ✅ |

选择自研的关键理由（不是「造轮子偏好」，是量化结论）：

1. 全站约 15k 行 Vue 中文文案全部内联。vue-i18n 要求把中文抽成 key + zh 字典 + en 字典三处维护，diff 巨大且中文站回归风险高，违反「中文站零改动」约束。
2. gettext 风格（**中文原文即 key**）：`t('上传名单')` → 英文字典命中返回英文，未命中回退中文原文——英文覆盖可以分批推进而不会出现 key 裸奔。
3. 英文字典独立 chunk **按需懒加载**：仅 `/en` 路由进入前 `await import('./locales/en')`，中文用户主包体积零增加。
4. 无插值/复数等复杂需求时自研 t() 十几行即可；将来若需要 ICU 复数，再评估 petite-vue-i18n 也不迟（字典可机械迁移）。

## 3. 路由策略：/en 前缀

- `src/router/index.ts` 用同一份 `routes` 数组镜像生成 `/en/...` 路由（`name: 'en-<name>'`，`meta.locale = 'en'`），组件复用，无重复代码。
- 全局 `beforeEach`：根据目标路由前缀解析 locale → 懒加载英文字典（仅首次）→ 设置 `document.documentElement.lang`（`en` / `zh-CN`）。
- 语言切换器（Header）：在同一路径的 zh/en 版本之间跳转；选择写入 `localStorage['seatmark.locale']` 仅做记忆（**不做自动重定向**，避免 SEO 上 cloaking/爬虫被跳转的问题）。
- 未翻译的深层页面（教程正文等）：/en 下保持中文回退，页面仍可用；后续轮次分批补齐。

## 4. SEO 影响评估与措施（着陆页 PR）

- **hreflang**：已翻译的路由对（`/` ↔ `/en` 等）在预渲染 head 输出 `<link rel="alternate" hreflang="zh-CN|en|x-default">` 互指；客户端 `applySeo` 同步维护。x-default 指向中文站（现有主流量）。
- **canonical**：/en 页面 canonical 指向自身（不是中文页），避免英文页被合并收录。
- **html lang**：预渲染时 /en 页面输出 `<html lang="en">`。
- **sitemap**：`prerenderPaths()` 增加 /en 路径，与预渲染清单同源，一致性由构建保证。
- **风险**：中文页权重不受影响（URL 不变、内容不变）；/en 是纯新增 URL 空间。英文关键词（seating chart maker / place card generator / wedding seating chart）由 /en 首页承接，JSON-LD `inLanguage: 'en'`。

## 5. 分批计划

- **PR A（架构）**：i18n 核心 + /en 路由 + 语言切换器 + 核心 UI 英文化（导航/页脚/首页/工坊/座位表/导出/定价/账户）。
- **PR B（着陆页）**：/en SEO（meta/OG/JSON-LD/hreflang/sitemap/预渲染）+ 英文首页关键词文案 + 高频模板英文名与演示数据。
- 后续轮：教程/模板详情/对比页等长尾内容英文化。
