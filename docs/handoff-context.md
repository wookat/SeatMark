# 交接上下文（Handoff Context）

> 按 company-os `templates/handoff-context.md` 结构维护。每条事实后附可复核的文件路径或命令；不写任何凭证值。
> 换会话/换负责人时，把本文档整体注入新会话首条消息。最后更新：第 366 轮。

## 项目目标

SeatMark 座签：上传 Excel 名单，在浏览器本地批量生成考场座位标签 / 桌牌席卡 / 座位表并导出 PDF/PNG 或打印。当前阶段：**已上线运营，短周期迭代**（每轮=一小批改进 → 部署 → 生产匿名复测 → 下一轮）。

## 代码与数据位置

- 仓库：`https://github.com/wookat/SeatMark`（默认分支 `main`）
- 关键子目录（`README.md` 目录结构表）：
  - `app/`：前端应用（Vue 3 + TypeScript strict + Vite 7 + Tailwind CSS 4 + Pinia 3 + Vue Router 4；测试 Vitest + @vue/test-utils）——见 `app/package.json`
  - `edge-functions/api/`：腾讯 EdgeOne Pages Edge Function（见下「边缘函数清单」）
  - `edgeone.json`：EdgeOne Pages 构建命令、输出目录与响应头规则
  - `docs/`：设计评审、体验审计、运营轮次证据（`ops-roundN.md` + `ops-roundN-evidence/`）、i18n 方案（`docs/i18n-plan.md`）
  - `brand/`、`marketing/`：品牌资源与营销素材
- 用户数据：**没有服务端名单/照片/座位数据**。名单、照片、座位表、自定义模板全部在浏览器本地处理（`localStorage` / IndexedDB），见 `README.md`「隐私优先」与 `app/src/components/studio/DataImportPanel.vue`。
- 服务端仅存账号/配额/验证码/模板分享短链等少量键值，走 `edge-functions/api/_storage.js` 的 KV（`seatmark_kv` 绑定）→ EdgeOne Pages Blob → 内存三级后备。

## 构建与验证命令

```bash
cd app
npm install
npm run dev          # vite 开发服务器
npm run test         # vitest run（第 366 轮：157 个文件 / 1442 用例）
npm run build        # vue-tsc --noEmit -p tsconfig.json && vite build && npm run prerender
node scripts/i18n-audit.mjs   # /en 中文泄漏守卫，exit 0 = 0 条非允许泄漏
```

- `npm run build` 的定义见 `app/package.json` `scripts.build`；`prerender` = `vite build --ssr src/entry-server.ts --outDir dist-ssr && node scripts/prerender.mjs`。
- 仓库**没有** eslint/prettier 配置与 `lint` 脚本（`ls -a app | grep -i eslint` 为空）；typecheck 由 `vue-tsc --noEmit` 承担（已含在 build 中，也可单独 `npx vue-tsc --noEmit`）。
- 仓库无 pre-commit / husky 钩子（`ls -a | grep -i "pre-commit\|husky"` 为空）。

## 部署

