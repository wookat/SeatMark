/**
 * 自适应通道只走站点同源代理 /api/ai-design，浏览器不直连任何第三方模型接口。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setLocale } from '@/i18n'
import {
  FREE_ATTEMPTS,
  generateLabelDesign,
  loadAiConfig,
  resolveUpstream,
  saveAiConfig,
} from '../aiDesign'

const AUTO_CONFIG = { provider: 'auto' as const, baseUrl: '', apiKey: '', model: '', byok: {} }

describe('自适应通道仅同源代理', () => {
  const fetchMock = vi.fn()
  beforeEach(async () => {
    localStorage.clear()
    saveAiConfig(AUTO_CONFIG)
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

  it('auto / 未知 provider 都解析为站点代理，不直连第三方', () => {
    expect(resolveUpstream(AUTO_CONFIG)).toEqual({ mode: 'proxy' })
    expect(
      resolveUpstream({ provider: 'unknown-x' as never, baseUrl: '', apiKey: '', model: '', byok: {} }),
    ).toEqual({ mode: 'proxy' })
  })

  it('代理 502 时只请求过 /api/ai-design 一次，并提示「自适应通道暂不可用」', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"upstream"}', { status: 502 }))
    await expect(
      generateLabelDesign(loadAiConfig(), {
        fields: [{ label: '姓名', samples: ['张伟'], isPhoto: false }],
        requirements: '',
        labelWidth: 60,
        labelHeight: 32,
      }),
    ).rejects.toThrow(/自适应通道暂不可用（.*）.*改选其他模型/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('/api/ai-design')
  })

  it('代理 5xx 的失败原因只保留状态码，不透出上游服务商的原始响应体', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"error":"AI 服务暂时不可用，请稍后再试（openai: HTTP 402 {\\"error\\":\\"Some Vendor legacy text API\\"}）"}',
        { status: 502 },
      ),
    )
    const err = await generateLabelDesign(loadAiConfig(), {
      fields: [{ label: '姓名', samples: ['张伟'], isPhoto: false }],
      requirements: '',
      labelWidth: 60,
      labelHeight: 32,
    }).catch((e: unknown) => e as Error)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('自适应通道暂不可用（HTTP 502），可稍后重试或改选其他模型')
    expect((err as Error).message).not.toMatch(/402|legacy|Vendor|error/)
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
    ).rejects.toThrow(/adaptive channel is temporarily unavailable \(.*\).*pick another model/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
