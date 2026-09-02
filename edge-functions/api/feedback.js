/**
 * 用户反馈收集（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/feedback
 * 请求体：{ type: 'bug'|'suggestion'|'other', content: string, contact?: string }
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - FEEDBACK_WEBHOOK  可选，飞书/钉钉/企业微信机器人 webhook URL；未配置时不推送，反馈仅落库
 *   （源码内不内置任何 webhook 地址）
 *
 * 存储：与主 API 同源的三级后备（KV → Blob → 内存，见 _storage.js）。线上持久化存储缺失时
 * 返回 503 {code:'storage_unavailable'}，不再静默写内存后报成功。
 * 反馈存档到 fb: 前缀供管理端 /api/admin/feedback 查看；限频计数用 rl:fb: 前缀。
 */

import { getStorage, StorageUnavailableError } from './_storage.js'
import { withSecurityHeaders } from './_security.js'

const FEEDBACK_IP_DAILY_LIMIT = 10

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  })
}

export async function onRequest(context) {
  return withSecurityHeaders(await handleRequest(context))
}

async function handleRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method !== 'POST') return json({ error: '请求方法不支持' }, 405)

  let payload
  try {
    payload = await request.json()
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

  let kv
  let storage
  try {
    ;({ kv, storage } = await getStorage(env, { hostname: new URL(request.url).hostname }))
  } catch (err) {
    if (!(err instanceof StorageUnavailableError)) throw err
    return json(
      { error: '服务端存储未就绪，请稍后重试', code: err.code },
      503,
      { 'X-SeatMark-Storage': 'unavailable' },
    )
  }
  const storageHeader = { 'X-SeatMark-Storage': storage }

  // 防滥用：同一 IP 每日限量（IP 经单向哈希后仅用作限频计数）
  try {
    const ip =
      request.headers.get('EO-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
    const ipHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    const day = new Date().toISOString().slice(0, 10)
    const rlKey = `rl:fb:${ipHash}:${day}`
    const count = Number((await kv.get(rlKey)) || 0)
    if (count >= FEEDBACK_IP_DAILY_LIMIT) {
      return json({ error: '今日反馈次数已达上限，请明天再试' }, 429, storageHeader)
    }
    await kv.put(rlKey, String(count + 1))
  } catch {
    // 限频失败不阻塞提交
  }

  // 存档（供管理端查看），失败不阻塞
  try {
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
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

  const webhook = env && env.FEEDBACK_WEBHOOK
  if (webhook) {
    const typeLabel = { bug: '问题', suggestion: '建议', other: '其他' }[type]
    const text = [
      `【用户反馈】${typeLabel}`,
      `内容：${content}`,
      contact ? `联系方式：${contact}` : '',
      `时间：${new Date().toISOString()}`,
      `页面：${payload.page || ''}`,
    ].filter(Boolean).join('\n')

    // 企业微信机器人与飞书/钉钉的消息体结构不同，按 webhook 域名区分
    let isWeCom = false
    try {
      isWeCom = new URL(webhook).hostname.endsWith('.weixin.qq.com')
    } catch {
      /* 非法 URL 交给 fetch 报错并被忽略 */
    }
    const body = isWeCom
      ? { msgtype: 'text', text: { content: text } }
      : { msg_type: 'text', content: { text } }

    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      // 推送失败不阻塞用户，静默忽略
    }
  }

  return json({ ok: true }, 200, storageHeader)
}