- 平台：腾讯 EdgeOne Pages，静态托管 + Edge Function。构建配置 `edgeone.json`：`installCommand: npm install && cd app && npm install`，`buildCommand: cd app && npm run build`，`outputDirectory: app/dist`。
- 响应头（`edgeone.json` `headers`）：`Cache-Control: no-cache, must-revalidate`（全站）、HSTS、`X-Content-Type-Options`、`X-Frame-Options: SAMEORIGIN`、`Content-Security-Policy: frame-ancestors 'self'`、`Referrer-Policy`、`Permissions-Policy`；`/fonts/*` 单独长缓存。Edge Function 自建 Response 的安全头由 `edge-functions/api/_security.js` 补齐。
- 生产域名：`https://www.seatmark.cn`；英文入口 `https://www.seatmark.cn/en`。
- 预渲染：`app/scripts/prerender.mjs` 按 `prerenderPaths()`（`app/src/data/seo.ts`）为每条路径写 `dist/<path>/index.html`，同时生成 `dist/sitemap.xml`（`isSitemapEligible` 排除 noindex 页）与品牌化 `dist/404.html`。**只有 `prerenderPaths()` 列出的路径在静态托管下直达才不是 404**。
- PWA：`vite-plugin-pwa`（`app/package.json`）。生产复测时注意 service worker 旧缓存，需用全新浏览器 profile / 清缓存后再核验（见 `.agents/skills/testing-seatmark/SKILL.md`）。
- PWA 预缓存取舍（第 342 轮，`app/vite.config.ts` `workbox.globIgnores`）：预缓存只收核心工具链（入口 `index-*`、`StudioView`、`vendor-pdf/xlsx/preload`、`defaultTemplates`、字体与图标），排除内容站分包 `guides-*` / `templateDetails-*` / `vsPages-*` / `topicPages-*` / 英文字典 `en-*`，jspdf.html() 从不调用的可选依赖 `html2canvas.esm-*` / `index.es-*`(canvg) / `purify.es-*`，以及 `og-image.png`；首访预缓存由 72 条 / 4093 KiB 降到 63 条 / 2712 KiB。被排除的内容分包走 `StaleWhileRevalidate`（cacheName `content-chunks`），**代价：未访问过的教程/模板详情/对比页/英文站离线不可达**，访问过一次后才能离线打开；工坊导入/编辑/导出仍完整离线可用。统计命令：解析 `dist/sw.js` 中 `precacheAndRoute` 的 `url:` 列表并对 `dist/` 下对应文件 `statSync` 汇总。
- `.github/workflows/` 中的文件保留但 **GitHub Actions 处于禁用状态**，不要启用或修复（公司规则，见下）。

## 边缘函数清单（`edge-functions/api/`）

