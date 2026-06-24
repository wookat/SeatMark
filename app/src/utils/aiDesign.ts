import type { LabelSpec, TemplateField, TextAlign, VerticalAlign } from '@/types/template'
import { uid } from '@/utils/id'
import { clamp, round1 } from '@/utils/layout'

/**
 * AI 自动设计标签：根据「字段 + 示例数据 + 设计要求」生成一版标签排版（JSON），
 * 经过严格的清洗与边界约束后转为 TemplateField[]。
 *
 * 两种生成通道：
 * - free：免费通道，无需任何配置。优先走站点同源代理 /api/ai-design
 *   （EdgeOne Pages Function，站长可配置上游密钥），失败时自动回退到
 *   Pollinations 匿名公共接口（无需密钥，按 IP 限流）。
 * - custom：用户自己的 OpenAI 兼容接口，地址与密钥仅保存在本机 localStorage，
 *   请求直接由浏览器发出。
 */

export type AiProvider = 'free' | 'custom'

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
}

const AI_CONFIG_KEY = 'seatmark.ai-config'

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>
      // 旧版本配置没有 provider 字段：填过密钥的视为自定义接口用户
      const provider: AiProvider =
        parsed.provider === 'custom' || (parsed.provider == null && parsed.apiKey) ? 'custom' : 'free'
      return {
        provider,
        baseUrl: parsed.baseUrl ?? '',
        apiKey: parsed.apiKey ?? '',
        model: parsed.model ?? '',
      }
    }
  } catch {
    /* localStorage 不可用或数据损坏时回落到默认配置 */
  }
  return { provider: 'free', baseUrl: '', apiKey: '', model: '' }
}

export function saveAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
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
- type：只能是 "text" 或 "image"；照片、头像类字段用 "image"（只需 x/y/width/height/borderWidth/borderColor/radius，sample 固定写 "photo"）。
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

设计要求：${input.requirements || '无特殊要求，按正式、克制的考务标签风格设计。'}`
}

// ---------- 接口调用 ----------

interface ChatMessage {
  role: 'system' | 'user'
  content: string
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
    throw new Error(`HTTP ${res.status}${text ? `：${text.slice(0, 160)}` : `：${res.statusText}`}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('接口未返回内容')
  return content
}

/** 自定义 OpenAI 兼容接口 */
async function callChatCustom(
  config: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
  try {
    return await postChat(
      url,
      { model: config.model.trim(), messages, temperature: 0.6 },
      config.apiKey.trim(),
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
 * 免费通道：依次尝试以下接口，任一成功即返回。
 * 1. 站点同源代理 /api/ai-design（部署了 EdgeOne Pages Function 且配置密钥时可用，
 *    未部署 / 未配置会快速返回 404 / 501，自动落到下一个）；
 * 2./3. Pollinations 匿名接口（无需密钥，按 IP 限流，繁忙时换模型再试一次）。
 */
const FREE_ATTEMPTS: Array<{ url: string; model?: string; timeoutMs: number }> = [
  { url: '/api/ai-design', timeoutMs: 90_000 },
  { url: 'https://text.pollinations.ai/openai', model: 'openai', timeoutMs: 90_000 },
  { url: 'https://text.pollinations.ai/openai', model: 'openai-fast', timeoutMs: 90_000 },
]

async function callChatFree(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  let lastError = ''
  for (const attempt of FREE_ATTEMPTS) {
    try {
      const body: Record<string, unknown> = { messages, temperature: 0.6 }
      if (attempt.model) body.model = attempt.model
      return await postChat(attempt.url, body, undefined, withTimeout(signal, attempt.timeoutMs))
    } catch (err) {
      if (isUserAbort(err, signal)) throw err
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  throw new Error(
    `免费通道暂时繁忙（${lastError}）。可稍等片刻重试，或切换到「自定义 API」使用自己的接口。`,
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
  const type = raw.type === 'image' ? 'image' : 'text'
  let id = (str(raw.id) ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (!id || usedIds.has(id)) id = uid(type === 'image' ? 'photo' : 'field')
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
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(input) },
    { role: 'user', content: userPrompt(input) },
  ]
  const content =
    config.provider === 'custom'
      ? await callChatCustom(config, messages, signal)
      : await callChatFree(messages, signal)
  return sanitizeResult(extractJson(content), input)
}
