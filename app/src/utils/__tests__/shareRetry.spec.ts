/**
 * 短码分享的 5xx 自动重试（指数退避）：
 * /api/share/tpl 偶发 545 属瞬时抖动，前端自动重试 1–2 次后再降级。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/utils/api'

const apiFetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api')>()
  return { ...actual, apiFetch: apiFetchMock }
})

import { createShortShareCode, fetchSharedPayload } from '@/utils/share'

describe('短码分享 5xx 自动重试', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('545 后自动重试并成功（指数退避）', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError(545, 'edge storage error'))
      .mockResolvedValueOnce({ code: '0123456789' })

    const promise = createShortShareCode('v1.abc')
    await vi.runAllTimersAsync()
    expect(await promise).toBe('0123456789')
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('连续 5xx 重试 2 次后仍失败返回 null（共 3 次请求）', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, 'server error'))

    const promise = createShortShareCode('v1.abc')
    await vi.runAllTimersAsync()
    expect(await promise).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledTimes(3)
  })

  it('4xx 客户端错误不重试，直接返回 null', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(400, '模板负载无效'))

    const promise = createShortShareCode('v1.abc')
    await vi.runAllTimersAsync()
    expect(await promise).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('网络异常（非 ApiError）会重试', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ payload: 'v1.xyz' })

    const promise = fetchSharedPayload('0123456789')
    await vi.runAllTimersAsync()
    expect(await promise).toBe('v1.xyz')
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('短码不存在（404）不重试', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, '短码不存在或已过期'))

    const promise = fetchSharedPayload('0123456789')
    await vi.runAllTimersAsync()
    expect(await promise).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })
})
