import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import {
  decodeSharedTemplate,
  encodeTemplateForShare,
  extractSharePayload,
  SHARE_DECODED_MAX_BYTES,
  SHARE_HASH_PREFIX,
  SHARE_PAYLOAD_MAX_CHARS,
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

  describe('第 372 轮：解码资源预算', () => {
    it('内置模板负载远小于字符上限（上限不影响真实分享）', async () => {
      const payloads = await Promise.all(defaultTemplates.map((tpl) => encodeTemplateForShare(tpl)))
      const longest = Math.max(...payloads.map((p) => p.length))
      expect(longest).toBeLessThan(SHARE_PAYLOAD_MAX_CHARS / 10)
      expect(SHARE_PAYLOAD_MAX_CHARS).toBe(256 * 1024)
      expect(SHARE_DECODED_MAX_BYTES).toBe(4 * 1024 * 1024)
    })

    it('超长负载（> SHARE_PAYLOAD_MAX_CHARS）直接返回 null，不进入解码', async () => {
      const valid = await encodeTemplateForShare(standard)
      const oversized = valid + 'A'.repeat(SHARE_PAYLOAD_MAX_CHARS - valid.length + 1)
      expect(oversized.length).toBe(SHARE_PAYLOAD_MAX_CHARS + 1)
      expect(await decodeSharedTemplate(oversized)).toBeNull()
      expect(await decodeSharedTemplate(`v0.${'A'.repeat(SHARE_PAYLOAD_MAX_CHARS)}`)).toBeNull()
    })

    it('高压缩比 v1 负载（解压后 > SHARE_DECODED_MAX_BYTES）解压中途被截断→ null；未超限的大负载仍能解码', async () => {
      const inflate = async (bytes: number) => {
        const json = JSON.stringify({ ...standard, name: 'x'.repeat(bytes) })
        const utf8 = new TextEncoder().encode(json)
        const source = new ReadableStream<BufferSource>({
          start(controller) {
            controller.enqueue(utf8)
            controller.close()
          },
        })
        const compressed = new Uint8Array(
          await new Response(source.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(),
        )
        let binary = ''
        for (let i = 0; i < compressed.length; i += 0x8000) {
          binary += String.fromCharCode(...compressed.subarray(i, Math.min(i + 0x8000, compressed.length)))
        }
        return { payload: `v1.${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`, utf8 }
      }

      const bomb = await inflate(SHARE_DECODED_MAX_BYTES + 1024)
      expect(bomb.utf8.length).toBeGreaterThan(SHARE_DECODED_MAX_BYTES)
      expect(bomb.payload.length).toBeLessThan(SHARE_PAYLOAD_MAX_CHARS)
      expect(await decodeSharedTemplate(bomb.payload)).toBeNull()

      const large = await inflate(512 * 1024)
      expect(large.utf8.length).toBeLessThan(SHARE_DECODED_MAX_BYTES)
      const decoded = await decodeSharedTemplate(large.payload)
      expect(decoded?.id).toBe(standard.id)
    })
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
