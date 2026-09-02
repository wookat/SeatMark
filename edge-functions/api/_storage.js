/**
 * SeatMark 存储抽象：KV → Blob → 内存 三级后备
 *
 * - KV（seatmark_kv 绑定）：首选，读写延迟最低。
 * - EdgeOne Pages Blob（@edgeone/pages-blob）：KV 未绑定时的持久化后备，
 *   getStore 首次调用自动创建，无需控制台绑定。读取默认 strong 一致性
 *   （验证码/配额/会话等强一致场景必须读到最新写入）。
 * - 内存 Map：仅本地联调兜底，跨 isolate 不一致。线上（非开发环境且未显式设置
 *   ALLOW_MEMORY_STORAGE=1）不再静默降级，而是抛出 StorageUnavailableError，
 *   由调用方对写操作返回 503，避免验证码/兑换/配额等写入无声丢失。
 *
 * 云端模板（tpl: 前缀）体积大（上限 512KB），即使 KV 已绑定也优先走 Blob，
 * 读取时保留 KV 旧数据兜底以兼容存量用户。
 */

import { isDevEnvironment } from './_security.js'

const memoryStore = new Map()

/** KV 与 Blob 均不可用且不允许内存降级时抛出 */
export class StorageUnavailableError extends Error {
  constructor() {
    super('持久化存储不可用（KV/Blob 均未绑定）')
    this.name = 'StorageUnavailableError'
    this.code = 'storage_unavailable'
  }
}

/** 是否允许降级到进程内存：显式开关或开发环境 */
export function memoryStorageAllowed(env, hostname) {
  return Boolean(env && env.ALLOW_MEMORY_STORAGE === '1') || isDevEnvironment(env, hostname)
}

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
let blobStorePromise = null

async function getBlobStore(env) {
  if (env && env.seatmark_blob && typeof env.seatmark_blob.get === 'function') {
    return env.seatmark_blob
  }
  if (blobStorePromise) return blobStorePromise
  blobStorePromise = loadBlobStore()
  return blobStorePromise
}

async function loadBlobStore() {
  try {
    // 字面量说明符让 EdgeOne 构建器能静态收集依赖并打包进函数产物
    // （变量说明符会被打包器跳过，线上运行时解析失败而静默降级内存）；
    // 本地/测试环境无此依赖时 import 拒绝，走 catch 降级
    const { getStore } = await import('@edgeone/pages-blob')
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
 * - options.hostname：请求 host，用于开发环境判定；非开发环境且未设
 *   ALLOW_MEMORY_STORAGE=1 时两级持久化均不可用会抛 StorageUnavailableError
 */
export async function getStorage(env, options = {}) {
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
  if (!memoryStorageAllowed(env, options.hostname)) throw new StorageUnavailableError()
  return { kv: memoryKv(), storage: 'memory', blobStore: null }
}

/**
 * 存储不可用时的只读替身：读一律返回空，写抛 StorageUnavailableError，
 * 让 health/公开只读接口仍可响应，而任何写路径都 fail-closed。
 */
export function unavailableKv() {
  const fail = async () => {
    throw new StorageUnavailableError()
  }
  return {
    async get() {
      return null
    },
    put: fail,
    delete: fail,
    async list() {
      return { keys: [], complete: true, cursor: '' }
    },
  }
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
