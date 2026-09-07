/**
 * 第 357 轮：免费通道只走站点同源代理 /api/ai-design，浏览器不直连任何第三方模型接口。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setLocale } from '@/i18n'
import { FREE_ATTEMPTS, generateLabelDesign, loadAiConfig, saveAiConfig } from '../aiDesign'

describe('免费通道仅同源代理', () => {
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

  it('FREE_ATTEMPTS 只有 /api/ai-design，没有任何绝对地址', () => {
    expect(FREE_ATTEMPTS.map((a) => a.url)).toEqual(['/api/ai-design'])
    expect(FREE_ATTEMPTS.every((a) => a.url.startsWith('/'))).toBe(true)
  })

  it('源码中不再出现任何第三方模型接口的绝对地址', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/utils/aiDesign.ts'), 'utf8')
    expect(source).not.toMatch(/https:\/\/[a-z0-9.-]*\.ai\//i)
    expect(source).not.toMatch(/text\.[a-z-]+\.ai/i)
  })

  it('代理 502 时只请求过 /api/ai-design 一次，并提示「站点 AI 通道暂不可用」', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"upstream"}', { status: 502 }))
    await expect(
      generateLabelDesign(loadAiConfig(), {
        fields: [{ label: '姓名', samples: ['张伟'], isPhoto: false }],
        requirements: '',
        labelWidth: 60,
        labelHeight: 32,
      }),
    ).rejects.toThrow(/站点 AI 通道暂不可用（.*）.*自定义 API/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('/api/ai-design')
  })

  it('英文界面下失败提示为英文', async () => {
    await setLocale('en')
    fetchMock.mockResolvedValue(new Response('{"error":"upstream"}', { status: 502 }))
    await expect(
      generateLabelDesign(loadAiConfig(), {
        fields: [{ label: 'Name', samples: ['Tom'], isPhoto: false }],
        requirements: '',
        labelWidth: 60,
        labelHeight: 32,
      }),
    ).rejects.toThrow(/site AI channel is temporarily unavailable \(.*\)\. Try again later or switch to "Custom API"/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
