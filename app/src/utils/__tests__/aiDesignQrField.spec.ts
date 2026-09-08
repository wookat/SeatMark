import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setLocale } from '@/i18n'
import { generateLabelDesign, loadAiConfig, saveAiConfig } from '../aiDesign'

function aiReply(fields: unknown[]): Response {
  const content = JSON.stringify({ fields })
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

const INPUT = {
  fields: [{ label: '准考证号', samples: ['2025053002'], isPhoto: false }],
  requirements: '',
  labelWidth: 60,
  labelHeight: 32,
}

describe('AI 设计结果清洗 · 字段类型', () => {
  const fetchMock = vi.fn()
  beforeEach(async () => {
    localStorage.clear()
    saveAiConfig({ provider: 'free', baseUrl: '', apiKey: '', model: '' })
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    await setLocale('zh')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('qr 字段保留类型与尺寸，不带文字样式，id 前缀为 qr', async () => {
    fetchMock.mockResolvedValue(
      aiReply([
        { id: '!!', label: '准考证二维码', type: 'qr', x: 40, y: 8, width: 16, height: 16, fontSize: 30, padding: 1 },
      ]),
    )
    const result = await generateLabelDesign(loadAiConfig(), INPUT)
    expect(result.fields).toHaveLength(1)
    const qr = result.fields[0]!
    expect(qr.type).toBe('qr')
    expect(qr.id.startsWith('qr')).toBe(true)
    expect(qr.width).toBe(16)
    expect(qr.height).toBe(16)
    expect(qr.padding).toBe(1)
    expect(qr.fontSize).toBeUndefined()
    expect(qr.fontWeight).toBeUndefined()
  })

  it('image 分支不受影响，未知类型回落为 text', async () => {
    fetchMock.mockResolvedValue(
      aiReply([
        { id: 'photo', label: '照片', type: 'image', x: 0, y: 0, width: 20, height: 25 },
        { id: 'x', label: '条码', type: 'barcode', x: 0, y: 0, width: 20, height: 8 },
      ]),
    )
    const result = await generateLabelDesign(loadAiConfig(), INPUT)
    expect(result.fields.map((f) => f.type)).toEqual(['image', 'text'])
    expect(result.fields[0]!.sample).toBe('photo')
    expect(result.fields[1]!.fontSize).toBeDefined()
  })
})
