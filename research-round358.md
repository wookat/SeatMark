# SeatMark 第 358 轮调研报告：前后端代码与流程分析专项（复核 + 增量发现）

> 只调研不改代码。范围：`app/src`（Vue3+TS strict+Vite7+Tailwind4，286 个 ts/vue 文件）与 `edge-functions/`（EdgeOne Pages Functions）。基线：main @ `1030806`。证据分级：【实证】=本轮亲自读码/实跑；【推断】=代码推理未经实跑；【转述】=来自上轮报告/注释。

## 验收基线（本轮【实证】）

- `npm install`（544 包）→ `npm run build` 全绿：vue-tsc + vite build + prerender 全量产出，sitemap 344 URL，llms.txt/llms-full.txt 生成。
- `npm run test` 全绿：**129 个测试文件 / 1177 条用例全过**（jsdom 的 scrollTo/canvas 警告为环境限制，非失败）。
- `node scripts/i18n-audit.mjs`：**0 泄漏**；known-gap 不变：TemplateDesigner 196 行、AiDesignDialog 31 行、IconPickerDialog 7 行。
- `dist` 总 31MB，chunk 实测见文末表。

## 与第 357 轮报告（research-round357.md）对账

【实证】逐项复核当前 main：

| r357 项 | 现状 |
|---|---|
| H1 AI 浏览器直连 Pollinations | **已修复**（#381：FREE_ATTEMPTS 仅同源代理） |
| H2 Sentry 每次首访无条件加载 | **已修复**（#383：window load 后 idle 调度） |
| H4 tplshare 短码无 TTL | **已修复**（#381：30 天 TTL） |
| M6 登录/重置重试复用已消费验证码 | **部分修复**：`resetPassword` 已有「网关 5xx 后再遇 400 → 提示直接登录」分支；`login()` 仍无兜底（见 N6） |
| H3 JWT 无吊销 / H5 readBody 样板重复 / M1 `/api/auth/me` 写副作用 / M2 名单全量 stringify / M3 照片 base64 / M4 admin overview N+1 / M5 1877 行单文件 / M7 注销残留 reserve/fb / L1–L6 | **仍未动**（已逐项读码确认） |

## 本轮新增发现（当前 main【实证】，均未在上轮清单）

- **N1（安全/健壮性，小）**：粘贴导入路径无行数与体积上限。`utils/excel.ts` `parsePastedRoster`（213 行起）不经 `assertImportRowCount`/`assertImportFileSize`（`utils/importLimits.ts`，文件导入有 20MB/10000 行上限，粘贴没有）；且第 243 行 `Math.max(...table.map(r => r.length))` 用参数展开求最大值，同文件第 110 行已是 `reduce`——粘贴 ~6.5 万行以上文本会直接 `RangeError` 栈溢出。方案：改 reduce + 在 `parsePastedRoster` 入口加行数上限。约 5 行。
- **N2（性能，小）**：`components/studio/DataImportPanel.vue:186` `pasteParsed` 是 computed，`pasteText` 每个输入事件都全量 split/正则/对象分配重解析，大粘贴内容每次按键都卡主线程。方案：对 pasteText 做去抖副本或改为点击「解析预览」触发。约 10 行。
- **N3（安全口径，小）**：`edge-functions/api/ai-design.js:282,290` 仍把上游错误原文 `errBody.slice(0,120)` 拼进 502 响应体（`attempts.join('；').slice(0,300)`）。#382 只收敛了前端展示文案，API 响应体仍透出上游诊断。方案：响应只回模型名+HTTP 状态码，原文进 console/告警。约 3 行。
- **N4（可观测性，小）**：`edge-functions/api/feedback.js:96-140` KV 归档失败与 webhook 推送失败都静默 catch；两者同时失败时反馈彻底丢失却仍回 `ok:true`。方案：归档失败时至少 `console.warn` + 有 ALERT_WEBHOOK 时告警；或 webhook 失败用 `waitUntil` 重试一次。约 10 行。
- **N5（性能/竞态，小）**：`edge-functions/api/[[default]].js:1489-1524` `/api/share/visit` 在响应路径串行做 6 次 KV 读写（dedupe get→put、visits getCounter→put、bonus getCounter→put×2），读改写窗口内并发可双计数，且每次访问多几十 ms 延迟。方案：dedupe put 后把计数/bonus 更新挪到 `deferWrite`/`waitUntil`。约 15 行。
- **N6（错误处理，小）**：`app/src/stores/auth.ts` `login()`（217-235）5xx 退避 5 次后直接抛最后错误；若首个请求已到函数并签发 cookie、仅响应被网关 5xx 改写，用户看到的是「验证码已使用」但实际已登录。方案：重试耗尽后调一次 `refresh()`（`/api/auth/me`）确认会话，已登录则按成功收尾（`resetPassword` 已有同类思想的落地可参照）。约 10 行。
- **N7（包体积，中）**：英文字典单 chunk `en-*.js` 实测 205.0KB / gzip 81.9KB。`i18n/locales/en.ts:5-13` 静态并入 `enStudio`（1016 行）与 `enStudioDescriptions`（441 行），任何 /en 路由首访全量下载。方案：工坊/内容站词条按路由动态并入（`registerDict` 式 merge），/en 落地可省约一半 gzip。【推断】收益规模。
- **N8（可维护性，中）**：巨石视图持续增长——`views/BanquetView.vue` 2819 行、`components/designer/TemplateDesigner.vue` 2041 行、`views/SeatingView.vue` 1355 行。方案：按面板/对话框拆子组件 + composable（如 BanquetView 的排桌算法已独立在 `utils/banquet.ts`，视图层可再拆导入/预览/导出三块）。纯结构收益，建议配合一次功能改动顺带做，避免纯搬迁 PR。
- **N9（安全边角，小）**：`[[default]].js` `readBody`/`feedback.js`/`ai-design.js` 对无 `Content-Length` 的 chunked body 先 `request.text()` 全量读入再做字节复核——平台层有内存上限兜底，但可在 reader 层提前截断。低优先，合并到 H5（统一 `readJsonBody`）时顺带做即可。
- **N10（性能边角，小）**：`utils/seating.ts` `parseSeatingRosterDetailed` 的 `colValues(i)`/`isGenderCol`/`nameGrid` 对每列独立全行扫描，合计 O(列数²×行数)；粘贴导入上限生效后（N1）影响可控，可一次转置消除。低优先。

