import { t } from '@/i18n'
import type { FieldType, LabelSpec, TemplateField, TextAlign, VerticalAlign } from '@/types/template'
import { uid } from '@/utils/id'
import { clamp, round1 } from '@/utils/layout'

/**
 * AI 自动设计标签：根据「字段 + 示例数据 + 设计要求」生成一版标签排版（JSON），
 * 经过严格的清洗与边界约束后转为 TemplateField[]。
 *
 * 模型选择：
 * - auto（自适应·站点推荐）：仅经站点同源代理 /api/ai-design
 *   （EdgeOne Pages Function，上游模型与密钥由站长在服务端配置），浏览器不直连任何第三方。
 * - BYOK 预设（AI_BYOK_PRESETS）：选定服务商后只需填自己的 API Key，
 *   Base URL 与默认模型名由预设提供，密钥仅存本机 localStorage，浏览器直连服务商。
 * - custom：完全自定义的 OpenAI 兼容接口，同样仅存本机、浏览器直连。
 */

/** 需要用户自带密钥的服务商预设 id（'auto' 与 'custom' 不在其中） */
export type AiByokProviderId =
  | 'zhipu'
  | 'longcat'
  | 'siliconflow'
  | 'openrouter'
  | 'groq'
  | 'gemini'
  | 'eomodels'

/** 'site:<id>' = 站点提供的具名上游（GET /api/ai-design 清单中的 id） */
export type AiProvider = 'auto' | 'custom' | AiByokProviderId | `site:${string}`

export interface AiProviderPreset {
  id: AiByokProviderId
  /** 显示名（中文，经 t() 走 i18n） */
  name: string
  /** 免费额度说明（中文，经 t() 走 i18n） */
  freeNote: string
  baseUrl: string
  defaultModel: string
  /** 「获取 API Key」帮助链接 */
  keyHelpUrl: string
}

/**
 * OpenAI 协议兼容的免费/低门槛接口预设。
 * 免费口径随官方政策变化，模型名可被用户修改兜底——预设值仅作默认。
 */
export const AI_BYOK_PRESETS: AiProviderPreset[] = [
  {
    id: 'zhipu',
    name: '智谱 GLM-4-Flash',
    freeNote: '免费',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    keyHelpUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
  },
  {
    id: 'longcat',
    name: '美团 LongCat-Flash',
    freeNote: '每日 50 万 token 免费',
    baseUrl: 'https://api.longcat.chat/openai/v1',
    defaultModel: 'LongCat-Flash-Chat',
    keyHelpUrl: 'https://longcat.chat/platform/api_keys',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    freeNote: '免费模型',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    keyHelpUrl: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'eomodels',
    name: 'EdgeOne 内置模型',
    freeNote: '每月 50 万 token 免费额度',
    baseUrl: 'https://ai-gateway.edgeone.link/v1',
    defaultModel: '@makers/deepseek-v4-flash',
    keyHelpUrl: 'https://pages.edgeone.ai/zh/document/models',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    freeNote: ':free 模型每日限量免费',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat-v3.1:free',
    keyHelpUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    freeNote: '免费额度',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyHelpUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    freeNote: '免费额度',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
  },
]

export function aiByokPreset(id: string): AiProviderPreset | undefined {
  return AI_BYOK_PRESETS.find((p) => p.id === id)
}

/** BYOK 预设各自的密钥与模型名（按服务商分别记忆） */
export interface AiByokEntry {
  apiKey: string
  model: string
}

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
  byok: Record<string, AiByokEntry>
}

const AI_CONFIG_KEY = 'seatmark.ai-config'

function normalizeProvider(raw: unknown, hasKey: boolean): AiProvider {
  if (raw === 'custom' || (raw == null && hasKey)) return 'custom'
  // 旧版本 'free' 迁移为 'auto'
  if (raw === 'free' || raw === 'auto') return 'auto'
  if (typeof raw === 'string' && raw.startsWith('site:') && raw.length > 5) return raw as AiProvider
  if (typeof raw === 'string' && aiByokPreset(raw)) return raw as AiByokProviderId
  return 'auto'
}

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>
      const byok: Record<string, AiByokEntry> = {}
      if (parsed.byok && typeof parsed.byok === 'object') {
        for (const [id, entry] of Object.entries(parsed.byok)) {
          if (entry && typeof entry === 'object') {
            byok[id] = {
              apiKey: typeof entry.apiKey === 'string' ? entry.apiKey : '',
              model: typeof entry.model === 'string' ? entry.model : '',
            }
          }
        }
      }
      return {
        provider: normalizeProvider(parsed.provider, !!parsed.apiKey),
        baseUrl: parsed.baseUrl ?? '',
        apiKey: parsed.apiKey ?? '',
        model: parsed.model ?? '',
        byok,
      }
    }
  } catch {
    /* localStorage 不可用或数据损坏时回落到默认配置 */
  }
  return { provider: 'auto', baseUrl: '', apiKey: '', model: '', byok: {} }
}

