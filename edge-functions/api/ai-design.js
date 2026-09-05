/**
 * AI 标签设计同源代理（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/ai-design   请求体：{ messages: [{ role, content }, ...] }
 * 作用：用站长配置的密钥转发到上游大模型，让访客无需任何配置即可使用 AI 设计。
 *
 * 主模型：DeepSeek v4 Flash（通过环境变量 DEEPSEEK_API_KEY 配置）
 * 兜底模型：智谱 glm-4-flash（通过环境变量 AI_API_KEY 配置，永久免费）
 * 无密钥兜底：服务端代理 Pollinations 匿名接口（浏览器直连受来源限制 402，服务端出口可用）
 *
 * 护栏：
 * - 请求体上限 64KB（Content-Length 与实际字节数双重校验），超限 400；
 * - 按 IP 日限次（`ai:ip:<sha256(ip)>:<YYYY-MM-DD>`，上限 30），超限 429 + Retry-After；
 *   存储降级 memory 时计数跨实例不一致，fail closed 503（仅 SEATMARK_ALLOW_MEMORY_STORAGE=1 放行）；
 * - 主上游失败后只允许 1 次兜底调用，兜底阶段总超时 25s；
 * - 返回给前端的错误只含状态分类文案，不透传上游响应正文；日志不打印用户 messages。
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - DEEPSEEK_API_KEY  主模型密钥（DeepSeek 开放平台）
 * - AI_API_KEY        兜底密钥（智谱开放平台 glm-4-flash）
 * - AI_BASE_URL       兜底接口地址，默认 https://open.bigmodel.cn/api/paas/v4
 * - AI_MODEL          兜底模型名，默认 glm-4-flash
 * - ALERT_WEBHOOK     可选，告警 webhook（企业微信机器人）；仅从环境变量读取，未配置时跳过告警推送
 */

import { withSecurityHeaders } from './_security.js'
import { getStorage } from './_storage.js'

const REV = 'r356'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'

const FALLBACK_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const FALLBACK_MODEL = 'glm-4-flash'

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai'
const POLLINATIONS_MODEL = 'openai'

const MAX_BODY_BYTES = 64 * 1024
const MAX_MESSAGES = 8
const MAX_CONTENT_CHARS = 20000
const IP_DAILY_LIMIT = 30
const FALLBACK_TIMEOUT_MS = 25_000

const encoder = new TextEncoder()

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-SeatMark-Rev': REV,
      ...extraHeaders,
    },
  })
}

function clientIp(request) {
  return (
    request.headers.get('EO-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** 距 UTC 次日零点的秒数（限流 Retry-After） */
function secondsUntilTomorrow() {
  const now = Date.now()
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000))
}

/** 告警等级与 HTTP 状态的映射 */
function alertLevel(status) {
  if (status === 402) return '余额不足'
  if (status === 429) return '请求限流'
  if (status === 401 || status === 403) return '密钥无效'
  return `上游错误 ${status}`
}

/** 向企业微信推送告警（静默，不阻塞主流程） */
async function sendAlert(env, level, detail) {
  const webhook = (env && typeof env.ALERT_WEBHOOK === 'string' && env.ALERT_WEBHOOK.trim()) || ''
  if (!webhook) {
    console.warn('[seatmark-ai-design] webhook not configured')
    return
  }
  const text = [
    '【AI 设计告警】DeepSeek 主模型异常',
    `等级：${level}`,
    `详情：${detail}`,
    `时间：${new Date().toISOString()}`,
  ].join('\n')
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
    })
  } catch {
    /* 推送失败不阻塞 */
  }
}

export async function onRequest(context) {
  return withSecurityHeaders(await handleRequest(context))
}

/** 读取并校验请求体：Content-Length 先行拒绝，再按实际字节数兜底（分块传输无长度头） */
async function readLimitedBody(request) {
  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { tooLarge: true }
  let text
  try {
    text = await request.text()
  } catch {
    return { invalid: true }
  }
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) return { tooLarge: true }
  try {
    return { payload: JSON.parse(text) }
  } catch {
    return { invalid: true }
  }
}

function proxyOk(text) {
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-SeatMark-Rev': REV },
  })
}

