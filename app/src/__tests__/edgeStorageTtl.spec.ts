/**
 * edge-functions/api/_storage.js：Blob / 内存后端的 expirationTtl 包装值语义。
 * - 有 TTL 写入 → 到期前可读 → 到期后读为 null 并触发 delete
 * - 存量裸字符串（无包装）仍可读
 * - 非包装的 `{"v":…}` 形态 JSON 不被误解包
 * - memory 降级 fail-closed 行为不变（由 edgeApi.spec 覆盖，此处只验 unwrap 不吞值）
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { getStorage, unwrapTtl } from '../../../edge-functions/api/_storage.js'

interface Kv {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>
}

function createMockBlobStore() {
  const data = new Map<string, string>()
  const deletes: string[] = []
  return {
    data,
    deletes,
    async get(key: string) {
      return data.has(key) ? (data.get(key) as string) : null
    },
    async set(key: string, value: string) {
      data.set(key, String(value))
    },
    async delete(key: string) {
      deletes.push(key)
      data.delete(key)
    },
    async list({ prefix = '', limit = 1000 }: { prefix?: string; limit?: number } = {}) {
      const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit)
      return { blobs: keys.map((key) => ({ key, etag: '' })), directories: [] }
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('blobKv expirationTtl', () => {
  it('有 TTL 写入：到期前可读原值，到期后读为 null 并异步 delete', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T00:00:00Z'))
    const blob = createMockBlobStore()
    const { kv, storage } = (await getStorage({ seatmark_blob: blob })) as { kv: Kv; storage: string }
    expect(storage).toBe('blob')

    await kv.put('rl:ip:abc:2026-09-07', '3', { expirationTtl: 60 })
    // 落盘为包装值
    const stored = JSON.parse(blob.data.get('rl:ip:abc:2026-09-07')!) as { v: string; exp: number }
    expect(stored.v).toBe('3')
    expect(stored.exp).toBe(Date.now() + 60_000)

    vi.setSystemTime(Date.now() + 59_000)
    expect(await kv.get('rl:ip:abc:2026-09-07')).toBe('3')
    expect(blob.deletes).toEqual([])

    vi.setSystemTime(Date.now() + 2_000)
    expect(await kv.get('rl:ip:abc:2026-09-07')).toBeNull()
    await vi.runAllTimersAsync()
    expect(blob.deletes).toEqual(['rl:ip:abc:2026-09-07'])
    expect(blob.data.has('rl:ip:abc:2026-09-07')).toBe(false)
  })

  it('无 TTL 写入仍存裸字符串；存量裸字符串与存量 JSON 记录可读且不被改写', async () => {
    const blob = createMockBlobStore()
    const { kv } = (await getStorage({ seatmark_blob: blob })) as { kv: Kv }
    await kv.put('user:a@example.com', '{"email":"a@example.com"}')
    expect(blob.data.get('user:a@example.com')).toBe('{"email":"a@example.com"}')
    blob.data.set('legacy:count', '7')
    blob.data.set('legacy:json', JSON.stringify({ exp: 123, code: '000000' }))
    expect(await kv.get('legacy:count')).toBe('7')
    expect(await kv.get('legacy:json')).toBe(JSON.stringify({ exp: 123, code: '000000' }))
    expect(await kv.get('missing')).toBeNull()
    expect(blob.deletes).toEqual([])
  })

  it('expirationTtl 非法（0/负数/NaN）视为无 TTL', async () => {
    const blob = createMockBlobStore()
    const { kv } = (await getStorage({ seatmark_blob: blob })) as { kv: Kv }
    await kv.put('a', '1', { expirationTtl: 0 })
    await kv.put('b', '2', { expirationTtl: -5 })
    await kv.put('c', '3', { expirationTtl: Number.NaN })
    expect(blob.data.get('a')).toBe('1')
    expect(blob.data.get('b')).toBe('2')
    expect(blob.data.get('c')).toBe('3')
  })
})

describe('memoryKv expirationTtl（与 blobKv 同语义）', () => {
  it('有 TTL 写入到期后读为 null 且键被删除；无 TTL 值原样', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T00:00:00Z'))
    const { kv, storage } = (await getStorage({})) as { kv: Kv; storage: string }
    expect(storage).toBe('memory')
    const key = `captcha:used:ttl-${Date.now()}`
    await kv.put(key, '{"exp":1}', { expirationTtl: 300 })
    await kv.put(`${key}:plain`, 'plain')
    expect(await kv.get(key)).toBe('{"exp":1}')
    vi.setSystemTime(Date.now() + 301_000)
    expect(await kv.get(key)).toBeNull()
    expect((await kv.list({ prefix: key })).keys.map((k) => k.name)).toEqual([`${key}:plain`])
    expect(await kv.get(`${key}:plain`)).toBe('plain')
  })
})

describe('unwrapTtl 只解包严格形态的包装值', () => {
  it('缺 exp / 多余键 / v 非字符串 / 非 JSON 一律原样返回', () => {
    for (const raw of [
      '{"v":"x"}',
      '{"v":"x","exp":1,"extra":true}',
      '{"v":1,"exp":1}',
      '{"v":"x","exp":"1"}',
      '{"v":',
      'plain',
      '{"email":"a@b.c"}',
    ]) {
      expect(unwrapTtl(raw)).toEqual({ value: raw, expired: false })
    }
    expect(unwrapTtl(null)).toEqual({ value: null, expired: false })
  })

  it('未过期包装值返回内部字符串，已过期返回 null + expired', () => {
    const future = JSON.stringify({ v: 'inner', exp: Date.now() + 10_000 })
    const past = JSON.stringify({ v: 'inner', exp: Date.now() - 10 })
    expect(unwrapTtl(future)).toEqual({ value: 'inner', expired: false })
    expect(unwrapTtl(past)).toEqual({ value: null, expired: true })
  })
})
