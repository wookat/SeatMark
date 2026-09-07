/**
 * edge-functions/api/_http.js：限频用 clientIp 只信任 EO-Connecting-IP，不回退可伪造的 X-Forwarded-For。
 */
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore JS 模块无类型声明
import { clientIp, clientIpSource } from '../../../edge-functions/api/_http.js'

function req(headers: Record<string, string>) {
  return new Request('https://www.seatmark.cn/api/announcement', { headers })
}

describe('第 353 轮：clientIp 不再信任 X-Forwarded-For', () => {
  it('有 EO-Connecting-IP 时返回该值（XFF 同时存在也不影响）', () => {
    expect(clientIp(req({ 'EO-Connecting-IP': '203.0.113.9', 'X-Forwarded-For': '198.51.100.7' }))).toBe(
      '203.0.113.9',
    )
    expect(clientIp(req({ 'EO-Connecting-IP': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('只有 X-Forwarded-For、无 EO 头 → "none"（共用同一保守限频桶，不可伪造绕过）', () => {
    expect(clientIp(req({ 'X-Forwarded-For': '198.51.100.7, 10.0.0.1' }))).toBe('none')
    expect(clientIp(req({ 'X-Forwarded-For': '1.1.1.1' }))).toBe('none')
    expect(clientIp(req({}))).toBe('none')
  })

  it('clientIpSource 诊断口径不变：eo / xff / none', () => {
    expect(clientIpSource(req({ 'EO-Connecting-IP': '203.0.113.9' }))).toBe('eo')
    expect(clientIpSource(req({ 'X-Forwarded-For': '198.51.100.7' }))).toBe('xff')
    expect(clientIpSource(req({}))).toBe('none')
  })

  it('伪造不同 XFF 的两次请求落在同一限频键', () => {
    const a = clientIp(req({ 'X-Forwarded-For': '10.0.0.1' }))
    const b = clientIp(req({ 'X-Forwarded-For': '10.0.0.2' }))
    expect(`rl:ip:${a}`).toBe(`rl:ip:${b}`)
  })
})