| 文件 | 路由 | 依赖的环境变量（只写名，不写值） |
| --- | --- | --- |
| `[[default]].js` | `/api/*` catch-all：`/api/auth/*`（邮箱验证码/密码登录注册、JWT httpOnly 会话）、配额、模板同步、分享短链、`/api/admin/health` 等（路由清单见文件头注释） | `AUTH_SECRET`、`ADMIN_EMAILS`、`TENCENT_SES_SECRET_ID`、`TENCENT_SES_SECRET_KEY`、`TENCENT_SES_REGION`、`TENCENT_SES_TEMPLATE_ID`、`RESEND_API_KEY`、`MAIL_FROM`、`SEATMARK_ALLOW_MEMORY_STORAGE`、`DEV` |
| `ai-design.js` | `POST /api/ai-design`（AI 标签设计同源代理；主模型 DeepSeek，兜底智谱 glm-4-flash） | `DEEPSEEK_API_KEY`、`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`ALERT_WEBHOOK`（可选告警） |
| `feedback.js` | `POST /api/feedback`（用户反馈，先归档再转发机器人 webhook；第 366 轮起 webhook 按 `response.ok` 判定投递成功，非 2xx/超时经 `waitUntil(retryLater)` 只重试一次） | `FEEDBACK_WEBHOOK`（可选） |
| `_storage.js` | 内部模块：KV → Blob → 内存三级存储抽象 | KV 绑定名 `seatmark_kv`；Blob 依赖根 `package.json` 的 `@edgeone/pages-blob` |
| `_security.js` | 内部模块：API 响应安全头 | — |

复核命令：`grep -rhoE "env\.[A-Z_]+" edge-functions | sort -u`。

## i18n 机制（英文站 /en）

- **中文原文即键**：`t(zh)` 在 `en` locale 下查 `app/src/i18n/locales/en.ts`，未命中回退中文原文；`zh` locale 原样返回（`app/src/i18n/index.ts` `t()`）。
- **英文字典懒加载**：`setLocale('en')` 首次调用时 `import('./locales/en')`，中文用户不下载英文包（`app/src/i18n/index.ts` `setLocale()`）。
- **路径约定三层**（`app/src/data/seo.ts` + `app/src/router/index.ts`）：
  1. `EN_LOCALIZED_BASES = ['/', '/studio', '/pricing', '/seating', '/banquet']`：有英文正文、可索引、互挂 hreflang 的 /en 镜像；
  2. `enIndexShellPaths()`：`/en/templates`、`/en/guides`、`/en/papers`、`/en/vs` 内容站索引外壳——预渲染防 404、英文 title/description，但正文中文，`noindex` 且 canonical 指回中文页、不进 sitemap；
  3. `zhOnlyRedirectTarget(path)`（`EN_ZH_ONLY_DETAIL_RE`）：`/en/(guides|templates|papers|vs)/:slug` 与 `/en/(terms|privacy|desk-card-generator|name-card-batch)` 仅有中文正文，路由守卫直接重定向到去 `/en` 前缀的中文路径；`AppFooter.vue` 中这 4 条链接直接指向中文路径，不经 `localePath()`。
- `localePath(path)`：`en` 下给站内路径加 `/en` 前缀。**新增页脚/页头链接时，其 /en 目标必须 ∈ `prerenderPaths()` 或被 `zhOnlyRedirectTarget` 命中**，否则生产直达 404——由 `app/src/router/__tests__/enRedirect.spec.ts` 的守卫用例强制。
- **中文泄漏守卫**：`app/scripts/i18n-audit.mjs`（`app/src/__tests__/i18nAudit.spec.ts` 断言 0 泄漏）扫描 `App.vue`、7 个 view、`components/{ui,studio,label}/**`，剔除注释/console/import 与 `t()`/`tr()` 内字面量、`locale !== 'en'` 分支后，含汉字的行与 `ALLOWLIST`（品牌/水印/ICP/语言切换器/演示数据）比对；`KNOWN_GAP_FILES` 中的文件只提示不计失败。
- 英文页首屏加载文案由 `app/scripts/prerender.mjs` 在 `seo.lang === 'en'` 时替换为 `Loading SeatMark…`。

## 已定型铁律（不许推翻）

- 隐私：名单/照片/座位数据全部浏览器本地处理，禁止引入任何自动上传；生产测试匿名进行（不注册、不登录、不发真实邮件、不提交预订表单），测试后清理浏览器存储。
- 水印保持最克制的底边细线签名式（`app/src/components/label/LabelCard.vue` `WATERMARK_FULL = 'SeatMark 座签 · seatmark.cn'`，`app/src/utils/watermark.ts`）。
- UI 只做小改小调，禁止深色玻璃拟态/纸质印刷风/黑白编辑部式等全站大改。
- 定价：专业版原价 ¥19、团队版 ¥49、限时 0 折免费；不接入真实支付（`app/src/views/PricingView.vue`、`en.ts` 中 'Pro is free for a limited time (normally ¥19/mo)'）。
- 公司规则：所有仓库不需要 CI，GitHub Actions 保持禁用；验收 = 本地 test/typecheck/build 全绿 + 生产复测，本地全绿即可合并。
- git：新分支 `devin/<时间戳>-<描述>`；禁止 `git add .`、amend、force push main、跳过 hooks；仓库无 CI / 无 auto-merge，本地全绿后由负责人经 GitHub API squash 合并并 GET 确认 `merged=true`。

## 第 366 轮实施结论（edge_changed=true，`X-SeatMark-Rev` r364 → r366）

证据分级：**直接实证** = 本会话本机实跑命令/接口得到的输出；**报告转述** = 子会话/测试代理报告，未亲自复现；**未验证** = 未做。

| # | 项 | 改动位置 | 结论 | 证据级别 |
| --- | --- | --- | --- | --- |
| 1 | 反馈 webhook 投递可靠性 | `edge-functions/api/feedback.js`（`push()` 改为 `await fetch` 后检查 `response.ok`，非 2xx 抛带状态码错误，走既有 `console.warn + waitUntil(retryLater(push))` 重试一次；`delivered` 仅 2xx 置 true；`!archived && !delivered → 503` 语义不变；webhook 仍只读 `env.FEEDBACK_WEBHOOK`）；`_rev.js` r366 | `app/src/__tests__/edgeFeedback.spec.ts` 新增 200 / 4xx / 5xx / 超时(AbortSignal) 四类用例，断言 delivered、响应码（有归档 200、无归档且非 2xx 503）与 retryLater 调度；20 用例通过 | 直接实证（本地 vitest） |
| 2 | 宴会自动分配前容量预估 | `app/src/utils/banquet.ts` 新增纯函数 `estimateCapacity()`（与 `summarizeBanquet` 同文件同口径；锁定桌只计其已就座宾客，未用锁定座位不计入可分配容量）；`BanquetView.vue` 第 3 步「一键自动分配」上方 `data-testid="capacity-estimate"`；「无桌可整组容纳」改为「这组 n 人没有一桌能坐下整组，已拆到 m 桌」（`en.ts` 同步） | `banquetSummary.spec.ts`：48 人 / 8 桌×10 座 → 至少 5 桌·预计空 3 桌；30 人 / 3×8 → 还差 6 座；空表/无名单；含锁定桌；组件断言文案与分配后摘要不矛盾 | 直接实证（本地 vitest） |
| 3 | ≤768px 浮动反馈按钮让位 | `FeedbackButton.vue` `max-sm:*` → `tablet-down:*`（`app/src/assets/main.css` 新增 `@custom-variant tablet-down (@media (width <= 768px))`，编译为 `@media(max-width:768px)`；PR #406 先改成 `max-md:` = `<768px`，生产 768px 实测未收起，随后补丁 PR 改为含 768 的自定义变体），>768px 桌面不变 | `feedbackButton.spec.ts`：767/768px（matchMedia 模拟）滚动收起 / textarea 聚焦收起 / 回顶恢复 / 769px 不命中；`mobilePreviewJump.spec.ts` 断言同步 | 直接实证（本地 vitest + dist CSS grep）；生产 390/768 宽截图见下「生产复测」 |
| 4 | 文案去 AI 味 | `HomeView.vue` 副标题改为能力清单式（`en.ts` 同步）；`guides.ts` 去掉「500 人…耗掉半天」；8 篇教程首段按人群重写（考务/班主任 3、行政会务 3、婚庆 2，分布在 `guides.ts` / `guidesRound4.ts` / `guidesRound5.ts`），quickStart.note 去重「无需注册」 | `marketingCopyRestraint.spec.ts` 新增：HomeView「每一步都按」=0、guides「耗掉半天」=0、单篇首段「无需注册」≤1、合计 ≤6；i18n 审计 0 leaks；预渲染 353 页（与改动前一致，本轮未增删路径） | 直接实证（本地 vitest / build / i18n-audit） |
| 5 | 名单本地持久化失败不再静默 | `stores/workspace.ts` `persistRoster`：JSON 长度 > 4 MiB 直接跳过 `sessionStorage`；catch 置 `rosterPersistFailed=true`，成功写入复位；`MappingPanel.vue` 新增 `data-testid="roster-persist-notice"` 温和提示。不引入上传/压缩上云，不改照片处理 | 新增 `stores/__tests__/workspaceRosterPersistNotice.spec.ts`：QuotaExceededError → 提示渲染；正常 26 行 → 不渲染；超预算跳过 setItem 且渲染；成功后复位 | 直接实证（本地 vitest） |
| 6 | 定价 FAQ 维护提示聚合 + /en 窄屏字标 | `PricingView.vue` FAQ 逐条提示删除，改为标题下方仅 1 条（`auth.serviceUnavailable && PRICING_FAQS.some(faqMentionsAccountBonus)`），套餐卡内提示不动；`AppHeader.vue` 英文字标 `hidden max-md:inline lg:inline`（<md 与 ≥lg 显示，md–lg 仍让位给行内导航，布局不改） | `serviceUnavailableDegradation.spec.ts` 改为「维护态 FAQ 区恰 1 个 / 恢复后 0 个」；`appHeader.spec.ts` 新增 en 路由窄屏字标含 SeatMark | 直接实证（本地 vitest） |
| 7 | 导出旁缺失字段示例可定位 | 新增 `app/src/utils/missingDetail.ts`（`missingDetailText` / `missingExampleText`），`MappingPanel.vue` 与 `PreviewArea.vue` 共用；`dataQuality.missingDetails[]` 附 `name`（姓名列非空时）；导出提示追加「例：第 3 行 张三 · 座位号为空 等 N 行」，「去查看」按钮与非阻断导出不变 | `utils/__tests__/missingDetail.spec.ts`、`mappingPanelMissingDetails.spec.ts`、`previewAreaUnmapped.spec.ts` 新增断言 | 直接实证（本地 vitest） |

本地验收（2026-09-08，本机实跑）：`cd app && npm run test` → 157 files / 1443 tests passed（补丁 PR 后）；`npm run build`（vue-tsc + vite build + prerender）→ exit 0，353 页预渲染，sitemap 344 urls；`node scripts/i18n-audit.mjs` → 0 leaks；`git diff --check` → 无告警。

生产复测：合并部署后进行（匿名，不注册/不登录/不发信/不提交预订；`POST /api/feedback` 仅提交 1 条不含真实联系方式的测试反馈核对 `X-SeatMark-Rev: r366` 与返回码；结束清理 localStorage/sessionStorage）。结果登记在 `docs/test-plans/test-report.md`「第 366 轮」一节；PR 描述与本节以该报告为准，未写入的项一律视为**未验证**。

## 已知缺口

- `app/src/components/designer/TemplateDesigner.vue`、`AiDesignDialog.vue`、`IconPickerDialog.vue` 未英文化（`i18n-audit.mjs` `KNOWN_GAP_FILES`，第 340 轮分别剩 197 / 31 / 7 行含中文）。
- `/en` 内容站（templates/guides/papers/vs）只有 noindex 英文外壳，正文为中文；详情页在 /en 下直接回到中文路径。
- 生产复测受 PWA service worker 旧缓存影响，需全新 profile 或清缓存（`.agents/skills/testing-seatmark/SKILL.md`）。
- **生产 `AUTH_SECRET` 未配置**（第 342 轮 `curl https://www.seatmark.cn/api/admin/health` 实测 503 `authSecretConfigured:false`、`code:auth_secret_missing`）：账号登录/注册/找回、验证码、配额同步、模板云同步全部 fail-closed；导出/打印/本地处理不受影响。org 内腾讯凭证（`TENCENT_SES_SECRET_ID/KEY`）未验证到 EdgeOne Pages 环境变量写权限，需在 EdgeOne 控制台手工配置：`AUTH_SECRET`（`openssl rand -base64 48` 生成）、`ADMIN_EMAILS`、`TENCENT_SES_SECRET_ID/KEY/REGION/TEMPLATE_ID`、`RESEND_API_KEY`、`MAIL_FROM`、`FEEDBACK_WEBHOOK`、KV 绑定 `seatmark_kv`。前端已对 503 / `auth_secret_missing` 显示「账号服务暂时不可用」并禁用提交（`app/src/stores/auth.ts` `serviceUnavailable`、`app/src/views/AccountView.vue`）。第 362 轮复核（2026-09-08 `curl`）：`/api/quota`、`/api/auth/me`、`/api/admin/health` 仍持续 503 `auth_secret_missing`，属既有环境项、非代码回归、本轮未修复；代码按铁律 fail closed 属正确行为。修复路径唯一：在 EdgeOne Pages 环境变量配置 `AUTH_SECRET`（≥32 字节 CSPRNG 随机串，仅存环境变量，源码不留任何兜底），配置并重新部署后 `/account`、`/pricing` 的维护卡自动消失。
- 匿名访客默认不再请求 `/api/auth/me`：`localStorage` 标记 `seatmark:has-account`（`app/src/stores/auth.ts` `bootstrap()`），`/account` 与 `?ref=` 落地仍无条件 `refresh()`。

## 测试报告与计划存放约定

- `docs/test-plans/test-report.md`（第 349 轮起由仓库根归档至此）：**追加式**，每轮一节 `# 第 N 轮（日期）：…`，含环境（生产、匿名）、逐判据 PASS/FAIL、收尾（存储已清、未登录未发信）与录屏路径。
- `docs/test-plans/test-plan-roundN.md`（同上，原仓库根 `test-plan-round*.md`/`research-round324.md` 已一并归档）：每轮生产复测前的计划，列判据与依据的源码行。
- `docs/ops-roundN.md` + `docs/ops-roundN-evidence/`：运营轮次的证据归档。
- 本地测试技能：`.agents/skills/testing-seatmark-local/SKILL.md`；生产 E2E 技能：`.agents/skills/testing-seatmark/SKILL.md`。

## 资源与凭证索引（只写名）

- EdgeOne Pages 控制台环境变量：见上「边缘函数清单」列出的变量名。
- KV 绑定：`seatmark_kv`。
- 邮件通道：腾讯云 SES（优先）→ Resend（备用）→ 本地开发 `devCode` 直返。
- AI：DeepSeek（主）→ 智谱 glm-4-flash（兜底）。