## 按投入产出比排序的优化清单

**P0（行级改动，建议下轮打包）**
1. N1 粘贴上限 + `Math.max` 展开 → reduce（excel.ts:243 / importLimits.ts）
2. N3 ai-design 502 不透上游原文（ai-design.js:282,290）
3. N4 feedback 双失败兜底告警/重试（feedback.js:96-140）
4. N5 share/visit 计数挪 waitUntil（[[default]].js:1489-1524）
5. N6 login 重试耗尽后 refresh() 兜底（auth.ts:217-235）
6. N2 pasteParsed 去抖（DataImportPanel.vue:186）
7. H5+N9 统一 `readJsonBody` 到 `_http.js`（三处样板 ~60 行）

**P1（账号/会话健壮性，中等投入）**
8. H3 JWT 吊销：`user.tokenVersion` + 载荷 `tv`，改密/注销时 +1（[[default]].js signJwt/verifyJwt/currentUserEmail）
9. M7 注销清理 `reserve:`/`fb:` 个人数据（[[default]].js:1322-1342），或隐私政策明示不删
10. M1 `/api/auth/me` 移除 shareCode 懒创建副作用，挪到 `/api/share/mine`（[[default]].js:496-510）
11. M2 名单持久化：deep watch 全量 stringify → 结构性操作后显式持久化 / 大名单跳过 sessionStorage（workspace.ts:164-193）

**P2（规模到位再做）**
12. M3 照片 dataURL → `URL.createObjectURL`（photos.ts + workspace.photos，注意导出链与 revoke）
13. M4 admin overview 聚合计数器（[[default]].js:1632-1696）
14. M5 catch-all 拆域模块（[[default]].js 1877 行 → auth/quota/share/redeem/admin）
15. N7 en 字典按路由分包；N8 巨石视图拆分；L1-L6 观察项维持

## 实测数据（本地 `vite build`，r358 基线）

| chunk | 原始 | gzip | 加载时机 |
|---|---|---|---|
| index（主包） | 174.4KB | 64.4KB | 首屏 |
| index.css | 92.2KB | 15.9KB | 首屏 |
| defaultTemplates | 275.7KB | 65.4KB | /studio、/templates、首页 IO 懒加载 |
| guides | 495.2KB | ~175KB | 仅教程页 |
| templateDetails | 220.1KB | 79.5KB | 模板墙/详情页 |
| en 字典 | 205.0KB | 81.9KB | 仅 /en（见 N7） |
| vendor-xlsx | 499.6KB | ~163KB | 导入时按需 |
| vendor-pdf | 617.6KB | ~184KB | 导出时按需 |
| vendor-sentry | 461.4KB | 153.5KB | window load 后 idle（H2 已修） |
| vendor-pinyin | 302.3KB | 138.8KB | 长字母拼音搜索按需 |

## 结论

无高危项；安全姿态（fail-closed、CSPRNG、SameSite=Lax、SVG 白名单 sanitize、密钥仅 env）经本轮复核无倒退。最值得做的是 P0 七项——全部行级改动、互不依赖，可一轮打包；P1 聚焦账号注销/会话吊销的数据完整性与一致性；包体积与视图拆分留作规模触发项。
