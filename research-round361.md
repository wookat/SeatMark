# 第 361 轮调研：前后端代码与流程分析（只调研不改码）

> 范围：通读 app/src 关键链路（导出、导入、会员/兑换、auth、存储、i18n、SEO prerender）与
> edge-functions 全部文件；本地构建实测包体积；跑通测试套件；curl 生产站核响应头。
> 证据级别标注：【实证】=本轮直接验证；【推断】=代码逻辑推导；【未验证】=需生产侧确认。

## 一、总体结论

代码已高度加固，大量历史事故的防御注释与测试仍在位（543/545 网关错误应对、
克隆样式丢失修复、验证码双消费窗口、memory 降级 fail-closed、枚举防护、
chunk 加载失败自动重载等）。本轮分析聚焦**残留/结构性问题**，按投入产出比排序。
构建与测试一手数据：`npm run build` 全绿（344 sitemap URL、78 篇指南、225 模板）、
`vitest run` 143 文件 / 1294 用例全过、i18n 审计由 `src/__tests__/i18nAudit.spec.ts`
在测试内执行（同样全过）。

## 二、包体积实测（gzip，本地生产构建）

| chunk | raw | gzip | 加载时机 |
|---|---|---|---|
| index（入口） | 175KB | 64.7KB | 首屏 |
| index.css | 80KB | 16KB | 首屏 |
| HomeView | 55KB | 10.4KB | 首屏 |
| vendor-pdf | 617KB | 181KB | 导出 PDF 时懒载 |
| vendor-xlsx | 500KB | 163KB | 导入 Excel 时懒载 |
| vendor-sentry | 461KB | 153KB | idle 后懒载 |
| vendor-pinyin | 302KB | 139KB | 姓名拼音时懒载 |
| guides | 495KB | 175KB | 访问指南文章时 |
| defaultTemplates | 276KB | 65KB | 首页/Studio 首模板区 |
| templateDetails | 220KB | 79.5KB | 模板详情页 |
| en 字典 | 217KB | 87KB | /en 路由才加载 |
| jszip | 97KB | 30KB | PNG 批量导出时 |
| StudioView | 229KB | 74KB | /studio 路由 |
| BanquetView | 80.5KB | 26KB | /banquet 路由 |

首屏关键路径很瘦（≈91KB gzip HTML+CSS+JS+HomeView），大图 vendor 均已懒载或
idle 延迟，PWA precache 主动含 vendor-pdf/vendor-xlsx（约 344KB gzip，SW 安装时
异步拉取）——这是「可完全离线」承诺的必要成本，属有意决策。

## 三、发现与优化建议（按投入产出比排序）

### 高收益低改动（建议优先）

1. **【实证·代码】兑换码两段式核销存在「死码」窗口**
   `edge-functions/api/[[default]].js` `POST /api/redeem`：先 put 占位占码（防并发）→
   sleep 60ms → re-read 确认占位仍是本人 → 再发权益。若 re-read 读不到/占位被覆盖
   （如 TTL 竞态、Blob 最终一致窗口），码已被占但权益未发；用户重试会得到
   `redeem_code_used`，无法申诉。
   **方案**：confirm 失败分支回滚占位（读回校验后恢复 `usedBy:null`），或把失败
   置为 `pending` 状态允许同邮箱重试续领。改动约 15 行。

2. **【实证·代码】quota/consume 写序可防重试双扣**
   同文件 `POST /api/quota/consume`：先写日用量计数，再写幂等键
   `usage:{email}:{date}:id:{exportId}`。若两次写之间请求中断（网关 545 等），
   客户端重试会命中「幂等键不存在」→ 再次扣量。
   **方案**：调换顺序，先写幂等键（带幂等语义的唯一记录），再写计数。一行换序。

3. **【实证·生产】生产 API 运行在降级配置上，需确认是否预期**
   `GET https://www.seatmark.cn/api/announcement` 返回
   `{"announcement":null,"authService":"auth_secret_missing"}`，响应头
   `X-SeatMark-Storage: blob`、`X-SeatMark-Rev: r359`。
   即生产**未配 AUTH_SECRET**（账号/兑换/管理端全部按设计 fail-closed 503）
   且**未绑 seatmark_kv**（走 Blob 兜底）。若账号体系有意未上线，则行为正确；
   否则属配置缺口，一行环境变量即可恢复。**需老板侧确认意图。**

4. **【实证·代码】memory 降级下新增写路由可能绕过 fail-closed**
   `MEMORY_UNSAFE_ROUTES` 是「opt-out」名单：未登记的写路由在 memory 存储下静默
   「写成功」但不持久。`edge-functions/api/feedback.js` 即未登记——memory 下
   反馈被「存档」进内存即返回 archived=true，重启即丢。
   **方案**：反转策略——默认拒绝 memory 上的写（`storage==='memory' && !readOnlySet.has(path)` → 503），
   把现有只读 GET 登记进 allowlist；feedback 若依赖 webhook 兜底可在注释中显式豁免。
   改动集中在 `isMemoryUnsafe` 判定 + 一个登记表，约 20 行。

### 高收益中改动

