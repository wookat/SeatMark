import type { Breadcrumb, Event as SentryEvent, EventHint } from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import { telemetryPath } from '@/router'

/**
 * Sentry 懒初始化：主包只带本文件（类型导入不进产物），@sentry/vue 在 app.mount 后
 * 等浏览器空闲（或首个错误事件）再动态 import；初始化前的 window error / unhandledrejection
 * 先入临时队列，init 后回放。
 */

export const SENTRY_DSN =
  'https://e07e934a609b9b8aab670cf18d669e42@o4511621503451136.ingest.us.sentry.io/4511621514592256'

type SentryModule = typeof import('@sentry/vue')
type SentryInitOptions = NonNullable<Parameters<SentryModule['init']>[0]>

export interface PendingError {
  kind: 'onerror' | 'onunhandledrejection'
  error: unknown
}

export interface PreInitErrorQueue {
  /** 取出并清空已缓存的错误（只保留最早的 max 条，防止错误风暴撑爆内存） */
  drain(): PendingError[]
  /** 解绑监听；init 成功后由 Sentry 自身的全局处理器接管 */
  dispose(): void
  /** 当前已缓存的错误条数 */
  size(): number
}

export function createPreInitErrorQueue(target: Window, max = 20): PreInitErrorQueue {
  const pending: PendingError[] = []
  const onError = (ev: ErrorEvent) => {
    if (pending.length >= max) return
    pending.push({ kind: 'onerror', error: ev.error ?? ev.message })
  }
  const onRejection = (ev: PromiseRejectionEvent) => {
    if (pending.length >= max) return
    pending.push({ kind: 'onunhandledrejection', error: ev.reason })
  }
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return {
    drain() {
      return pending.splice(0, pending.length)
    },
    dispose() {
      target.removeEventListener('error', onError)
      target.removeEventListener('unhandledrejection', onRejection)
    },
    size() {
      return pending.length
    },
  }
}

const DATA_URL_RE = /data:[a-z0-9.+/-]*(?:;[a-z0-9=.+-]*)*,[^\s"'\])>]*/gi

/**
 * 内嵌 data: URL（用户上传的 Logo / 照片 base64）一律替换为占位符。
 * Sentry 的长动画帧脚本归因会把 `IMG[src=data:image/png;base64,…]` 这类 invoker 原样放进 span.data，
 * 不清洗就等于把用户图片发到了第三方。
 */
export function redactDataUrls(value: string): string {
  return value.replace(DATA_URL_RE, 'data:[redacted]')
}

function redactDataUrlsIn(record: Record<string, unknown> | undefined): void {
  if (!record) return
  for (const key of Object.keys(record)) {
    const v = record[key]
    if (typeof v === 'string' && v.includes('data:')) record[key] = redactDataUrls(v)
  }
}

/** 形如「路径?查询」的字符串才清洗，避免把异常消息里的普通文本误改 */
function scrubIfPath(value: unknown): unknown {
  if (typeof value !== 'string' || !value.includes('?')) return value
  return telemetryPath(value)
}

export function scrubBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T {
  const data = breadcrumb.data
  if (data) {
    for (const key of ['from', 'to', 'url'] as const) {
      if (typeof data[key] === 'string') {
        data[key] = telemetryPath(data[key])
      }
    }
    redactDataUrlsIn(data)
  }
  return breadcrumb
}

/**
 * 错误事件与性能事务共用的清洗：request.url、transaction、tags、
 * exception 栈帧 URL、事件内 breadcrumb URL、span 描述统一剥离 ?q= 等用户输入参数。
 * 只改字段值，不改事件结构。
 */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.request?.url) {
    event.request.url = telemetryPath(event.request.url)
  }
  if (event.transaction) {
    event.transaction = telemetryPath(event.transaction)
  }
  if (event.tags) {
    for (const key of Object.keys(event.tags)) {
      event.tags[key] = scrubIfPath(event.tags[key]) as typeof event.tags[string]
    }
  }
  if (typeof event.message === 'string' && event.message.includes('data:')) {
    event.message = redactDataUrls(event.message)
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value?.includes('data:')) exception.value = redactDataUrls(exception.value)
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = telemetryPath(frame.filename)
      if (frame.abs_path) frame.abs_path = telemetryPath(frame.abs_path)
    }
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    scrubBreadcrumb(breadcrumb)
  }
  for (const span of event.spans ?? []) {
    if (span.description) {
      span.description = redactDataUrls(telemetryPath(span.description))
    }
    redactDataUrlsIn(span.data)
  }
  return event
}

export function buildSentryOptions(
  sentry: Pick<SentryModule, 'browserTracingIntegration'>,
  app: App,
  router: Router,
): SentryInitOptions {
  return {
    app,
    dsn: SENTRY_DSN,
    integrations: [sentry.browserTracingIntegration({ router })],
    tracesSampleRate: 0.2,
    beforeSend(event) {
      return scrubEvent(event)
    },
    // 性能事务的浏览器指标 span 取自 PerformanceNavigationTiming（初始文档 URL），
    // history.replaceState 改写不了它——上报前统一剥离搜索词等用户输入参数
    beforeSendTransaction(event) {
      return scrubEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb)
    },
  }
}

