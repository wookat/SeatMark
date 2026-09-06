import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  API_TIMEOUT_MESSAGE,
  API_TIMEOUT_MS,
  API_TIMEOUT_STATUS,
  apiFetch,
  ApiError,
  isValidEmail,
} from '@/utils/api'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('isValidEmail（前后端一致的邮箱校验）', () => {
  it('接受常见邮箱', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('a.b+c@sub.domain.cn')).toBe(true)
  })

  it('拒绝非法邮箱', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('user')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user@domain')).toBe(false)
    expect(isValidEmail('us er@a.com')).toBe(false)
    expect(isValidEmail(`${'a'.repeat(250)}@b.com`)).toBe(false)
  })
})

describe('apiFetch', () => {
  it('非 2xx 时抛出带服务端 error 文案的 ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: '请先登录' }), { status: 401 }),
    )
    await expect(apiFetch('/api/quota/consume', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      message: '请先登录',
    })
    const err = await apiFetch('/api/quota/consume', { method: 'POST' }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('2xx 时返回 JSON 数据', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, remaining: 9 }), { status: 200 }),
    )
    const data = await apiFetch<{ ok: boolean; remaining: number }>('/api/quota/consume', {
      method: 'POST',
    })
    expect(data.remaining).toBe(9)
  })

  it('15s 无响应时中止请求并抛出 408 超时 ApiError', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_input, init) => {
        signal = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      })
    const pending = apiFetch('/api/auth/me')
    const settled = pending.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS - 1)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const err = await settled
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: API_TIMEOUT_STATUS, message: API_TIMEOUT_MESSAGE })
    expect(signal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('响应及时到达时不触发超时', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const data = await apiFetch<{ ok: boolean }>('/api/auth/me')
    expect(data.ok).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
