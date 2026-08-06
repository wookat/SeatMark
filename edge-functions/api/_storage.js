/**
 * SeatMark 存储抽象：KV → Blob → 内存 三级后备
 *
 * - KV（seatmark_kv 绑定）：首选，读写延迟最低。
 * - EdgeOne Pages Blob（@edgeone/pages-blob）：KV 未绑定时的持久化后备，
 *   getStore 首次调用自动创建，无需控制台绑定。读取默认 strong 一致性
 *   （验证码/配额/会话等强一致场景必须读到最新写入）。
 * - 内存 Map：仅本地联调兜底，跨 isolate 不一致，线上不应命中。
 *
 * 云端模板（tpl: 前缀）体积大（上限 512KB），即使 KV 已绑定也优先走 Blob，
 * 读取时保留 KV 旧数据兜底以兼容存量用户。
 */

const memoryStore = new Map()

const BLOB_STORE_NAME = 'seatmark-kv'

/** 与 KV 接口对齐的内存实现 */
function memoryKv(store = memoryStore) {
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value) {
      store.set(key, String(value))
    },
    async delete(key) {
      store.delete(key)
    },
    async list({ prefix = '', limit = 256, cursor = '' } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort()
      const start = cursor ? keys.indexOf(cursor) + 1 : 0
      const page = keys.slice(start, start + limit)
      return {
        keys: page.map((name) => ({ name })),
        complete: start + limit >= keys.length,
        cursor: page.length ? page[page.length - 1] : '',
      }
    },
  }
}

/** 把 Blob Store 适配成 KV 接口（get/put/delete/list），读取一律 strong */
function blobKv(store) {
  return {
    async get(key) {
      return store.get(key, { consistency: 'strong' })
    },
    async put(key, value) {
      await store.set(key, String(value))
    },
    async delete(key) {
      await store.delete(key)
    },
    async list({ prefix = '', limit = 256, cursor = '' } = {}) {
      const result = await store.list({
        prefix,
        limit,
        cursor: cursor || undefined,
        paginate: false,
        consistency: 'strong',
      })
      return {
        keys: (result.blobs || []).map((b) => ({ name: b.key })),
        complete: !result.cursor,
        cursor: result.cursor || '',
      }
    },
  }
}

/**
 * 获取 Blob Store 实例。
 * - env.seatmark_blob：测试/本地联调注入的模拟 Store（与 @edgeone/pages-blob Store 同接口）
 * - 生产：动态 import SDK；本地未安装依赖或凭证缺失时返回 null（降级内存）
 */
async function getBlobStore(env) {
  if (env && env.seatmark_blob && typeof env.seatmark_blob.get === 'function') {
    return env.seatmark_blob
  }
  try {
    // SDK 仅存在于 EdgeOne 运行时；用变量说明符绕过 Vite 静态解析，本地无此依赖走 catch 降级
    const specifier = '@edgeone/pages-blob'
    const { getStore } = await import(/* @vite-ignore */ specifier)
    return getStore(BLOB_STORE_NAME)
  } catch {
    return null
  }
}

/**
 * 统一存储入口：返回 { kv, storage, blobStore }
 * - kv：KV 接口（KV 绑定 → Blob 适配 → 内存）
 * - storage：'kv' | 'blob' | 'memory'（响应头 X-SeatMark-Storage 用）
 * - blobStore：原始 Blob Store（可用时；供模板等大对象场景直连）
 */
export async function getStorage(env) {
  const bound =
    (env && env.seatmark_kv) ||
    (typeof globalThis !== 'undefined' ? globalThis.seatmark_kv : undefined)
  const blobStore = await getBlobStore(env)
  if (bound && typeof bound.get === 'function') {
    return { kv: bound, storage: 'kv', blobStore }
  }
  if (blobStore) {
    return { kv: blobKv(blobStore), storage: 'blob', blobStore }
  }
  return { kv: memoryKv(), storage: 'memory', blobStore: null }
}

/** Blob 可用性探测（健康检查用）：写→强一致读→删 */
export async function probeBlob(blobStore) {
  if (!blobStore) return false
  const key = `health:probe:${Date.now()}`
  try {
    await blobStore.set(key, 'ok')
    const value = await blobStore.get(key, { consistency: 'strong' })
    await blobStore.delete(key)
    return value === 'ok'
  } catch {
    return false
  }
}