export interface InstallSentryDeps {
  load?: () => Promise<Pick<SentryModule, 'init' | 'browserTracingIntegration' | 'captureException'>>
  queue?: PreInitErrorQueue
}

/**
 * 在 app 挂载后调用：动态加载 @sentry/vue 并用「同一个已挂载的 app」初始化
 * （init 传入 app 即自动挂 Vue errorHandler，不再单独 attachErrorHandler），
 * 然后回放初始化前队列里的错误。加载失败只 warn，不影响页面。
 */
export async function installSentry(app: App, router: Router, deps: InstallSentryDeps = {}): Promise<boolean> {
  const queue = deps.queue ?? createPreInitErrorQueue(window)
  const load = deps.load ?? (() => import('@sentry/vue'))
  let sentry: Awaited<ReturnType<NonNullable<InstallSentryDeps['load']>>>
  try {
    sentry = await load()
  } catch (err) {
    queue.dispose()
    console.warn('[sentry] 懒加载失败，本次会话不上报:', err)
    return false
  }
  sentry.init(buildSentryOptions(sentry, app, router))
  queue.dispose()
  for (const pending of queue.drain()) {
    const hint: EventHint = { mechanism: { type: pending.kind, handled: false } }
    sentry.captureException(pending.error, hint)
  }
  return true
}

/** requestIdleCallback 最迟触发时限 / 不支持时的 setTimeout 兜底延迟（ms） */
export const SENTRY_IDLE_TIMEOUT_MS = 3000
/** window load 之后先等这么久再进 idle 调度（ms）：避开 load 紧跟的预渲染水合 / 预取窗口，不同首屏交互争主线程 */
export const SENTRY_POST_LOAD_DELAY_MS = 1500

export interface ScheduleSentryDeps extends InstallSentryDeps {
  /** 监听 error / idle 的窗口对象（默认 window） */
  target?: Window
  /** 实际执行加载与初始化的函数（默认 installSentry） */
  install?: typeof installSentry
  /** idle 时限 / 兜底延迟（默认 SENTRY_IDLE_TIMEOUT_MS） */
  idleTimeoutMs?: number
  /** load 后进入 idle 调度前的固定延迟（默认 SENTRY_POST_LOAD_DELAY_MS） */
  postLoadDelayMs?: number
}

/**
 * 把 installSentry 从「挂载后立即」推迟到「浏览器空闲」：等 window load（首屏资源都拿到）之后再固定延迟
 * postLoadDelayMs，然后 requestIdleCallback（带 timeout 上限，不支持时 setTimeout 兜底），或首个 window error /
 * unhandledrejection 事件，二者先到者触发，且只触发一次（错误不受延迟影响）；调度时队列里已有挂载期错误则立即触发。
 * 错误本身由（先于本函数注册的）预初始化队列缓存，init 后回放，不会丢失。
 */
export function scheduleSentryInstall(
  app: App,
  router: Router,
  deps: ScheduleSentryDeps = {},
): Promise<boolean> {
  const target = deps.target ?? window
  const queue = deps.queue ?? createPreInitErrorQueue(target)
  const install = deps.install ?? installSentry
  const idleTimeoutMs = deps.idleTimeoutMs ?? SENTRY_IDLE_TIMEOUT_MS
  const postLoadDelayMs = deps.postLoadDelayMs ?? SENTRY_POST_LOAD_DELAY_MS
  return new Promise<boolean>((resolve) => {
    let fired = false
    let idleHandle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let delayTimer: ReturnType<typeof setTimeout> | undefined
    const fire = () => {
      if (fired) return
      fired = true
      target.removeEventListener('error', fire)
      target.removeEventListener('unhandledrejection', fire)
      target.removeEventListener('load', afterLoad)
      if (idleHandle !== undefined && typeof target.cancelIdleCallback === 'function') {
        target.cancelIdleCallback(idleHandle)
      }
      if (timer !== undefined) clearTimeout(timer)
      if (delayTimer !== undefined) clearTimeout(delayTimer)
      resolve(install(app, router, { queue, load: deps.load }))
    }
    function scheduleIdle() {
      if (fired) return
      if (typeof target.requestIdleCallback === 'function') {
        idleHandle = target.requestIdleCallback(fire, { timeout: idleTimeoutMs })
      } else {
        timer = setTimeout(fire, idleTimeoutMs)
      }
    }
    function afterLoad() {
      if (fired) return
      delayTimer = setTimeout(scheduleIdle, postLoadDelayMs)
    }
    target.addEventListener('error', fire)
    target.addEventListener('unhandledrejection', fire)
    if (queue.size() > 0) {
      fire()
      return
    }
    const doc: Document | undefined = target.document
    if (doc && doc.readyState !== 'complete') {
      target.addEventListener('load', afterLoad, { once: true })
    } else {
      afterLoad()
    }
  })
}
