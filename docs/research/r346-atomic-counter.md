# r346 调研：EdgeOne KV / Blob 计数原子性（CAS / 条件写 / 原子自增）

调研日期：2026-09-07。结论标注约定：**[直接实证]** = 本机读源码/类型定义或真实请求得到；**[文档转述]** = 官方文档原文；**[推断]** = 基于以上证据的推理，未经生产验证。

## 0. 结论（一句话）

- Pages Blob（`@edgeone/pages-blob@0.0.15`）**只提供 create-if-absent 条件写**（`set(key, v, { onlyIfNew: true })` → `If-None-Match: *` → 412 → `PreconditionFailedError`），**没有** etag/`ifMatch` 形式的 CAS，**没有** 原子自增。[直接实证]
- Pages KV（`seatmark_kv` 绑定）API 仅 `get/put/delete/list`，无任何条件写、无原子自增，且为最终一致（边缘缓存最长 60 s）。[文档转述]
- 生产当前实际后端是 **blob**（`x-seatmark-storage: blob`，2026-09-07 `curl -sI https://www.seatmark.cn/api/announcement`）。[直接实证]
- 因此 P7(b) 要求的「读 → 同键条件写 → 冲突重试 ≤3 → 仍冲突 429」**无法按原设计落地**（同键 update-CAS 不存在）。本轮 **不改 `/api/quota/consume` 代码**，只落本文档与替代方案；替代方案「槽位认领」可用 `onlyIfNew` 正确实现，但其 412 路径在本机无法实测（无 EdgeOne 凭据），需下一轮先在生产做受控探针再落码。

## 1. 证据链

### 1.1 `@edgeone/pages-blob@0.0.15` 类型定义 [直接实证]

来源：`npm install @edgeone/pages-blob@0.0.15` 后 `node_modules/@edgeone/pages-blob/dist/index.d.ts`（仓库根 `package.json` 依赖 `^0.0.15`；`app/node_modules` 不含该包，需在仓库根或临时目录安装）。

```ts
export interface SetOptions {
  /** Conditional write: only write if the key does not already exist */
  onlyIfNew?: boolean;
  cacheControl?: string | null;
}
export declare class Store {
  set(key: string, value: BlobInput, options?: SetOptions): Promise<void>;
  setJSON(key: string, value: unknown, options?: SetOptions): Promise<void>;
  get(key: string, options?: { type?: ...; consistency?: ConsistencyMode }): Promise<...>;
  getMetadata(key, options?): Promise<{ cacheControl?, contentType?, etag?, headers? } | null>;
  getWithHeaders(key, options?): Promise<{ body: string; headers: Record<string, string> } | null>;
  delete(key: string): Promise<void>;
  list(options?: ListOptions): Promise<ListResult>;   // blobs: { key, etag }[]
  createUploadUrl(key, options?): Promise<CreateUploadUrlResult>;
}
export declare class PreconditionFailedError extends PagesBlobError { constructor(); }
```

- `SetOptions` 只有 `onlyIfNew` 与 `cacheControl`；**没有** `ifMatch` / `etag` / `expectedEtag` 一类参数。
- `etag` 只在读侧（`getMetadata`、`list`）暴露，无法带回写侧，故不构成 CAS。
- 没有 `increment` / `incr` / `add` 等原子计数 API。

### 1.2 `dist/index.js` 实现 [直接实证]

```js
async set(e, r, n) { ...putObject(..., { onlyIfNew: n?.onlyIfNew, ... });
  if (n?.onlyIfNew && s.statusCode === 412) throw new x /* PreconditionFailedError */ }
// putObject:
s?.onlyIfNew && (u["If-None-Match"] = "*")
if (l.status === 412) return { etag: "", statusCode: 412 }
```

- 写路径固定走 strong 域名（`blob-nocache.edgeone.site`），底层是腾讯 COS PUT Object。
- 仅注入 `If-None-Match: *`，源码中没有任何 `If-Match` 注入点。
- `PreconditionFailedError` 消息为 `conditional write failed (key already exists)`，即 412 语义仅覆盖「已存在」。

### 1.3 官方文档 [文档转述]

