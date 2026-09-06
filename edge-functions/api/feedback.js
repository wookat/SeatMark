/**
 * 用户反馈收集（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/feedback
 * 请求体：{ type: 'bug'|'suggestion'|'other', content: string, contact?: string }
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - FEEDBACK_WEBHOOK  可选，飞书/钉钉/企业微信机器人 webhook URL
 *   仅从环境变量读取，代码中不允许出现任何 webhook key 字面量；
 *   未配置时跳过推送（console.warn），反馈仍正常存档并返回成功
 *
 * 存储：与主 API 同源的三级后备（KV → Blob → 内存，见 _storage.js）。
 * 反馈存档到 fb: 前缀供管理端 /api/admin/feedback 查看；限频计数用 rl:fb: 前缀。
 *
 * 防护：请求体 > 32KB → 413（先看 Content-Length，再看实际字节数，不先 JSON.parse 超大体）。
 */

import { getStorage } from './_storage.js'
import { withSecurityHeaders } from './_security.js'
import { randomToken36 } from './_random.js'
import { json, clientIp, sha256Hex } from './_http.js'

const FEEDBACK_IP_DAILY_LIMIT = 10
export const FEEDBACK_MAX_BODY_BYTES = 32 * 1024

const encoder = new TextEncoder()

export async function onRequest(context) {
  return withSecurityHeaders(await handleRequest(context))
}

async function handleRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method !== 'POST') return json({ error: '请求方法不支持' }, 405)

  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > FEEDBACK_MAX_BODY_BYTES) {
    return json({ error: '请求体过大' }, 413)
  }
  let rawBody
  try {
    rawBody = await request.text()
  } catch {
    return json({ error: '请求体格式错误' }, 400)
  }
  if (encoder.encode(rawBody).length > FEEDBACK_MAX_BODY_BYTES) {
    return json({ error: '请求体过大' }, 413)
  }
  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: '请求体格式错误' }, 400)
  }

  const type = payload && typeof payload.type === 'string' ? payload.type : ''
  const content = payload && typeof payload.content === 'string' ? payload.content.trim() : ''
  const contact = payload && typeof payload.contact === 'string' ? payload.contact.trim() : ''

  const validTypes = ['bug', 'suggestion', 'other']
  if (!validTypes.includes(type)) return json({ error: '反馈类型无效' }, 400)
  if (!content || content.length > 2000) return json({ error: '请填写反馈内容（不超过 2000 字）' }, 400)
  if (contact.length > 200) return json({ error: '联系方式过长' }, 400)

  const { kv } = await getStorage(env)

  // 防滥用：同一 IP 每日限量（IP 经单向哈希后仅用作限频计数）
  try {
    const ipHash = await sha256Hex(clientIp(request))
    const day = new Date().toISOString().slice(0, 10)
    const rlKey = `rl:fb:${ipHash}:${day}`
    const count = Number((await kv.get(rlKey)) || 0)
    if (count >= FEEDBACK_IP_DAILY_LIMIT) {
      return json({ error: '今日反馈次数已达上限，请明天再试' }, 429)
    }
    await kv.put(rlKey, String(count + 1))
  } catch {
    // 限频失败不阻塞提交
  }

  // 存档（供管理端查看），失败不阻塞
  try {
    const id = `${Date.now()}-${randomToken36(6)}`
    await kv.put(
      `fb:${id}`,
      JSON.stringify({
        type,
        content,
        contact,
        page: typeof payload.page === 'string' ? payload.page.slice(0, 200) : '',
        createdAt: new Date().toISOString(),
      }),
    )
  } catch {
    // 存档失败静默忽略
  }

  const webhook = (env && typeof env.FEEDBACK_WEBHOOK === 'string' && env.FEEDBACK_WEBHOOK.trim()) || ''
  if (!webhook) {
    console.warn('[seatmark-feedback] webhook not configured')
  } else {
    const typeLabel = { bug: '问题', suggestion: '建议', other: '其他' }[type]
    const text = [
      `【用户反馈】${typeLabel}`,
      `内容：${content}`,
      contact ? `联系方式：${contact}` : '',
      `时间：${new Date().toISOString()}`,
      `页面：${payload.page || ''}`,
    ].filter(Boolean).join('\n')

    const isWeCom = webhook.includes('qyapi.weixin.qq.com')
    const body = isWeCom
      ? { msgtype: 'text', text: { content: text } }
      : { msg_type: 'text', content: { text } }

    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      // 推送失败不阻塞用户，静默忽略
    }
  }

  return json({ ok: true })
}