export function saveAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
}

/** 本次生成实际要走的上游：站点代理（可指定具名上游） 或 浏览器直连 */
export type AiUpstream =
  | { mode: 'proxy'; upstream?: string }
  | { mode: 'direct'; baseUrl: string; apiKey: string; model: string }

export function resolveUpstream(config: AiConfig): AiUpstream {
  if (config.provider.startsWith('site:')) {
    const id = config.provider.slice(5)
    return id ? { mode: 'proxy', upstream: id } : { mode: 'proxy' }
  }
  if (config.provider === 'custom') {
    return {
      mode: 'direct',
      baseUrl: config.baseUrl.trim(),
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
    }
  }
  const preset = config.provider === 'auto' ? undefined : aiByokPreset(config.provider)
  if (!preset) return { mode: 'proxy' }
  const entry = config.byok?.[preset.id]
  return {
    mode: 'direct',
    baseUrl: preset.baseUrl,
    apiKey: (entry?.apiKey ?? '').trim(),
    model: (entry?.model ?? '').trim() || preset.defaultModel,
  }
}

export interface AiDesignField {
  label: string
  samples: string[]
  isPhoto: boolean
}

export interface AiDesignInput {
  fields: AiDesignField[]
  requirements: string
  labelWidth: number
  labelHeight: number
  /** 结构化版式偏好：留空或 auto 项交给模型自适应 */
  options?: AiDesignOptions
}

export interface AiDesignOptions {
  /** 排列方向 */
  orientation?: 'auto' | 'horizontal' | 'vertical'
  /** 整体风格 */
  style?: 'auto' | 'formal' | 'minimal' | 'playful' | 'classic' | 'business'
  /** 背景 */
  background?: 'auto' | 'white' | 'light-gray' | 'tint'
  /** 主色（background=tint 时生效，十六进制，如 #1d4ed8） */
  accentColor?: string
  /** 装饰元素 */
  border?: boolean
  divider?: boolean
  footerNote?: boolean
}

export interface AiDesignResult {
  fields: TemplateField[]
  /** AI 对标签底（边框 / 圆角 / 背景）的建议 */
  label: Partial<LabelSpec>
  showLabelBorder?: boolean
}

/**
 * 解析「字段名: 示例值」格式的多行输入；
 * 多个示例用 | 分隔，字段名含「照片 / 头像」视为图片字段。
 */
export function parseFieldLines(text: string): AiDesignField[] {
  const fields: AiDesignField[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const sep = trimmed.search(/[:：]/)
    const label = (sep === -1 ? trimmed : trimmed.slice(0, sep)).trim()
    if (!label) continue
    const rest = sep === -1 ? '' : trimmed.slice(sep + 1)
    const samples = rest
      .split(/[|｜]/)
      .map((s) => s.trim())
      .filter(Boolean)
    fields.push({ label, samples, isPhoto: /照片|相片|头像|photo|avatar/i.test(label) })
  }
  return fields
}

// ---------- Prompt ----------

