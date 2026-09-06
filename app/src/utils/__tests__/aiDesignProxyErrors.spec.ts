import { describe, expect, it } from 'vitest'

import { AiHttpError, proxyRejectionMessage } from '../aiDesign'

describe('proxyRejectionMessage', () => {
  it('413 提示请求过长', () => {
    expect(proxyRejectionMessage(new AiHttpError(413, 'HTTP 413'))).toContain('32KB')
  })

  it('429 带 Retry-After 换算为分钟', () => {
    const msg = proxyRejectionMessage(new AiHttpError(429, 'HTTP 429', 1500))
    expect(msg).toContain('25 分钟')
    expect(msg).toContain('每小时最多 30 次')
  })

  it('429 无 Retry-After 用通用提示', () => {
    expect(proxyRejectionMessage(new AiHttpError(429, 'HTTP 429'))).toContain('请稍后再试')
  })

  it('其他状态与普通错误返回 null（继续走兜底接口）', () => {
    expect(proxyRejectionMessage(new AiHttpError(502, 'HTTP 502'))).toBeNull()
    expect(proxyRejectionMessage(new Error('boom'))).toBeNull()
  })
})
