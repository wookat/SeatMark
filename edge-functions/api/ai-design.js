/**
 * AI 标签设计同源代理（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/ai-design   请求体：{ messages: [{ role, content }, ...], upstream?: '<tier id>' }
 *       GET  /api/ai-design   返回 { models: [{ id, label }] } 当前已配置的站点模型清单（不含密钥）
 * 作用：用站长配置的密钥转发到上游大模型，让访客无需任何配置即可使用 AI 设计。
 *       upstream 指定已配置的 tier id 时优先尝试该上游，之后仍按默认顺序级联；
 *       未指定或 tier 未配置时按 TIER_DEFS 顺序级联。
 *
 * 主模型：DeepSeek v4 Flash（通过环境变量 DEEPSEEK_API_KEY 配置）
 * 兜底模型：智谱 glm-4-flash（通过环境变量 AI_API_KEY 配置，永久免费）
 * 兜底模型：EdgeOne Makers Models 网关 @makers/deepseek-v4-flash
 *   （AI_GATEWAY_API_KEY 或 MAKERS_MODELS_KEY 配置；Agents 模板部署时平台自动注入，
 *   Pages 项目需从控制台 Models 页获取密钥后手动配置，免费版每月 50 万 token 内置模型额度）
 * 无密钥兜底：服务端代理 Pollinations 匿名接口（SEATMARK_AI_ANON_FALLBACK=0 可关闭，关闭后
 * 密钥上游全部失败即直接 502）。前端免费通道仅调本同源代理，
 * 浏览器不直连任何第三方模型接口，所有兜底都在服务端完成。
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - DEEPSEEK_API_KEY    主模型密钥（DeepSeek 开放平台）
 * - AI_API_KEY          兜底密钥（智谱开放平台 glm-4-flash）
 * - AI_BASE_URL         兜底接口地址，默认 https://open.bigmodel.cn/api/paas/v4
 * - AI_MODEL            兜底模型名，默认 glm-4-flash
 * - AI_GATEWAY_API_KEY  Makers Models 网关密钥（控制台 Models 页获取；也认 MAKERS_MODELS_KEY）
 * - AI_GATEWAY_BASE_URL 网关地址，默认 https://ai-gateway.edgeone.link/v1
 * - AI_GATEWAY_MODEL    网关模型名，默认 @makers/deepseek-v4-flash
 * - AI_UPSTREAMS        扩展上游 JSON 数组：[{"id","label","key","baseUrl","model"}]，
 *                       已配置项出现在 GET 清单并排在命名 tier 之后参与级联
 * - ALERT_WEBHOOK     可选，告警 webhook（企业微信机器人）；仅从环境变量读取，未配置时跳过告警推送
 * - SEATMARK_AI_ANON_FALLBACK  可选，设为 '0' 时跳过 Pollinations 匿名兜底；默认开启
 *
 * 防护：
 * - 请求体 > 32KB → 413（先看 Content-Length，再看实际字节数）
 * - 按 IP 1 小时滑动窗口最多 30 次 → 429 + Retry-After
 * - 有密钥上游 fetch 共用 25s AbortController 超时；任一上游超时后不再尝试后续上游，直接 504
 * - 匿名 Pollinations 兜底两个 model 共用 10s 单一计时器（不叠加），到时直接 502 固定文案；
 *   每次 fetch 的 eo.timeoutSetting 只给到剩余预算（connect ≤ 3s，read/write = 剩余 - connect），
 *   运行时不及时响应 AbortSignal 时总耗时仍不超预算
 * - 无任何密钥且匿名兜底关闭 → 不发任何上游请求，直接 502（fail fast）
 * - 主模型告警推送不阻塞上游链路（有 waitUntil 时后台完成，否则不等待）
 * - 上游失败的诊断（模型名 / HTTP 状态）只进日志；502 响应体为固定文案，不泄露上游模型名
 * - 回复 content > 20KB 截断并在响应顶层标记 truncated:true
 *
 * 存储降级：AI 为可选功能，存储为 memory（未放行）时限频跳过、只保留字节上限与超时——
 * 与 [[default]].js 对持久化写入（配额/会话）的 fail-closed 503 不同，这里没有需要保护的持久化数据。
 */

import { withSecurityHeaders } from './_security.js'
import { getStorage } from './_storage.js'
import { json, clientIp, sha256Hex } from './_http.js'
import { SEATMARK_REV, REV_HEADER_NAME } from './_rev.js'