function systemPrompt(input: AiDesignInput): string {
  const { labelWidth: w, labelHeight: h } = input
  return `你是一位资深的印刷品排版设计师，擅长考场座位签、桌牌、胸卡等小尺寸标签设计。请根据用户给出的字段、示例数据和设计要求，在 ${w}mm × ${h}mm 的标签画布内完成排版设计，输出一个 JSON 对象。

硬性约束：
1. 坐标原点在画布左上角，所有数值单位均为 mm（纯数字，不带单位）。每个字段必须满足：x≥0、y≥0、x+width≤${w}、y+height≤${h}。
2. 内容字段之间不得重叠；分隔线、底色块等装饰不要遮挡文字。
3. 只输出 JSON 本身，禁止输出解释文字或 Markdown 代码块标记。
4. 不要设置字体（fontFamily），字体由用户在设计器中自行选择。

JSON 结构（可选键不需要时省略）：
{
  "label": { "radius": 0, "borderWidth": 0.25, "borderColor": "#334155", "background": "#ffffff" },
  "showLabelBorder": true,
  "fields": [
    {
      "id": "seatNo",
      "label": "座位号",
      "type": "text",
      "x": 1.5, "y": 2, "width": 21, "height": 23,
      "fontSize": 30,
      "fontWeight": "bold",
      "align": "center",
      "verticalAlign": "middle",
      "color": "#0f172a",
      "caption": "姓名",
      "letterSpacing": 0.05,
      "lineHeight": 1.1,
      "maxLines": 1,
      "padding": 0.5,
      "background": "#f1f5f9",
      "emphasis": "hero",
      "sample": "12",
      "fixedText": "请对号入座"
    }
  ]
}

键的说明：
- id：语义化英文 id，数据字段优先用 seatNo / name / room / examId / className / studentId / idCard / gender / school；装饰元素用 divider1、tip1 等。
- label：字段中文名，与用户提供的字段名保持一致。
- type：只能是 "text"、"image" 或 "qr"；照片、头像类字段用 "image"（只需 x/y/width/height/borderWidth/borderColor/radius，sample 固定写 "photo"）；二维码字段用 "qr"（方形，只需 x/y/width/height，内容取绑定列），用户未要求时不要加二维码。
- fontSize 单位 pt；align 取 left/center/right；verticalAlign 取 top/middle/bottom；颜色一律十六进制。
- caption：可选，渲染在内容前的小字标签名（如「姓名 张三」效果）。
- emphasis："hero" 只给最核心的超大字段（如座位号），最多一个。
- sample：示例内容，直接使用用户提供的示例数据。
- fixedText：固定文本（每枚标签内容相同，如提示语、机构名）；普通数据字段不要设置此键。

设计建议：
- 信息层级分明：最重要字段大而重；姓名次之；编号、考场等辅助信息用小字号灰色（#475569 / #64748b / #94a3b8）。
- 字号拉开差距（如 30 / 14 / 8.5），小字段不低于 6pt。
- 可用细分隔线划分区域：type 为 text、height 0.2~0.3、background 取浅灰（#cbd5e1）、fixedText 设为空字符串 ""。
- 也可用窄色条（1.5~3mm 宽的竖条或横条）做点缀，background 用主色。
- 整体克制专业：主色至多一个色相，避免花哨；四周建议留 1.5~3mm 呼吸空间。
- 照片字段比例接近证件照（宽:高 ≈ 3:4），并设置 borderWidth 0.2 与 borderColor。`
}

const ORIENTATION_HINTS: Record<string, string> = {
  horizontal: '横排，主要信息沿水平方向组织（适合宽而矮的标签）',
  vertical: '竖排，字段自上而下排列（适合高而窄的标签）',
}

const STYLE_HINTS: Record<string, string> = {
  formal: '正式克制，政务/考务风格',
  minimal: '简约现代，大留白、少装饰',
  playful: '活泼明快，适合活动、聚会场景',
  classic: '传统典雅，适合正式宴请场景',
  business: '商务专业，适合会议、展会场景',
}

/** 把结构化版式偏好与自由文本拼成确定性的设计要求段（全自适应且无文本时用默认口径） */
export function composeRequirements(input: AiDesignInput): string {
  const lines: string[] = []
  const o = input.options ?? {}
  if (o.orientation && o.orientation !== 'auto') {
    lines.push(`- 排列方向：${ORIENTATION_HINTS[o.orientation]}`)
  }
  if (o.style && o.style !== 'auto') {
    lines.push(`- 整体风格：${STYLE_HINTS[o.style]}`)
  }
  if (o.background === 'white') lines.push('- 背景：纯白底，不加底纹')
  if (o.background === 'light-gray') lines.push('- 背景：极浅灰底（约 #f8fafc），保持文字清晰可读')
  if (o.background === 'tint') {
    lines.push(
      `- 背景：浅主题色底纹或色块${o.accentColor ? `，主色取 ${o.accentColor}` : '，主色由你搭配'}，注意文字对比度`,
    )
  }
  const deco: string[] = []
  if (o.border) deco.push('四周细边框')
  if (o.divider) deco.push('细分隔线划分信息区域')
  if (o.footerNote) deco.push('底部一行小字提示语（用 fixedText）')
  if (deco.length) lines.push(`- 装饰元素：${deco.join('；')}`)
  const extra = input.requirements.trim()
  if (extra) lines.push(`- 其他要求：${extra}`)
  return lines.length ? lines.join('\n') : '无特殊要求，按正式、克制的考务标签风格设计。'
}