- Blob：<https://pages.edgeone.ai/document/blob-storage> —— `options.onlyIfNew`: "Writes only when the Key does not exist if set to `true`"；章节标题为 "Conditional Write (Prevent Overwrite)"。未提及 If-Match/etag 条件更新或原子自增。
- KV：<https://edgeone.ai/document/162227803822321664>（中文 <https://edgeone.cloud.tencent.com/pages/document/162936897742577664>）—— API 仅 `put(key, value)` / `get(key, {type})` / `delete(key)` / `list({prefix, limit, cursor})`；"follows final consistency and ensures global sync access within 60s"。官方「计数器」示例本身就是非原子的 `get → Number+1 → put`。
- KV 架构说明（Makers 文档 <https://pages.edgeone.ai/document/kv-storage>）："A write operation only updates the cache of the node that initiated the request. Other nodes may still read stale values for up to 60 seconds. If your business requires immediate global consistency, use the strong consistency mode of Blob storage."

### 1.4 SeatMark 存储适配层 [直接实证]

`edge-functions/api/_storage.js`：KV 绑定 → Blob（`getStore`，读取一律 `consistency: 'strong'`）→ 内存三级降级；统一成 `get/put/delete/list` 四个方法，`put(key, value)` 不透传任何 options，因此**当前代码路径没有任何条件写被使用**。

## 2. 计数点清单（读→改→写，非原子）

统计方法：`grep -n "getCounter(kv\|kv.put(" edge-functions/api/[[default]].js` 后逐处人工核对为「先读再写派生值」的序列。行号为 r346 分支当前行号。

> 注：轮次方案中提到「56 处 get→put 计数点」，该数字来自方案文本 **[报告转述]**；按上述方法本轮实查到 **13 处**读-改-写序列（`kv.put` 共 28 处，其余为整对象覆写/一次性写入，不是计数）。两者口径不同，不互相替代。

| # | 键 | 位置 | 类别 | 竞争窗口内后果 | 风险量级 |
|---|----|------|------|---------------|---------|
| 1 | `usage:<email>:<date>` | `/api/quota/consume` L1316→L1320 | quota/consume | 同一登录用户并发两次导出，各自读到 used=n 后都写 n+1 → 少计 1 次，多放行 1 次无水印导出 | **中低**：需同一账号同一秒双击/双标签；注册用户前 7 天为专业版（不走此计数）；客户端 5xx 时还有本地计数兜底 |
| 2 | `bonus:<owner>:<date>` | `/api/share/visit` L1415→L1418 | share bonus | 同一分享码被两个 IP 同时首访，奖励少计；只会**少给**不会多给（`SHARE_BONUS_DAILY_CAP` 仍按读值判定，极端下可多给 1） | 低 |
| 3 | `sharestat:visits:<code>` | L1408–1411 | share stat | 统计少计 | 低（仅展示） |
| 4 | `sharestat:bonus:<code>` | L1419–1421 | share stat | 统计少计 | 低（仅展示） |
| 5 | `pwfail:<email>` (JSON.count) | `/api/auth/login` L1056→L1082 | pwfail | 并发错密码少计 1 次，锁定阈值 10 次可被放宽到 10+k（k=并发度） | **中**：暴力破解者可并发放大；但同时受 #6 `rl:ip` 与图形验证码每次必答限制 |
| 6 | `rl:ip:<iphash>:<date>` | `/api/auth/code` L875→L899；`/api/auth/login` L1111→L1130 | rl:* | IP 日限（20）可被并发放宽 | 低（发码有邮件通道成本上限；登录另受 #5） |
| 7 | `rl:reg:<iphash>:<date>` | `/api/auth/register` L986→L990 | rl:* | 注册 IP 日限放宽 | 低 |
| 8 | `rl:redeem:<iphash>:<date>` | `/api/redeem` L1336→L1344/1350 | rl:* | 兑换码枚举限频放宽 | 低（码空间 31^12，哈希存储） |
| 9 | `rl:tplshare:<iphash>:<date>` | `/api/share/tpl` L1438→L1446 | rl:* | 短码生成限频放宽 | 低 |
| 10 | `rl:reserve:<iphash>:<date>` | `/api/team/reserve` L1483→L1487 | rl:* | 预订限频放宽 | 低 |
| 11 | `auth:code` 记录 `attempts` | `/api/auth/verify` L938–944 | 验证码试错 | 并发猜码可略超 5 次上限 | 低（6 位码 10 分钟、发码限频） |
| 12 | `reset:code` 记录 `attempts` | `/api/auth/reset-password` L1188–1194 | 验证码试错 | 同上 | 低 |
| 13 | `redeem:<sha256>` 记录 `usedBy` | `/api/redeem` L1364–1372 | 兑换核销 | 已用「两段式认领 + 60 ms 回读确认」收窄；仍是 [推断] 非严格互斥 | 低（已有缓解） |