export const AI_MAX_BODY_BYTES = 32 * 1024
export const AI_RATE_LIMIT = 30
export const AI_RATE_WINDOW_MS = 60 * 60 * 1000
export const AI_UPSTREAM_TIMEOUT_MS = 25_000
export const AI_ANON_FALLBACK_TIMEOUT_MS = 10_000
/** 剩余预算低于此值时不再发起下一个 model 的请求 */
export const AI_ANON_FALLBACK_MIN_BUDGET_MS = 500
/** 匿名兜底单次连接超时上限；connect + read 合计不超剩余预算 */
export const AI_ANON_FALLBACK_CONNECT_TIMEOUT_MS = 3_000
export const AI_MAX_CONTENT_CHARS = 20 * 1024

const encoder = new TextEncoder()

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'

const FALLBACK_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const FALLBACK_MODEL = 'glm-4-flash'

const EO_MODELS_BASE_URL = 'https://ai-gateway.edgeone.link/v1'
const EO_MODELS_MODEL = '@makers/deepseek-v4-flash'

/**
 * 命名上游 tier：请求体可带 upstream 指定首选上游，未指定时按序级联。
 * key() 返回 falsy 表示该 tier 未配置、自动跳过。
 */
const TIER_DEFS = [
  {
    id: 'deepseek',
    label: 'DeepSeek V4 Flash',
    key: (env) => env.DEEPSEEK_API_KEY,
    base: () => DEEPSEEK_BASE_URL,
    model: () => DEEPSEEK_MODEL,
    alert: true,
  },
  {
    id: 'zhipu',
    label: 'GLM-4-Flash',
    key: (env) => env.AI_API_KEY,
    base: (env) => String(env.AI_BASE_URL || FALLBACK_BASE_URL),
    model: (env) => env.AI_MODEL || FALLBACK_MODEL,
  },
  {
    id: 'eomodels',
    label: 'EO 内置模型',
    key: (env) => env.AI_GATEWAY_API_KEY || env.MAKERS_MODELS_KEY,
    base: (env) => String(env.AI_GATEWAY_BASE_URL || EO_MODELS_BASE_URL),
    model: (env) => env.AI_GATEWAY_MODEL || EO_MODELS_MODEL,
  },
]

/**
 * 扩展上游：环境变量 AI_UPSTREAMS 为 JSON 数组，元素形如
 * {"id":"siliconflow","label":"SiliconFlow","key":"sk-...","baseUrl":"https://api.siliconflow.cn/v1","model":"Qwen/Qwen2.5-7B-Instruct"}
 * 已配置项出现在 GET 清单里，并排在命名 tier 之后参与级联。
 */
function extraUpstreams(env) {
  try {
    const list = JSON.parse((env && env.AI_UPSTREAMS) || '[]')
    if (!Array.isArray(list)) return []
    return list
      .filter((u) => u && typeof u === 'object' && u.id && u.key && u.baseUrl && u.model)
      .map((u) => ({
        id: String(u.id),
        label: String(u.label || u.id),
        key: String(u.key),
        base: String(u.baseUrl),
        model: String(u.model),
      }))
  } catch {
    return []
  }
}

/** 当前已配置的上游清单（GET 探测接口与级联共用） */
function configuredTiers(env) {
  const named = TIER_DEFS.filter((t) => t.key(env)).map((t) => ({ id: t.id, label: t.label }))
  const extra = extraUpstreams(env).map((u) => ({ id: u.id, label: u.label }))
  return [...named, ...extra]
}

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai'
const POLLINATIONS_MODELS = ['openai', 'openai-fast']

/**
 * 按 IP 的 1 小时滑动窗口限频：KV 中存最近一小时内的请求时间戳数组。
 * 返回 { limited, retryAfterSeconds }。
 */
async function checkRateLimit(kv, ip, now) {
  const key = `rl:ai:${(await sha256Hex(ip)).slice(0, 32)}`
  let stamps = []
  try {
    const parsed = JSON.parse((await kv.get(key)) || '[]')
    if (Array.isArray(parsed)) stamps = parsed.filter((t) => Number.isFinite(t) && now - t < AI_RATE_WINDOW_MS)
  } catch {
    stamps = []
  }
  if (stamps.length >= AI_RATE_LIMIT) {
    const oldest = Math.min(...stamps)
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((oldest + AI_RATE_WINDOW_MS - now) / 1000)) }
  }
  stamps.push(now)
  // 窗口外的时间戳读取时已被过滤，键本身随窗口过期自动清除
  await kv.put(key, JSON.stringify(stamps), { expirationTtl: Math.ceil(AI_RATE_WINDOW_MS / 1000) })
  return { limited: false, retryAfterSeconds: 0 }
}

/**
 * 上游 JSON 回复中 choices[0].message.content 超长则截断并在顶层标记 truncated:true；
 * 非 JSON 或结构不符时原样透传。
 */