function userPrompt(input: AiDesignInput): string {
  const fieldLines = input.fields
    .map((f) => {
      const samples = f.samples.length ? f.samples.join('、') : '（无示例）'
      return `- ${f.label}${f.isPhoto ? '（照片字段，type 用 image）' : ''}：示例 ${samples}`
    })
    .join('\n')
  return `标签尺寸：宽 ${input.labelWidth}mm × 高 ${input.labelHeight}mm

字段与示例数据：
${fieldLines}

设计要求：
${composeRequirements(input)}`
}

// ---------- 接口调用 ----------

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

/** 上游/代理返回非 2xx 时抛出，保留状态码与结构化 body 供调用方分支 */
export class AiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds: number | null = null,
    /** 服务端约定的错误代码（login_required / ai_quota_exceeded 等） */
    public readonly code: string | null = null,
    /** 响应 body 里的附加字段（配额 used/limit/plan 等） */
    public readonly details: Record<string, unknown> | null = null,
  ) {
    super(message)
    this.name = 'AiHttpError'
  }
}

/** 同源代理的明确拒绝（401 登录门 / 413 / 429）面向用户直接展示，不归入「通道不可用」 */
export function proxyRejectionMessage(err: unknown): string | null {
  if (!(err instanceof AiHttpError)) return null
  if (err.status === 401 || err.code === 'login_required') {
    return t('请登录后使用 AI 设计（免费账号每月 3 次）')
  }
  if (err.code === 'ai_quota_exceeded') {
    const used = typeof err.details?.used === 'number' ? err.details.used : null
    const limit = typeof err.details?.limit === 'number' ? err.details.limit : null
    return used !== null && limit !== null
      ? t('本月 AI 设计次数已用完（{used}/{limit}），升级套餐获得更多次数')
          .replace('{used}', String(used))
          .replace('{limit}', String(limit))
      : t('本月 AI 设计次数已用完，升级套餐获得更多次数')
  }
  if (err.status === 413) return t('设计要求或字段示例过长（超过 32KB），请精简后重试')
  if (err.status === 429) {
    const wait = err.retryAfterSeconds
    const minutes = wait ? Math.max(1, Math.ceil(wait / 60)) : null
    return minutes
      ? t('AI 设计请求过于频繁（每小时最多 30 次），请约 {n} 分钟后再试').replace('{n}', String(minutes))
      : t('AI 设计请求过于频繁（每小时最多 30 次），请稍后再试')
  }
  return null
}

function isUserAbort(err: unknown, signal?: AbortSignal): boolean {
  return !!signal?.aborted && err instanceof DOMException && err.name === 'AbortError'
}

