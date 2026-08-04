import { describe, expect, it, vi } from 'vitest'

import { apiFetch, ApiError, isValidEmail } from '@/utils/api'

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
})
