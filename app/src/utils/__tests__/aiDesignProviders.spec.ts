/**
 * 模型选择体系：自适应（站点代理）+ BYOK 预设（浏览器直连服务商）+ 自定义接口。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setLocale } from '@/i18n'
import {
  AI_BYOK_PRESETS,
  composeRequirements,
  generateLabelDesign,
  loadAiConfig,
  resolveUpstream,
  saveAiConfig,
} from '../aiDesign'

const FIELDS = [{ label: '姓名', samples: ['张伟'], isPhoto: false }]
const INPUT = { fields: FIELDS, requirements: '', labelWidth: 90, labelHeight: 28 }

const OK_REPLY = JSON.stringify({
  choices: [
    {
      message: {
        content: JSON.stringify({
          fields: [{ id: 'name', label: '姓名', type: 'text', x: 2, y: 2, width: 40, height: 10 }],
        }),
      },
    },
  ],
})

function config(partial: Partial<Parameters<typeof saveAiConfig>[0]>) {
  return { provider: 'auto' as const, baseUrl: '', apiKey: '', model: '', byok: {}, ...partial }
}

describe('AI 模型选择体系', () => {
  const fetchMock = vi.fn()
  beforeEach(async () => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    await setLocale('zh')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('预设清单：id 唯一、均为 OpenAI 兼容 https 地址、有默认模型与帮助链接', () => {
    const ids = AI_BYOK_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of AI_BYOK_PRESETS) {
      expect(p.baseUrl).toMatch(/^https:\/\//)
      expect(p.defaultModel.length).toBeGreaterThan(0)
      expect(p.keyHelpUrl).toMatch(/^https:\/\//)
    }
    // 站点自有 EO Models 网关必须在清单内
    expect(ids).toContain('eomodels')
    expect(AI_BYOK_PRESETS.find((p) => p.id === 'eomodels')?.defaultModel).toContain('@makers/')
  })

  it('旧配置 provider=free 迁移为 auto', () => {
    localStorage.setItem(
      'seatmark.ai-config',
      JSON.stringify({ provider: 'free', baseUrl: '', apiKey: '', model: '' }),
    )
    expect(loadAiConfig().provider).toBe('auto')
  })

  it('旧配置无 provider 但填过密钥 → custom；byok 条目按服务商保留', () => {
    localStorage.setItem(
      'seatmark.ai-config',
      JSON.stringify({ apiKey: 'sk-x', baseUrl: 'https://a.com/v1', model: 'm' }),
    )
    expect(loadAiConfig().provider).toBe('custom')
    saveAiConfig(
      config({ provider: 'zhipu', byok: { zhipu: { apiKey: 'sk-z', model: 'glm-4-flash' } } }),
    )
    const loaded = loadAiConfig()
    expect(loaded.byok.zhipu).toEqual({ apiKey: 'sk-z', model: 'glm-4-flash' })
  })

  it('resolveUpstream：BYOK 预设 → 浏览器直连，模型名留空回退预设默认', () => {
    const u = resolveUpstream(
      config({ provider: 'siliconflow', byok: { siliconflow: { apiKey: ' sk-sf ', model: ' ' } } }),
    )
    expect(u).toEqual({
      mode: 'direct',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'sk-sf',
      model: 'Qwen/Qwen2.5-7B-Instruct',
    })
  })

  it('resolveUpstream：custom → 直连用户填写的三项', () => {
    const u = resolveUpstream(
      config({ provider: 'custom', baseUrl: 'https://x.com/v1/', apiKey: 'k', model: 'm' }),
    )
    expect(u).toEqual({ mode: 'direct', baseUrl: 'https://x.com/v1/', apiKey: 'k', model: 'm' })
  })

  it('BYOK 调用：POST 到预设接口，带 Bearer 密钥与所选模型', async () => {
    fetchMock.mockResolvedValue(new Response(OK_REPLY, { status: 200 }))
    const cfg = config({
      provider: 'groq',
      byok: { groq: { apiKey: 'gsk_x', model: 'llama-3.3-70b-versatile' } },
    })
    await generateLabelDesign(cfg, INPUT)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_x')
    const body = JSON.parse(String(init.body)) as { model: string }
    expect(body.model).toBe('llama-3.3-70b-versatile')
  })

  it('BYOK 未填密钥直接报可读错误，不发请求', async () => {
    await expect(
      generateLabelDesign(config({ provider: 'openrouter', byok: {} }), INPUT),
    ).rejects.toThrow(/API Key/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('composeRequirements：全自适应且无文本 → 默认口径', () => {
    expect(composeRequirements({ ...INPUT, requirements: '  ' })).toBe(
      '无特殊要求，按正式、克制的考务标签风格设计。',
    )
  })

  it('composeRequirements：结构化选项逐项成行，自由文本附加', () => {
    const text = composeRequirements({
      ...INPUT,
      requirements: '座位号放最大',
      options: {
        orientation: 'horizontal',
        style: 'formal',
        background: 'tint',
        accentColor: '#1d4ed8',
        border: true,
        divider: true,
        footerNote: true,
      },
    })
    expect(text).toContain('排列方向：横排')
    expect(text).toContain('整体风格：正式克制')
    expect(text).toContain('#1d4ed8')
    expect(text).toContain('细边框')
    expect(text).toContain('细分隔线')
    expect(text).toContain('底部一行小字提示语')
    expect(text).toContain('其他要求：座位号放最大')
  })

  it('user prompt 经由请求体带出结构化要求', async () => {
    fetchMock.mockResolvedValue(new Response(OK_REPLY, { status: 200 }))
    await generateLabelDesign(config({}), {
      ...INPUT,
      options: { orientation: 'vertical', background: 'white' },
    })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { messages: { content: string }[] }
    expect(body.messages[1].content).toContain('排列方向：竖排')
    expect(body.messages[1].content).toContain('背景：纯白底')
  })
})