/** 在用户取消信号之上叠加单次请求超时 */
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/** 发送一次 OpenAI 格式的 chat/completions 请求并取出回复文本 */
async function postChat(
  url: string,
  body: Record<string, unknown>,
  apiKey: string | undefined,
  signal: AbortSignal | undefined,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const retryAfter = Number(res.headers.get('Retry-After'))
    let code: string | null = null
    let details: Record<string, unknown> | null = null
    try {
      const parsed = JSON.parse(text) as { code?: unknown }
      if (parsed && typeof parsed === 'object') {
        details = parsed as Record<string, unknown>
        if (typeof parsed.code === 'string') code = parsed.code
      }
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new AiHttpError(
      res.status,
      `HTTP ${res.status}${text ? `：${text.slice(0, 160)}` : `：${res.statusText}`}`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      code,
      details,
    )
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('接口未返回内容')
  return content
}

/** 浏览器直连的 OpenAI 兼容接口（自定义或 BYOK 预设） */
async function callChatCustom(
  upstream: { baseUrl: string; apiKey: string; model: string },
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const base = upstream.baseUrl.replace(/\/+$/, '')
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
  try {
    return await postChat(
      url,
      { model: upstream.model, messages, temperature: 0.6 },
      upstream.apiKey,
      signal,
    )
  } catch (err) {
    if (isUserAbort(err, signal)) throw err
    if (err instanceof TypeError) {
      throw new Error('无法连接 AI 接口：请检查接口地址与网络（接口未开放浏览器跨域时也会失败）')
    }
    throw new Error(`AI 接口请求失败（${err instanceof Error ? err.message : String(err)}）`)
  }
}

/**
 * 自适应通道只走站点同源代理 /api/ai-design（上游模型、密钥与兜底都在服务端），
 * 浏览器不直连任何第三方模型接口；代理失败则提示用户重试或改选其他模型。
 */
export const FREE_ATTEMPTS: ReadonlyArray<{ url: string; timeoutMs: number }> = [
  { url: '/api/ai-design', timeoutMs: 90_000 },
]

/** GET /api/ai-design 返回的站点模型项与登录用户配额 */
export interface AiSiteModel {
  id: string
  label: string
}
export interface AiMonthlyQuota {
  plan: 'free' | 'pro' | 'team' | string
  limit: number
  used: number
  remaining: number
  month: string
}
export interface AiSiteInfo {
  models: AiSiteModel[]
  quota: AiMonthlyQuota | null
}

/** 拉取站点托管模型清单；登录会话附带本月配额。失败返回空清单，不阻断自适应通道 */
export async function fetchAiSiteInfo(): Promise<AiSiteInfo> {
  try {
    const res = await fetch('/api/ai-design')
    if (!res.ok) return { models: [], quota: null }
    const data = (await res.json()) as { models?: unknown; quota?: unknown }
    const models = Array.isArray(data?.models)
      ? (data.models as unknown[]).filter(
          (m): m is AiSiteModel =>
            !!m && typeof m === 'object' && typeof (m as AiSiteModel).id === 'string',
        )
      : []
    const q = data?.quota as Partial<AiMonthlyQuota> | null | undefined
    const quota: AiMonthlyQuota | null =
      q && typeof q === 'object' && typeof q.limit === 'number'
        ? {
            plan: typeof q.plan === 'string' ? q.plan : 'free',
            limit: q.limit,
            used: typeof q.used === 'number' ? q.used : 0,
            remaining: typeof q.remaining === 'number' ? q.remaining : Math.max(0, q.limit - (q.used ?? 0)),
            month: typeof q.month === 'string' ? q.month : '',
          }
        : null
    return { models, quota }
  } catch {
    return { models: [], quota: null }
  }
}

/** 同源代理失败时给用户看的简短原因：只保留状态码/超时，不透出上游服务商的原始响应体 */
export function freeChannelFailureReason(err: unknown): string {
  if (err instanceof AiHttpError) return `HTTP ${err.status}`
  if (err instanceof DOMException && err.name === 'TimeoutError') return t('请求超时')
  if (err instanceof TypeError) return t('网络错误')
  return err instanceof Error ? err.message : String(err)
}

async function callChatFree(
  messages: ChatMessage[],
  signal?: AbortSignal,
  upstream?: string,
): Promise<string> {
  let lastError = ''
  for (const attempt of FREE_ATTEMPTS) {
    try {
      return await postChat(
        attempt.url,
        upstream ? { messages, upstream, temperature: 0.6 } : { messages, temperature: 0.6 },
        undefined,
        withTimeout(signal, attempt.timeoutMs),
      )
    } catch (err) {
      if (isUserAbort(err, signal)) throw err
      const rejection = proxyRejectionMessage(err)
      if (rejection) throw new Error(rejection)
      lastError = freeChannelFailureReason(err)
    }
  }
  throw new Error(
    t('自适应通道暂不可用（{reason}），可稍后重试或改选其他模型').replace('{reason}', lastError),
  )
}

// ---------- 结果解析与清洗 ----------

function extractJson(text: string): unknown {
  let candidate = text.trim()
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(candidate)
  if (fenced?.[1]) candidate = fenced[1].trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('AI 返回内容中没有找到 JSON，请重试')
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    throw new Error('AI 返回的 JSON 无法解析，请重试一次')
  }
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function hexColor(value: unknown): string | undefined {
  return typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function sanitizeField(
  raw: Record<string, unknown>,
  labelW: number,
  labelH: number,
  usedIds: Set<string>,
): TemplateField {
  const type: FieldType = raw.type === 'image' ? 'image' : raw.type === 'qr' ? 'qr' : 'text'
  let id = (str(raw.id) ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (!id || usedIds.has(id)) id = uid(type === 'image' ? 'photo' : type === 'qr' ? 'qr' : 'field')
  usedIds.add(id)

  const width = clamp(num(raw.width) ?? 20, 1, labelW)
  const height = clamp(num(raw.height) ?? 8, 0.2, labelH)
  const x = clamp(num(raw.x) ?? 0, 0, Math.max(labelW - width, 0))
  const y = clamp(num(raw.y) ?? 0, 0, Math.max(labelH - height, 0))

  const field: TemplateField = {
    id,
    label: str(raw.label)?.trim() || id,
    type,
    x: round1(x),
    y: round1(y),
    width: round1(width),
    height: round1(height),
  }

  const radius = num(raw.radius)
  if (radius != null) field.radius = clamp(radius, 0, 20)
  const borderWidth = num(raw.borderWidth)
  if (borderWidth != null) field.borderWidth = clamp(borderWidth, 0.05, 2)
  const borderColor = hexColor(raw.borderColor)
  if (borderColor) field.borderColor = borderColor
  if (raw.border === true) field.border = true
  const background = hexColor(raw.background)
  if (background) field.background = background

  if (type === 'image') {
    field.sample = 'photo'
    return field
  }

  if (type === 'qr') {
    const vAlign = str(raw.verticalAlign)
    field.verticalAlign = (vAlign === 'top' || vAlign === 'bottom' ? vAlign : 'middle') as VerticalAlign
    field.padding = clamp(num(raw.padding) ?? 0.5, 0, 10)
    const sample = str(raw.sample)
    if (sample) field.sample = sample
    return field
  }

  field.fontSize = clamp(num(raw.fontSize) ?? 10, 4, 120)
  field.fontWeight = raw.fontWeight === 'bold' ? 'bold' : 'normal'
  const align = str(raw.align)
  field.align = (align === 'left' || align === 'right' ? align : 'center') as TextAlign
  const vAlign = str(raw.verticalAlign)
  field.verticalAlign = (vAlign === 'top' || vAlign === 'bottom' ? vAlign : 'middle') as VerticalAlign
  const color = hexColor(raw.color)
  if (color) field.color = color
  const caption = str(raw.caption)?.trim()
  if (caption) field.caption = caption
  const letterSpacing = num(raw.letterSpacing)
  if (letterSpacing != null) field.letterSpacing = Math.round(clamp(letterSpacing, -0.2, 2) * 100) / 100
  field.lineHeight = clamp(num(raw.lineHeight) ?? 1.15, 0.8, 3)
  field.maxLines = Math.round(clamp(num(raw.maxLines) ?? 1, 1, 6))
  field.padding = clamp(num(raw.padding) ?? 0.5, 0, 10)
  if (raw.emphasis === 'hero') field.emphasis = 'hero'
  const sample = str(raw.sample)
  if (sample) field.sample = sample
  const fixedText = str(raw.fixedText)
  if (fixedText != null) field.fixedText = fixedText
  return field
}

function sanitizeResult(parsed: unknown, input: AiDesignInput): AiDesignResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 返回的内容不是有效的设计 JSON，请重试')
  }
  const root = parsed as Record<string, unknown>
  const rawFields = Array.isArray(root.fields) ? root.fields : []
  const usedIds = new Set<string>()
  const fields: TemplateField[] = []
  for (const item of rawFields) {
    if (item && typeof item === 'object') {
      fields.push(sanitizeField(item as Record<string, unknown>, input.labelWidth, input.labelHeight, usedIds))
    }
  }
  if (!fields.length) throw new Error('AI 没有生成任何字段，请调整要求后重试')

  const label: Partial<LabelSpec> = {}
  if (root.label && typeof root.label === 'object') {
    const rawLabel = root.label as Record<string, unknown>
    const radius = num(rawLabel.radius)
    if (radius != null) label.radius = clamp(radius, 0, 20)
    const borderWidth = num(rawLabel.borderWidth)
    if (borderWidth != null) label.borderWidth = clamp(borderWidth, 0.05, 2)
    const borderColor = hexColor(rawLabel.borderColor)
    if (borderColor) label.borderColor = borderColor
    const background = hexColor(rawLabel.background)
    if (background) label.background = background
  }

  return {
    fields,
    label,
    showLabelBorder: typeof root.showLabelBorder === 'boolean' ? root.showLabelBorder : undefined,
  }
}

/** 调用 AI 生成标签设计；signal 用于取消（关闭对话框时中断请求） */
export async function generateLabelDesign(
  config: AiConfig,
  input: AiDesignInput,
  signal?: AbortSignal,
): Promise<AiDesignResult> {
  const upstream = resolveUpstream(config)
  if (upstream.mode === 'direct' && (!upstream.baseUrl || !upstream.apiKey || !upstream.model)) {
    throw new Error(t('请先填写所选模型的 API Key（模型名留空时使用默认）'))
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(input) },
    { role: 'user', content: userPrompt(input) },
  ]
  const content =
    upstream.mode === 'proxy'
      ? await callChatFree(messages, signal, upstream.upstream)
      : await callChatCustom(upstream, messages, signal)
  return sanitizeResult(extractJson(content), input)
}
