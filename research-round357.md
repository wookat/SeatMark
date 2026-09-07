# SeatMark 第 357 轮调研报告：前后端代码与流程分析专项

> 只调研不改码。范围：`app/src`（Vue3+TS strict+Vite7+Tailwind4）与 `edge-functions/`（EdgeOne Pages Functions，4 个函数文件 + 4 个共享模块，共 ~2600 行）。包体积数据来自本地 `vite build` 实测。

## 总体结论

代码库工程质量明显高于同类小工具站平均水平：fail-closed 设计一致（AUTH_SECRET 缺失/存储降级 memory → 503）、安全随机统一走 `_random.js` CSPRNG、导出链路有看门狗+空白页/截断检测+重试+重建容器兜底、隐私侧做了较深的细节（?q= 搜索词不进门路、telemetryPath 剥离用户输入、SVG 白名单重建、兑换码只存哈希）。**没有发现需要立即修复的高危问题**。以下按投入产出比（ROI）排序列出可优化项。

---

## 一、高 ROI（建议下轮优先）

### H1. AI 设计兜底链路自相矛盾：浏览器直连 Pollinations 与边缘函数注释不一致
- **文件**：`app/src/utils/aiDesign.ts`（`FREE_ATTEMPTS` 第 2/3 项）、`edge-functions/api/ai-design.js`（第 9、263 行注释）
- **现状**：边缘函数注释说「浏览器直连 Pollinations 受来源限制 402，服务端出口可用」，但前端 `callChatFree` 在同源代理失败后仍从浏览器直连 `text.pollinations.ai` 两次（各 90s 超时）。
- **问题**：若 402 恒定 → 这两条是死路径，纯浪费用户等待时间；若偶发可用 → 用户输入的「字段名+示例值+设计要求」（可能含真实姓名等名单内容）会发给第三方匿名接口，与「数据全程本地处理」的站规口径冲突。
- **建议**：二选一——(a) 直接删掉前端两条直连兜底（同源代理已内含 Pollinations 服务端兜底，能力无损），同时在 UI 上补一句「AI 设计会将你填写的字段示例发送给模型服务」的提示；(b) 若确认浏览器直连可用，则保留但在发送前明示数据将出域。**推荐 (a)，改动约 10 行。**

### H2. Sentry SDK（461KB / gzip 153KB）在每次首访 mount 后无条件加载
- **文件**：`app/src/main.ts`、`app/src/utils/sentry.ts`
- **现状**：`installSentry` 已在 mount 后动态 import，但对所有访客（无论是否出错）都拉 SDK。
- **建议**：把加载推迟到 `requestIdleCallback`/首个真实错误发生时（preInitErrorQueue 已天然支持延迟回放——再包一层 `setTimeout` 或在首个 error 事件时才 `installSentry`）。预期每个访客省 ~150KB gzip 下行 + 一次大 chunk 解析。**改动 <30 行。**

### H3. 会话 JWT 无吊销机制：改密/注销/登出后旧 token 30 天内仍有效
- **文件**：`edge-functions/api/[[default]].js`（`signJwt`/`verifyJwt`/`currentUserEmail`，第 208–262 行）
- **现状**：logout 只清客户端 cookie；`reset-password`、`account/delete` 后，已签发的 JWT 在 30 天 TTL 内仍可通过 `currentUserEmail` 校验（删除账号后 `getUser` 返回 null 会让多数路由失效，但 `verifyJwt` 本身仍认）。cookie 一旦外泄（如公共设备、日志）无法在服务端作废。
- **建议**：低成本方案——user 记录加 `tokenVersion` 字段，JWT 载荷带 `tv`，`currentUserEmail` 校验 `payload.tv === user.tokenVersion`（需多读一次 user，但该读在多数路由本就要做）；改密/注销时 `tokenVersion++`。若嫌每请求多读，`/api/account/delete` 与 `reset-password` 两个敏感路径做校验即可。**改动 ~40 行。**

### H4. `tplshare:` 短码写入无 TTL，KV 内永久累积
- **文件**：`edge-functions/api/[[default]].js` 第 1545 行
- **现状**：`kv.put('tplshare:'+code, payload)` 无 `expirationTtl`，内容寻址短码永久保留；每条 ≤20KB，无总量上限。
- **建议**：加 TTL（如 180 天）或惰性续期。一行改动。

### H5. 三个边缘函数的「Content-Length 预检 + text() 实读 + 字节复核 + JSON.parse」样板重复
- **文件**：`edge-functions/api/[[default]].js` `readBody`（936–955）、`feedback.js` 46–64、`ai-design.js` 142–161
- **建议**：下沉为 `_http.js` 的 `readJsonBody(request, maxBytes)` 共享函数（错误对象带 status）。减 ~60 行重复，统一行为。**小改动，纯收益。**

---

## 二、中 ROI

### M1. `/api/auth/me`（GET）有写副作用：首次调用即创建分享码
- **文件**：`edge-functions/api/[[default]].js` `publicUser`→`shareStats`→`shareCodeFor`（465–474 行）
- GET 语义不纯；对只用账号页/配额的用户也白写两个键。建议把分享码懒创建挪到 `/api/share/mine` 或注册/登录路径。