function truncateReply(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return text
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : undefined
  if (typeof content !== 'string' || content.length <= AI_MAX_CONTENT_CHARS) return text
  data.choices[0].message.content = content.slice(0, AI_MAX_CONTENT_CHARS)
  data.truncated = true
  return JSON.stringify(data)
}

function isAbortError(e) {
  return !!e && typeof e === 'object' && e.name === 'AbortError'
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
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    /* 推送失败不阻塞 */
  }
}

const UNAVAILABLE_ERROR = 'AI 服务暂时不可用，请稍后再试'

function hasUpstreamKey(env) {
  return !!(env && (env.DEEPSEEK_API_KEY || env.AI_API_KEY || env.AI_GATEWAY_API_KEY || env.MAKERS_MODELS_KEY))
}

function anonFallbackOn(env) {
  return String((env && env.SEATMARK_AI_ANON_FALLBACK) ?? '') !== '0'
}

export async function onRequest(context) {
  const res = await handleRequest(context)
  res.headers.set(REV_HEADER_NAME, SEATMARK_REV)
  return withSecurityHeaders(res)
}

async function handleRequest(context) {
  const { request, env } = context
  const waitUntil =
    typeof context.waitUntil === 'function' ? (p) => context.waitUntil(p) : (p) => void p.catch(() => {})

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  // GET：返回站点已配置的可选模型清单（前端据此列出「站点提供」选项；不暴露任何密钥）
  if (request.method === 'GET') {
    return json({ models: configuredTiers(env) }, 200)
  }
  if (request.method !== 'POST') return json({ error: '请求方法不支持' }, 405)

  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > AI_MAX_BODY_BYTES) {
    return json({ error: '请求内容过长，请精简设计要求后重试' }, 413)
  }
  let rawBody
  try {
    rawBody = await request.text()
  } catch {
    return json({ error: '请求体格式错误' }, 400)
  }
  if (encoder.encode(rawBody).length > AI_MAX_BODY_BYTES) {
    return json({ error: '请求内容过长，请精简设计要求后重试' }, 413)
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: '请求体格式错误' }, 400)
  }

  const messages = payload && Array.isArray(payload.messages) ? payload.messages : null
  if (!messages || !messages.length || messages.length > 8) {
    return json({ error: '消息格式无效' }, 400)
  }
  for (const item of messages) {
    const roleOk = item && (item.role === 'system' || item.role === 'user')
    const contentOk = item && typeof item.content === 'string' && item.content.length <= 20000
    if (!roleOk || !contentOk) return json({ error: '消息内容无效' }, 400)
  }

  // 无任何上游可用：不发请求、不计限频，直接固定 502
  if (!hasUpstreamKey(env) && !anonFallbackOn(env)) {
    console.warn('[seatmark-ai-design] no upstream configured (anonFallback=off)')
    return json({ error: UNAVAILABLE_ERROR }, 502)
  }

  // 按 IP 限频：存储不可用（memory 未放行）时跳过，见文件头注释
  const { kv, storage } = await getStorage(env)
  const memoryAllowed = !!(env && env.SEATMARK_ALLOW_MEMORY_STORAGE === '1')
  if (storage !== 'memory' || memoryAllowed) {
    try {
      const rl = await checkRateLimit(kv, clientIp(request), Date.now())
      if (rl.limited) {
        return json({ error: 'AI 设计请求过于频繁，请稍后再试' }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        })
      }
    } catch {
      /* 计数读写失败不阻断可选功能 */
    }
  }

  const aborter = new AbortController()
  const timer = setTimeout(() => aborter.abort(), AI_UPSTREAM_TIMEOUT_MS)
  try {
    const upstreamPref =
      typeof payload.upstream === 'string' && /^[a-z0-9-]{1,32}$/i.test(payload.upstream)
        ? payload.upstream
        : null
    return await proxyUpstreams({ env, messages, signal: aborter.signal, waitUntil, upstreamPref })
  } finally {
    clearTimeout(timer)
  }
}