5. **【实证·代码】照片以原图 dataURL 驻留内存，批量照片内存峰值高**
   `app/src/stores/workspace.ts` `photos: Map<string,string>` 存 dataURL
   （base64 体积 +33%，且可能是数 MB 原图）。200 人 × 2MB 照片 ≈ 550MB+ 内存，
   移动端易触发 OOM/白屏，PDF 渲染时同时解码全量 dataURL。
   **方案**：导入照片处（workspace store 的照片读入）用 `createImageBitmap` +
   canvas 降采样到显示所需像素（如长边 ≤800px）再转 dataURL/Blob；
   导出渲染阶段按需逐张解码。收益：内存峰值降一个数量级。改动约 40 行。

6. **【实证·代码】内容详情页整包数据静态导入**
   `src/views/GuideArticleView.vue` 静态 `import { findGuide, guides } from '@/data/guides'`
   → 单篇文章页拉走整个 495KB/175KB-gz guides 数据包；
   `TemplateDetailView.vue` 同理拉走 templateDetails(79.5KB gz)+defaultTemplates(65KB gz)。
   这些页面本身已预渲染成静态 HTML，SPA 内导航时才需要数据。
   **方案**：data/guides 拆成 `guidesIndex`（列表元数据）+ 每篇 `guides/{slug}.ts` 懒载；
   模板详情同理按 slug 拆。收益：内容页访客 JS 减少约 200KB gzip。中改动（数据文件拆分 +
   import 点改造）。

7. **【实证·代码】登录侧枚举与时序差异（低危）**
   `POST /api/auth/login`：账号存在但无密码 → 409「该账号尚未设置密码」，泄露
   「该邮箱已注册（经验证码通道建号）」；且无密码账号跳过 PBKDF2 比较，存在
   可探测的时序差异。另：连续失败锁定按邮箱，攻击者可用错误密码锁定任意
   邮箱 15 分钟（可用性 DoS）。
   **方案**：无密码账号返回与密码错误一致的 401 文案 + 执行一次哑 PBKDF2 比较
   抹平时序；锁定键改为 `ip:email` 组合。各约 10 行。

### 低收益/结构性（建议在动到相关文件时顺手做）

8. **【实证·代码】`prewarmStylesheets` 按页按尝试重复执行**
   `pdfExport.ts/pngExport.ts` 的 `renderOnce` 内每页都跑样式表预热（30 页 =
   30 次 preload link 注入/删除 + fetch 竞争）。预热提到每次导出会话一次即可。
   收益小但改动极小。

9. **【推断】HTML `no-cache` 下 EdgeOne 仍边缘缓存命中**
   生产 `GET /` 返回 `cache-control: no-cache, must-revalidate` 但
   `eo-cache-status: Cache Hit`、`age: 861`。若 EdgeOne 对 no-cache 的处理是
   「回源校验后可命中」则正常；若是直接服务旧副本，发布有最长十几分钟的生效
   延迟。【未验证 EO 语义】可在下次发版时观察。

10. **【实证·代码】其他低优先项**
    - `getStorage` 每次请求都初始化 Blob SDK（即便 KV 已绑定）——为模板 Blob 通道
      兼容所需，可改为模板路径才懒初始化。
    - 会话 JWT 30 天不可吊销（logout 仅清本地）——如需可加 `sessionEpoch`。
    - Sentry 事件清洗只剥 URL 的 `?q/name` 参数，异常 message 可能夹带用户文件名——
      可加保守正则脱敏。
    - index.html 三个第三方统计脚本（GA + 百度统计 + 百度 linksubmit 主动推送）——
      linksubmit 是老主动推送 API，建议核实是否仍有效，无效可删。
    - 大文件维护性：`[[default]].js` 1881 行单文件 25+ 路由、`BanquetView.vue` 3083 行、
      `TemplateDesigner.vue` 2055 行、`PreviewArea.vue` 1694 行——建议按域拆分，
      但变动面大，适合「下次动到该文件时逐步抽」。
    - `edge-functions/api/_rev.js` 手工递增——可改为发版期注入 git rev。
    - AI 设计无密钥兜底走 Pollinations 匿名接口：实证 `aiPrefill` 仅带字段名+sample
      （不自动带名单数据），但用户手输内容会外发第三方——可在 AI 弹窗加一行外发提示。

## 四、已确认健康、不建议动的部分

- 导出链路（pdfExport/pngExport 的 watchdog/空白检测/克隆样式内联/字体图片等待/
  自动 PNG-JPEG 分类/按页释放 canvas）经多轮打磨，注释即事故史，不建议重构。
- 安全基线达标：AUTH_SECRET 缺失 fail-closed、CSPRNG、验证码一次性、防枚举、
  webhook 仅环境变量、memory 写 fail-closed（除反馈路由见上）、幂等配额。
- i18n：zh 作 key 回退、en 懒载、审计在测试内执行。
- SEO：344 URL sitemap、全量预渲染、JSON-LD/hreflang、llms.txt、生产响应头
  （/assets immutable、安全头、公告接口公共缓存）均实证正常。
- 第三方脚本全部 idle/交互后加载；Sentry idle 延迟 + 预初始化错误队列。