### M2. 名单持久化的 deep watch + 全量 JSON.stringify
- **文件**：`app/src/stores/workspace.ts` 164–193 行
- `watch(..., {deep:true})` 对 `excel.rows`（上限 10000 行 × N 列）每次变更做深遍历 + 400ms 防抖后整体 stringify（可达数 MB），大名单编辑时会主线程停顿。建议改为「手动 bump 修订号 + 浅 watch」或只在结构性操作（import/clear/sort/filter）后持久化。

### M3. 照片以 base64 data URL 存内存 Map
- **文件**：`app/src/utils/photos.ts` `readAsDataURL`、`app/src/stores/workspace.ts` `photos`
- data URL 比二进制多 ~33% 体积且字符串常驻；改用 `URL.createObjectURL(file)` 可省内存与编码开销（注意组件卸载时 revoke）。若需保持可序列化兼容性，至少对未匹配/超大照片提前压缩。

### M4. `/api/admin/overview` 全量扫描 + 每用户 2 次 KV 读
- **文件**：`edge-functions/api/[[default]].js` 1632–1696
- 最多扫 20 页 × 256 用户（>5120 后 `totalUsers` 静默失真），且对每用户 `usage:`/`bonus:` 各读一次。用户量到数百后延迟会显著上升。建议：(a) overview 只读聚合计数器（注册时维护 `stat:users:total` 等），明细仍走分页接口；(b) 至少把用户数上限写进响应字段明示截断。

### M5. `[[default]].js` 单文件 1872 行 catch-all
- 路由表已长成线性 if 链（30+ 端点）。建议按域拆分为 `auth.ts / account.ts / quota.ts / share.ts / redeem.ts / admin.ts`（或合并为 3–4 个文件），共享上下文（kv/storageHeader/deferWrite/readBody）用小工厂函数传入。纯可维护性，一次搬迁。

### M6. 登录/重置 5xx 重试复用已消费的验证码
- **文件**：`app/src/stores/auth.ts` `login`/`resetPassword`（217–276 行）
- 服务端在密码校验前已 `markCaptchaUsed`；首个请求若到达函数但响应被网关 5xx 掉，后续重试会拿到 400「验证码已使用」，5 次退避全部浪费。建议：catch 到 `captcha:true` 类 400 时自动 `fetchCaptcha()` 换新令牌再重试一次，或直接给可操作的文案。

### M7. `/api/account/delete` 未清理 `reserve:`/`fb:` 中可关联的个人数据
- `usage:`/`bonus:`/`share:`/`tpl:` 已删（无 TTL 的用户数据都清了）；但团队预订 `reserve:*`（含邮箱）与反馈 `fb:*`（含 contact 字段）无 TTL 且未按邮箱反查删除。建议：预订/反馈写入时补 `reserve:byemail:<hash>` / `fb:byemail:<hash>` 索引键，注销时按索引清理；或在隐私政策明示「预订/反馈记录不随账号删除」。

---

## 三、低 ROI / 观察项

- **L1. `/api/redeem` 管理端批量生成兑换码**：每码一次串行 `kv.get` 碰撞预检，count=200 时 200 次串行读。码空间 31^12 碰撞概率可忽略，可删掉预检或 `mapConcurrent` 并行化（`[[default]].js` 1781–1789）。
- **L2. 计数器 read-modify-write 非原子**（quota/share/visit/rl:*）：KV 无原子增量，并发窗口内可能少计/超发 1 次。代码注释已如实标注「幂等而非严格原子」，业务影响可忽略，仅作记录。
- **L3. `defaultTemplates` 聚合 chunk 275.7KB（gzip 65KB）**：`/templates`、模板详情、`/studio` 同步依赖。可把模板注册表拆「元数据（名称/分类/缩略参数）+ 按需加载完整定义」两层，让模板墙页只拉元数据。当前 gzip 65KB 不算大，收益有限。
- **L4. `/en/seating` 1280px 下 Feedback 浮动按钮压座位图右缘 ~31×48px**（上轮遗留，本轮复确认代码结构：可在画布容器加右下避让 padding 或将按钮移入 NextStepBar 区域）。
- **L5. 前端 `verifyCaptcha` 早退占位**：限流 429 等提前返回会让该验证码令牌在同 isolate 内 5 分钟内被判「已使用」（代码注释已述）。用户刷新验证码即可，影响小。
- **L6. CSP 仅 `frame-ancestors 'self'`**：index.html 依赖多段内联脚本（?q= 剥离、统计延迟注入、boot splash），引入完整 CSP 成本高；可作为长期安全加固项。

## 实测数据备查（本地 vite build，r356 同基线）

| chunk | 原始 | gzip | 加载时机 |
|---|---|---|---|
| index（主包） | 172.6KB | 63.8KB | 首屏 |
| index.css | 91.6KB | 15.8KB | 首屏 |
| defaultTemplates | 275.7KB | 65.4KB | /studio、/templates、首页懒加载 |
| guides | 495.2KB | 175.6KB | 仅教程页 |
| templateDetails | 220.1KB | 79.5KB | 模板墙/详情页 |
| en 字典 | 204.0KB | 81.6KB | 仅 /en |
| vendor-xlsx | 499.6KB | 163.0KB | 导入时按需 |
| vendor-pdf | 617.6KB | 184.0KB | 导出时按需 |
| vendor-sentry | 461.4KB | 153.5KB | **每次首访 mount 后**（见 H2） |
| vendor-pinyin | 302.3KB | 138.8KB | 长字母拼音搜索时按需 |

PWA 预缓存 2.39MB（64 项，含 vendor-pdf/xlsx——离线可用是刻意设计，保持）。