async function handleRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method !== 'POST') return json({ error: '请求方法不支持' }, 405)

  const body = await readLimitedBody(request)
  if (body.tooLarge) return json({ error: '请求体过大（上限 64KB）' }, 400)
  if (body.invalid) return json({ error: '请求体格式错误' }, 400)
  const payload = body.payload

  const messages = payload && Array.isArray(payload.messages) ? payload.messages : null
  if (!messages || !messages.length || messages.length > MAX_MESSAGES) {
    return json({ error: '消息格式无效' }, 400)
  }
  for (const item of messages) {
    const roleOk = item && (item.role === 'system' || item.role === 'user')
    const contentOk = item && typeof item.content === 'string' && item.content.length <= MAX_CONTENT_CHARS
    if (!roleOk || !contentOk) return json({ error: '消息内容无效' }, 400)
  }

  // IP 日限次：存储不可用（memory 降级且未放行）时 fail closed
  const { kv, storage } = await getStorage(env)
  if (storage === 'memory' && !(env && env.SEATMARK_ALLOW_MEMORY_STORAGE === '1')) {
    console.error('[seatmark-ai-design] 存储降级 memory 且未放行，拒绝服务')
    return json({ error: 'storage_unavailable' }, 503, { 'X-SeatMark-Storage': storage })
  }
  const ipKey = `ai:ip:${await sha256Hex(clientIp(request))}:${today()}`
  let used = 0
  try {
    used = Number((await kv.get(ipKey)) || 0)
    if (!Number.isFinite(used) || used < 0) used = 0
  } catch (err) {
    console.error('[seatmark-ai-design] 限流计数读取失败:', err)
    return json({ error: 'storage_unavailable' }, 503, { 'X-SeatMark-Storage': storage })
  }
  if (used >= IP_DAILY_LIMIT) {
    return json({ error: '今日 AI 设计次数已用完，请明天再试' }, 429, {
      'Retry-After': String(secondsUntilTomorrow()),
    })
  }
  try {
    await kv.put(ipKey, String(used + 1))
  } catch (err) {
    console.error('[seatmark-ai-design] 限流计数写入失败:', err)
    return json({ error: 'storage_unavailable' }, 503, { 'X-SeatMark-Storage': storage })
  }

  async function callUpstream(url, apiKey, model, timeoutMs) {
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.6 }),
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
      eo: {
        timeoutSetting: {
          connectTimeout: Math.min(30_000, timeoutMs),
          readTimeout: timeoutMs,
          writeTimeout: Math.min(30_000, timeoutMs),
        },
      },
    })
  }

  function chatUrl(baseUrl) {
    return baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  }

  // 主模型：DeepSeek
  const deepseekKey = env && env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    try {
      const upstream = await callUpstream(chatUrl(DEEPSEEK_BASE_URL), deepseekKey, DEEPSEEK_MODEL, 120_000)
      if (upstream.ok) return proxyOk(await upstream.text())
      await sendAlert(env, alertLevel(upstream.status), `HTTP ${upstream.status}`)
    } catch (e) {
      await sendAlert(env, '网络异常', e instanceof Error ? e.name : 'unknown')
    }
  }

  // 兜底：只允许 1 次（有智谱密钥走智谱，否则走匿名代理），总超时 25s
  const fallbackKey = env && env.AI_API_KEY
  const fallback = fallbackKey
    ? {
        url: chatUrl(String((env && env.AI_BASE_URL) || FALLBACK_BASE_URL)),
        apiKey: fallbackKey,
        model: (env && env.AI_MODEL) || FALLBACK_MODEL,
      }
    : { url: POLLINATIONS_URL, apiKey: '', model: POLLINATIONS_MODEL }
  let failure = 'unavailable'
  try {
    const upstream = await callUpstream(fallback.url, fallback.apiKey, fallback.model, FALLBACK_TIMEOUT_MS)
    if (upstream.ok) return proxyOk(await upstream.text())
    failure = upstream.status === 429 ? 'rate_limited' : `upstream_${upstream.status}`
  } catch (e) {
    failure = e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network'
  }
  console.error('[seatmark-ai-design] 主模型与兜底均失败:', failure)
  return json({ error: 'AI 服务暂时不可用，请稍后再试', code: failure }, 502)
}
