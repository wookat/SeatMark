import { isValidTemplate } from '@/utils/templateValidate'
import { apiFetch, ApiError } from '@/utils/api'
import type { LabelTemplate } from '@/types/template'

/**
 * 模板分享链接：把模板 JSON 压缩后编码进 URL hash，完全无需服务器。
 * 编码格式：
 *   v1.<base64url(deflate-raw(utf8(json)))>  —— 支持 CompressionStream 的环境
 *   v0.<base64url(utf8(json))>               —— 降级（无压缩）
 */

export const SHARE_HASH_PREFIX = '#tpl='

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function pipeThrough(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const reader = source.pipeThrough(transform).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** 把模板编码为 hash 负载（不含 #tpl= 前缀） */
export async function encodeTemplateForShare(template: LabelTemplate): Promise<string> {
  const json = JSON.stringify(template)
  const utf8 = new TextEncoder().encode(json)
  if (typeof CompressionStream !== 'undefined') {
    const compressed = await pipeThrough(utf8, new CompressionStream('deflate-raw'))
    return `v1.${bytesToBase64Url(compressed)}`
  }
  return `v0.${bytesToBase64Url(utf8)}`
}

/** 解析 hash 负载；非法/不支持时返回 null */
export async function decodeSharedTemplate(payload: string): Promise<LabelTemplate | null> {
  try {
    let utf8: Uint8Array
    if (payload.startsWith('v1.')) {
      if (typeof DecompressionStream === 'undefined') return null
      utf8 = await pipeThrough(
        base64UrlToBytes(payload.slice(3)),
        new DecompressionStream('deflate-raw'),
      )
    } else if (payload.startsWith('v0.')) {
      utf8 = base64UrlToBytes(payload.slice(3))
    } else {
      return null
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(utf8))
    return isValidTemplate(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * 短码分享（微信扫码）：把模板负载寄存到同源边缘函数 KV，二维码只编码
 * `https://域名/?s=短码` 这样的短 URL，扫码密度低、手机远距离可识别。
 * 短码由负载内容寻址（sha256 前 10 位），同一模板重复分享短码一致。
 */
export const SHARE_SHORT_PARAM = 's'
export const SHARE_SHORT_CODE_RE = /^[0-9a-f]{10}$/

/** 5xx/网络失败自动重试的指数退避间隔（边缘存储偶发 545 多为瞬时抖动） */
const SHORT_SHARE_RETRY_DELAYS_MS = [400, 900]

function isRetriableShareError(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status >= 500
}

async function apiFetchWithRetry<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  delays: readonly number[] = SHORT_SHARE_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiFetch<T>(path, options)
    } catch (err) {
      if (!isRetriableShareError(err) || attempt >= delays.length) throw err
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
    }
  }
}

/** 寄存模板负载换取短码（5xx/网络失败自动重试）；仍失败时返回 null（调用方弹窗重试/长链兜底） */
export async function createShortShareCode(payload: string): Promise<string | null> {
  try {
    const res = await apiFetchWithRetry<{ code?: string }>('/api/share/tpl', {
      method: 'POST',
      body: { payload },
    })
    return typeof res.code === 'string' && SHARE_SHORT_CODE_RE.test(res.code) ? res.code : null
  } catch {
    return null
  }
}

/** 按短码取回模板负载（5xx/网络失败自动重试）；不存在/仍失败返回 null */
export async function fetchSharedPayload(code: string): Promise<string | null> {
  if (!SHARE_SHORT_CODE_RE.test(code)) return null
  try {
    const res = await apiFetchWithRetry<{ payload?: string }>(
      `/api/share/tpl?code=${encodeURIComponent(code)}`,
    )
    return typeof res.payload === 'string' ? res.payload : null
  } catch {
    return null
  }
}

/** 从完整 hash（如 '#tpl=v1.xxx'）中提取负载 */
export function extractSharePayload(hash: string): string | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  const payload = hash.slice(SHARE_HASH_PREFIX.length)
  return payload || null
}

/** 复制文本到剪贴板，返回是否成功 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续走降级路径
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}
