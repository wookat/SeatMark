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
 * - ALERT_WEBHOOK     可选，告警 webhook（企业微信机器人），未配置时使用内置默认值
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-v4-pro'

const FALLBACK_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const FALLBACK_MODEL = 'glm-4-flash'

const ALERT_WEBHOOK_DEFAULT = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=f987cae8-5740-41a8-9492-f11325d894e1'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
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
  const webhook = (env && env.ALERT_WEBHOOK) || ALERT_WEBHOOK_DEFAULT
  if (!webhook) return
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
      // DeepSeek 返回非 200：读取错误详情并告警
      const errBody = await upstream.text().catch(() => '')
      const level = alertLevel(upstream.status)
      const detail = `HTTP ${upstream.status} ${errBody.slice(0, 200)}`
      await sendAlert(env, level, detail)
    } catch (e) {
      // DeepSeek 网络异常：告警
      const detail = `网络异常 ${e instanceof Error ? e.message : String(e)}`
      await sendAlert(env, '网络异常', detail)
    }
  }

  // 兜底：智谱 glm-4-flash
  const fallbackKey = env && env.AI_API_KEY
  if (!fallbackKey) {
    const msg = deepseekKey
      ? 'DeepSeek 主模型暂不可用，已告警；请稍后重试或切换「自定义 API」'
      : 'AI proxy not configured'
    return json({ error: msg }, 501)
  }

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