function okResponse(text) {
  return new Response(truncateReply(text), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function proxyUpstreams({ env, messages, signal, waitUntil, upstreamPref }) {
  let timedOut = false

  async function callUpstream(baseUrl, apiKey, model) {
    const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.6 }),
      signal,
      eo: {
        timeoutSetting: {
          connectTimeout: 30_000,
          readTimeout: 120_000,
          writeTimeout: 30_000,
        },
      },
    })
    return resp
  }

  // 有序上游列表：命名 tier（TIER_DEFS 顺序）+ AI_UPSTREAMS 扩展上游。
  // 请求指定 upstream 时把它提到首位尝试；该 tier 未配置则跳过、按默认顺序级联。
  const tiers = [
    ...TIER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      key: d.key(env),
      base: d.base(env),
      model: d.model(env),
      alert: !!d.alert,
    })),
    ...extraUpstreams(env).map((u) => ({
      id: u.id,
      label: u.label,
      key: u.key,
      base: u.base,
      model: u.model,
      alert: false,
    })),
  ]
  const ids = tiers.map((tr) => tr.id)
  const order =
    upstreamPref && tiers.some((tr) => tr.id === upstreamPref && tr.key)
      ? [upstreamPref, ...ids.filter((id) => id !== upstreamPref)]
      : ids

  for (const id of order) {
    if (timedOut) break
    const tier = tiers.find((tr) => tr.id === id)
    if (!tier || !tier.key) continue
    try {
      const upstream = await callUpstream(tier.base, tier.key, tier.model)
      if (upstream.ok) return okResponse(await upstream.text())
      if (tier.alert) {
        const errBody = await upstream.text().catch(() => '')
        waitUntil(sendAlert(env, alertLevel(upstream.status), `HTTP ${upstream.status} ${errBody.slice(0, 200)}`))
      }
    } catch (e) {
      if (isAbortError(e)) timedOut = true
      if (tier.alert) {
        waitUntil(
          sendAlert(env, '网络异常', `网络异常 ${e instanceof Error ? e.message : String(e)}`),
        )
      }
    }
  }

  // 无密钥兜底：服务端代理 Pollinations 匿名接口（前端不直连，这是唯一的第三方调用点）；
  // SEATMARK_AI_ANON_FALLBACK=0 时关闭，有密钥上游超时后也不再尝试。
  // 两个 model 共用一个 10s 计时器：到时即停止尝试并返回固定 502，不与 25s 主超时叠加。
  const anonFallbackEnabled = anonFallbackOn(env)
  const attempts = []
  if (anonFallbackEnabled && !timedOut) {
    const anonAborter = new AbortController()
    const abortAnon = () => anonAborter.abort()
    const anonDeadline = Date.now() + AI_ANON_FALLBACK_TIMEOUT_MS
    const anonTimer = setTimeout(abortAnon, AI_ANON_FALLBACK_TIMEOUT_MS)
    if (signal.aborted) abortAnon()
    else signal.addEventListener('abort', abortAnon)
    try {
      for (const model of POLLINATIONS_MODELS) {
        if (anonAborter.signal.aborted) break
        const budget = anonDeadline - Date.now()
        if (budget < AI_ANON_FALLBACK_MIN_BUDGET_MS) {
          attempts.push(`${model}: 预算不足跳过`)
          break
        }
        const connectTimeout = Math.min(budget, AI_ANON_FALLBACK_CONNECT_TIMEOUT_MS)
        const transferTimeout = Math.max(budget - connectTimeout, AI_ANON_FALLBACK_MIN_BUDGET_MS)
        try {
          const upstream = await fetch(POLLINATIONS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, temperature: 0.6 }),
            signal: anonAborter.signal,
            eo: {
              timeoutSetting: {
                connectTimeout,
                readTimeout: transferTimeout,
                writeTimeout: transferTimeout,
              },
            },
          })
          if (upstream.ok) return okResponse(await upstream.text())
          const errBody = await upstream.text().catch(() => '')
          // 上游诊断只进 Workers 日志，不回给客户端
          console.warn(`[seatmark-ai-design] ${model}: HTTP ${upstream.status} ${errBody.slice(0, 300)}`)
          attempts.push(`${model}: HTTP ${upstream.status}`)
        } catch (e) {
          if (isAbortError(e)) {
            if (signal.aborted) timedOut = true
            console.warn(`[seatmark-ai-design] ${model}: anon fallback timed out`)
            attempts.push(`${model}: 超时`)
            break
          }
          console.warn(`[seatmark-ai-design] ${model}: ${e instanceof Error ? e.message : String(e)}`)
          attempts.push(`${model}: 网络异常`)
        }
      }
    } finally {
      clearTimeout(anonTimer)
      signal.removeEventListener('abort', abortAnon)
    }
  }

  if (timedOut) return json({ error: 'AI 服务响应超时，请稍后再试' }, 504)
  // 各上游的模型名 / HTTP 状态已逐条 console.warn；这里只汇总次数，响应体固定文案
  console.warn(
    `[seatmark-ai-design] all upstreams failed (anonFallback=${anonFallbackEnabled ? 'on' : 'off'}, attempts=${attempts.length})`,
  )
  return json({ error: UNAVAILABLE_ERROR }, 502)
}
