/**
 * 本地开发 API 中间件：在 vite dev server 中直接运行 edge-functions 代码，
 * 模拟 EdgeOne Pages 的路由与 KV（进程内存），用于登录/配额/管理端全链路联调。
 *
 * 仅在 `npm run dev` 时生效，不参与生产构建。
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 跨函数文件共享的进程内 KV（模拟 EdgeOne KV 绑定） */
const devKvStore = new Map()
const devKv = {
  async get(key) {
    return devKvStore.has(key) ? devKvStore.get(key) : null
  },
  async put(key, value) {
    devKvStore.set(key, String(value))
  },
  async delete(key) {
    devKvStore.delete(key)
  },
  async list({ prefix = '', limit = 256, cursor = '' } = {}) {
    const keys = [...devKvStore.keys()].filter((k) => k.startsWith(prefix)).sort()
    const start = cursor ? keys.indexOf(cursor) + 1 : 0
    const page = keys.slice(start, start + limit)
    return {
      keys: page.map((name) => ({ name })),
      complete: start + limit >= keys.length,
      cursor: page.length ? page[page.length - 1] : '',
    }
  },
}

/** 模拟 EdgeOne Pages Blob Store（与 @edgeone/pages-blob Store 同接口子集） */
const devBlobStore = new Map()
const devBlob = {
  async get(key) {
    return devBlobStore.has(key) ? devBlobStore.get(key) : null
  },
  async set(key, value) {
    devBlobStore.set(key, String(value))
  },
  async delete(key) {
    devBlobStore.delete(key)
  },
  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = [...devBlobStore.keys()].filter((k) => k.startsWith(prefix)).sort()
    const start = cursor ? keys.indexOf(cursor) + 1 : 0
    const page = keys.slice(start, start + limit)
    const hasMore = start + limit < keys.length
    return {
      blobs: page.map((key) => ({ key, etag: '' })),
      directories: [],
      ...(hasMore && page.length ? { cursor: page[page.length - 1] } : {}),
    }
  },
}

function devEnv() {
  // DEV_FORCE_BLOB=1 时不绑 KV，联调 Blob 后备链路（KV → Blob → 内存）
  const forceBlob = process.env.DEV_FORCE_BLOB === '1'
  return {
    ...(forceBlob ? {} : { seatmark_kv: devKv }),
    seatmark_blob: devBlob,
    AUTH_SECRET: process.env.AUTH_SECRET || 'seatmark-dev-secret',
    ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin@seatmark.cn',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    FEEDBACK_WEBHOOK: process.env.FEEDBACK_WEBHOOK || '',
  }
}

async function nodeReqToWebRequest(req) {
  const url = `http://${req.headers.host || 'localhost'}${req.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = Buffer.concat(chunks)
  }
  return new Request(url, { method: req.method, headers, body })
}

export function devApiPlugin() {
  return {
    name: 'seatmark-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        try {
          const pathname = req.url.split('?')[0]
          let modPath = resolve(root, 'edge-functions/api/[[default]].js')
          if (pathname === '/api/feedback') {
            modPath = resolve(root, 'edge-functions/api/feedback.js')
          } else if (pathname === '/api/ai-design') {
            modPath = resolve(root, 'edge-functions/api/ai-design.js')
          }
          const mod = await import(modPath)
          const request = await nodeReqToWebRequest(req)
          const response = await mod.onRequest({ request, env: devEnv() })
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}
