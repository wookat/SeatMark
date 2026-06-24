/**
 * 用户反馈收集（EdgeOne Pages Edge Function）
 *
 * 路由：POST /api/feedback
 * 请求体：{ type: 'bug'|'suggestion'|'other', content: string, contact?: string }
 *
 * 环境变量（EdgeOne Pages 控制台配置）：
 * - FEEDBACK_WEBHOOK  可选，飞书/钉钉/企业微信机器人 webhook URL
 *   配置后反馈会推送到对应群聊；未配置时仅返回成功（反馈丢弃但不报错）
 */

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

  const type = payload && typeof payload.type === 'string' ? payload.type : ''
  const content = payload && typeof payload.content === 'string' ? payload.content.trim() : ''
  const contact = payload && typeof payload.contact === 'string' ? payload.contact.trim() : ''

  const validTypes = ['bug', 'suggestion', 'other']
  if (!validTypes.includes(type)) return json({ error: 'Invalid feedback type' }, 400)
  if (!content || content.length > 2000) return json({ error: 'Content required (max 2000 chars)' }, 400)
  if (contact.length > 200) return json({ error: 'Contact too long' }, 400)

  const webhook = (env && env.FEEDBACK_WEBHOOK) || 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=f987cae8-5740-41a8-9492-f11325d894e1'
  if (webhook) {
    const typeLabel = { bug: '🐛 Bug', suggestion: '💡 建议', other: '💬 其他' }[type]
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
      })
    } catch {
      // 推送失败不阻塞用户，静默忽略
    }
  }

  return json({ ok: true })
}
