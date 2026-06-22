/**
 * AI 标签设计同源代理（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/ai-design   请求体：{ messages: [{ role, content }, ...] }
 * 作用：用站长配置的密钥转发到上游大模型，让访客无需任何配置即可使用 AI 设计。
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - AI_API_KEY   必填，上游接口密钥（推荐智谱开放平台，glm-4-flash 永久免费）
 * - AI_BASE_URL  可选，OpenAI 兼容接口地址，默认 https://open.bigmodel.cn/api/paas/v4
 * - AI_MODEL     可选，模型名，默认 glm-4-flash
 *
 * 未配置 AI_API_KEY 时返回 501，前端会自动回退到公共免费接口。
 */

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const DEFAULT_MODEL = 'glm-4-flash'

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

  const apiKey = env && env.AI_API_KEY
  if (!apiKey) return json({ error: 'AI proxy not configured' }, 501)

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

  const baseUrl = String((env && env.AI_BASE_URL) || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: (env && env.AI_MODEL) || DEFAULT_MODEL,
        messages,
        temperature: 0.6,
      }),
    })
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    return json({ error: 'Upstream request failed' }, 502)
  }
}
