import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import {
  decodeSharedTemplate,
  encodeTemplateForShare,
  extractSharePayload,
  SHARE_HASH_PREFIX,
} from '@/utils/share'

const standard = defaultTemplates[0]!

describe('模板分享编解码', () => {
  it('编码-解码往返保持模板内容不变', async () => {
    const payload = await encodeTemplateForShare(standard)
    const decoded = await decodeSharedTemplate(payload)
    expect(decoded).toEqual(standard)
  })

  it('压缩后的负载只包含 URL 安全字符', async () => {
    const payload = await encodeTemplateForShare(standard)
    expect(payload).toMatch(/^v[01]\.[A-Za-z0-9\-_]+$/)
  })

  it('压缩明显小于原始 JSON', async () => {
    const payload = await encodeTemplateForShare(standard)
    const rawLength = JSON.stringify(standard).length
    expect(payload.length).toBeLessThan(rawLength)
  })

  it('v0 无压缩负载可以解码（降级路径）', async () => {
    const json = JSON.stringify(standard)
    const utf8 = new TextEncoder().encode(json)
    let binary = ''
    utf8.forEach((b) => (binary += String.fromCharCode(b)))
    const v0 = `v0.${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
    const decoded = await decodeSharedTemplate(v0)
    expect(decoded?.id).toBe(standard.id)
  })

  it('非法负载返回 null 而不是抛错', async () => {
    expect(await decodeSharedTemplate('v1.!!!not-base64!!!')).toBeNull()
    expect(await decodeSharedTemplate('v9.abc')).toBeNull()
    expect(await decodeSharedTemplate('')).toBeNull()
  })

  it('解码后校验模板结构，缺字段的 JSON 被拒绝', async () => {
    const bogus = new TextEncoder().encode(JSON.stringify({ name: '假模板' }))
    let binary = ''
    bogus.forEach((b) => (binary += String.fromCharCode(b)))
    const payload = `v0.${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
    expect(await decodeSharedTemplate(payload)).toBeNull()
  })
})

describe('extractSharePayload', () => {
  it('识别 #tpl= 前缀', () => {
    expect(extractSharePayload(`${SHARE_HASH_PREFIX}v1.abc`)).toBe('v1.abc')
  })

  it('其他 hash 返回 null', () => {
    expect(extractSharePayload('#section-2')).toBeNull()
    expect(extractSharePayload('')).toBeNull()
    expect(extractSharePayload(SHARE_HASH_PREFIX)).toBeNull()
  })
})