`sharevisit:<code>:<iphash>:<date>` 去重键（L1404–1406）是「读存在性→写 1」，属同类竞争但只影响 #2–#4 的少计，不单列。

## 3. 为什么本轮不改 `/api/quota/consume`

1. **同键 CAS 不存在** [直接实证]：方案要求「读 → 条件写 → 冲突重试」隐含对**已存在键**做条件更新；Blob 仅有 `If-None-Match: *`，对已存在键必然 412，无法表达「期望旧值为 n」。KV 连 create-if-absent 都没有。
2. **可行的替代实现需要改键布局与存储抽象**（见 §4），不是方案划定的「1298–1310 行局部改动」，且其正确性依赖生产 COS 对 `If-None-Match: *` 返回 412 这一行为——SDK 源码与文档均如此声明 [直接实证/文档转述]，但本机无 EdgeOne 部署凭据，**未在生产实测过 412 路径** [未验证]。按「先调查再发言」原则，不在未验证前把配额放行路径切到新机制。
3. 风险量级为中低（表 §2 #1）：受影响的只有免费用户当天 3 次无水印额度，且需同账号并发；不是 P0 级资损。

## 4. 替代方案建议（供下一轮选择）

### 4.1 服务端：Blob `onlyIfNew` 槽位认领（推荐，需先探针）

```text
consume(email, date):
  for attempt in 1..3:
    n = getCounter(`usage:${email}:${date}`)          # 摘要键，strong 读
    if n >= limit: 429
    ok = kv.put(`usage:${email}:${date}:s${n+1}`, ts, { onlyIfNew: true })   # 认领第 n+1 个槽位
    if ok:
      kv.put(`usage:${email}:${date}`, String(n+1))   # 摘要键 best-effort 前推
      return 200 (used = n+1)
    # 412：有人先占了 s${n+1}
    n' = count(kv.list({ prefix: `usage:${email}:${date}:s` }))   # 以槽位数为准校正摘要
    kv.put(`usage:${email}:${date}`, String(n'))
  return 429（冲突耗尽，fail-closed，不放行）
```

- 正确性依赖：同一 key 的 `If-None-Match: *` PUT 在并发下**至多一个成功**（COS 端保证）[文档转述，未生产验证]。
- 需要的改动：`_storage.js` 的 `put(key, value, opts?)` 透传 `onlyIfNew`，Blob 分支捕获 `PreconditionFailedError` 返回 `false`，内存分支用 `Map.has` 模拟；**KV 分支不支持时返回 `null`，调用方退回现有 get→put 路径**（KV 无条件写，无法更好）。
- 读侧（`quotaStatus`、admin overview、`/api/quota`）继续读摘要键，不受影响。
- 落码前必做：在生产用管理员专用诊断路由（或一次性脚本）对临时键 `probe:<random>` 并发 2 次 `onlyIfNew` 写，断言恰好 1 次成功 1 次 412，并记录到测试报告。

### 4.2 兑换核销复用同一机制

`redeem:<sha256>` 的两段式认领可改为认领键 `redeemclaim:<sha256>` 的 `onlyIfNew` 写，一步互斥，去掉 60 ms 回读。同样受 §4.1 前置探针约束。

### 4.3 客户端序列化导出（零平台依赖，可立即做）

`app/src/stores/quota.ts` `tryConsume()` 增加进程内互斥（同一标签页内 consume 串行）；多标签页可用 `navigator.locks.request('seatmark-consume', ...)`（Web Locks API，现代浏览器均支持）。这能消除同一浏览器内的并发双发，只剩多设备同账号并发——对免费额度场景已足够。

### 4.4 `rl:*` / `pwfail` 按分片键加总

限频类计数改为 `rl:<name>:<iphash>:<date>:<0..3>` 随机分片写、读时四片求和：不消除竞争，但把并发放大上限从 k 次压到 k/4 量级 [推断]。收益有限，仅在 §4.1 不可用时考虑。

### 4.5 不建议

- 迁移 Cloudflare Workers KV/Durable Objects 或引入外部 Redis：与「EdgeOne Pages 单平台、零外部依赖」的现状冲突，成本远高于风险量级。

## 5. 未验证项（明示）

- 生产 COS 对 `If-None-Match: *` 的并发互斥行为（只有 SDK/文档声明）。
- Blob `list` 的 strong 读在写入后立刻可见槽位键（文档称 strong 保证 read-after-write，未在生产实测）。
- 「56 处计数点」的原始统计口径。
