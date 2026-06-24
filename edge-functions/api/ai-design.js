/**
 * AI 标签设计同源代理（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/ai-design   请求体：{ messages: [{ role, content }, ...] }
 * 作用：用站长配置的密钥转发到上游大模型，让访客无需任何配置即可使用 AI 设计。
 *
 * 主模型：DeepSeek v4 Pro（通过环境变量 DEEPSEEK_API_KEY 配置）
 * 兜底模型：智谱 glm-4-flash（通过环境变量 AI_API_KEY 配置，永久免费）
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - DEEPSEEK_API_KEY  主模型密钥（DeepSeek 开放平台）
 * - AI_API_KEY        兜底密钥（智谱开放平台 glm-4-flash）
 * - AI_BASE_URL       兜底接口地址，默认 https://open.bigmodel.cn/api/paas/v4
 * - AI_MODEL          兜底模型名，默认 glm-4-flash
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-v4-pro'

const FALLBACK_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const FALLBACK_MODEL = 'glm-4-flash'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const messages = payload && Array.isArray(payload.messages) ? payload.messages : null
  if (!messages || !messages.length || messages.length > 8) {
    return json({ error: 'Invalid messages' }, 400)
  }
  for (const item of messages) {
    const roleOk = item && (item.role === 'system' || item.role === 'user')
    const contentOk = item && typeof item.content === 'string' && item.content.length <= 20000
    if (!roleOk || !contentOk) return json({ error: 'Invalid message item' }, 400)
  }

  async function callUpstream(baseUrl, apiKey, model) {
    const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.6 }),
    })
    return resp
  }

  // 主模型：DeepSeek v4 Pro
  const deepseekKey = env && env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    try {
    const upstream = await callUpstream(DEEPSEEK_BASE_URL, deepseekKey, DEEPSEEK_MODEL)
    if (upstream.ok) {
      const text = await upstream.text()
      return new Response(text, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }
    // DeepSeek 失败，尝试兜底
    } catch {
    // DeepSeek 请求异常，尝试兜底
    }
  }

  // 兜底：智谱 glm-4-flash
  const fallbackKey = env && env.AI_API_KEY
  if (!fallbackKey) return json({ error: 'AI proxy not configured' }, 501)

  const fallbackBaseUrl = String((env && env.AI_BASE_URL) || FALLBACK_BASE_URL)
  const fallbackModel = (env && env.AI_MODEL) || FALLBACK_MODEL

  try {
    const upstream = await callUpstream(fallbackBaseUrl, fallbackKey, fallbackModel)
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    return json({ error: 'Upstream request failed' }, 502)
  }
}
