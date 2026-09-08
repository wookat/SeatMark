import type { Event as SentryEvent } from '@sentry/vue'
import { createApp, defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import {
  buildSentryOptions,
  createPreInitErrorQueue,
  installSentry,
  redactDataUrls,
  scrubBreadcrumb,
  scrubEvent,
} from '@/utils/sentry'

type InitOptions = ReturnType<typeof buildSentryOptions>

function fakeSentry() {
  const init = vi.fn<(options: InitOptions) => void>()
  const captureException = vi.fn()
  const integration = { name: 'BrowserTracing' }
  const browserTracingIntegration = vi.fn(() => integration)
  return {
    init,
    captureException,
    browserTracingIntegration,
    integration,
    module: { init, captureException, browserTracingIntegration } as unknown as Parameters<
      typeof installSentry
    >[2] extends { load?: () => Promise<infer M> }
      ? M
      : never,
  }
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: defineComponent({ render: () => h('div') }) }],
  })
}

/** 用独立 EventTarget 代替 window：jsdom 上对 window 投递带 error 的 ErrorEvent 会被 vitest 计为未捕获异常 */
function fakeWindow() {
  return new EventTarget() as unknown as Window
}

function errorEvent(over: Record<string, unknown> = {}): SentryEvent {
  return {
    event_id: 'e1',
    request: { url: 'https://www.seatmark.cn/templates?q=张三&cat=exam' },
    transaction: '/templates?name=李四',
    tags: { route: '/seating?name=王五&mode=exam', plain: 'text' },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'boom',
          stacktrace: {
            frames: [
              {
                filename: 'https://www.seatmark.cn/studio?q=秘密&template=std',
                abs_path: 'https://www.seatmark.cn/studio?name=秘密',
              },
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      { category: 'navigation', data: { from: '/templates?q=a', to: '/studio?name=b&x=1' } },
      { category: 'fetch', data: { url: '/api/x?q=zzz', method: 'GET' } },
    ],
    ...over,
  } as SentryEvent
}

describe('scrubEvent / scrubBreadcrumb', () => {
  it('beforeSend 剥离 request.url / transaction / tags / 栈帧 URL / 面包屑里的 ?q= 与 ?name=', () => {
    const out = scrubEvent(errorEvent())
    expect(out.request?.url).toBe('https://www.seatmark.cn/templates?cat=exam')
    expect(out.transaction).toBe('/templates')
    expect(out.tags).toEqual({ route: '/seating?mode=exam', plain: 'text' })
    const frame = out.exception!.values![0]!.stacktrace!.frames![0]!
    expect(frame.filename).toBe('https://www.seatmark.cn/studio?template=std')
    expect(frame.abs_path).toBe('https://www.seatmark.cn/studio')
    expect(out.breadcrumbs![0]!.data).toEqual({ from: '/templates', to: '/studio?x=1' })
    expect(out.breadcrumbs![1]!.data).toEqual({ url: '/api/x', method: 'GET' })
    const serialized = JSON.stringify(out)
    expect(serialized).not.toMatch(/[?&]q=/)
    expect(serialized).not.toMatch(/[?&]name=/)
    expect(serialized).not.toContain('张三')
    expect(serialized).not.toContain('李四')
    expect(serialized).not.toContain('王五')
    expect(serialized).not.toContain('秘密')
  })

  it('事务事件：span 描述同规格清洗', () => {
    const out = scrubEvent({
      type: 'transaction',
      transaction: '/templates?q=x',
      spans: [{ description: '/templates?q=y&cat=exam', op: 'pageload' }],
    } as unknown as SentryEvent)
    expect(out.transaction).toBe('/templates')
    expect(out.spans![0]!.description).toBe('/templates?cat=exam')
  })

  it('第 329 轮：span.data / 面包屑 / 异常消息里的 data: URL（用户 Logo base64）上报前被抹掉', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const out = scrubEvent({
      type: 'transaction',
      transaction: '/studio',
      message: `img failed ${png}`,
      exception: { values: [{ type: 'Error', value: `cannot load ${png}` }] },
      breadcrumbs: [{ category: 'ui.click', data: { target: `IMG[src=${png}]` } }],
      spans: [
        {
          op: 'ui.long-animation-frame',
          description: `IMG[src=${png}]`,
          data: {
            'browser.script.invoker': `IMG[src=${png}]`,
            'code.filepath': 'https://www.seatmark.cn/assets/html2canvas-pro.js',
            'browser.script.invoker_type': 'event-listener',
          },
        },
      ],
    } as unknown as SentryEvent)
    const serialized = JSON.stringify(out)
    expect(serialized).not.toContain('iVBORw0KGgo')
    expect(serialized).not.toContain('base64,')
    expect(out.spans![0]!.data!['browser.script.invoker']).toBe('IMG[src=data:[redacted]]')
    expect(out.spans![0]!.data!['code.filepath']).toBe('https://www.seatmark.cn/assets/html2canvas-pro.js')
    expect(out.breadcrumbs![0]!.data).toEqual({ target: 'IMG[src=data:[redacted]]' })
    expect(out.message).toBe('img failed data:[redacted]')
    expect(out.exception!.values![0]!.value).toBe('cannot load data:[redacted]')
  })

  it('第 330 轮：percent-encoded svg+xml data URL 内的未编码 ) 与 > 不终止匹配——整段抹除且超长值截断', () => {
    const svg =
      'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cline%20style%3D%22stroke%3A%20oklch(0.5%200.1%20200)%3B%20-webkit-text-security%3A%20none%3B%20' +
      'color%3A%20rgb(0%2C%200%2C%200)%3B%20'.repeat(400) +
      '%22%3E%3C%2Fline%3E%3C%2Fsvg%3E'
    const invoker = `IMG[src=${svg}].onload`
    const out = redactDataUrls(invoker)
    expect(out).toBe('IMG[src=data:[redacted]].onload')
    expect(out).not.toContain('oklch')
    expect(out).not.toContain('webkit-text-security')

    const stubborn = `x ${'data:'.padEnd(3000, 'a')}`
    const cut = redactDataUrls(stubborn)
    expect(cut.length).toBeLessThan(1100)
    expect(cut.endsWith('…[truncated]')).toBe(true)
  })

  it('无可清洗字段的事件原样返回，不新增字段；异常消息文本不动', () => {
    const ev: SentryEvent = { event_id: 'x', message: 'hello' }
    expect(scrubEvent(ev)).toEqual({ event_id: 'x', message: 'hello' })
    const withText = errorEvent({ exception: { values: [{ type: 'Error', value: 'boom ?q=text' }] } })
    expect(scrubEvent(withText).exception!.values![0]!.value).toBe('boom ?q=text')
    expect(scrubBreadcrumb({ category: 'console', message: 'q=1' })).toEqual({
      category: 'console',
      message: 'q=1',
    })
  })
})

describe('buildSentryOptions / installSentry', () => {
  it('init 拿到的 app 就是被 mount 的同一个实例，且不再单独 attachErrorHandler', async () => {
    const s = fakeSentry()
    const router = makeRouter()
    const app = createApp(defineComponent({ render: () => h('div', 'ok') }))
    app.use(router)
    await router.isReady()
    const host = document.createElement('div')
    app.mount(host)
    expect(host.textContent).toBe('ok')

    const ok = await installSentry(app, router, {
      load: async () => s.module,
      queue: createPreInitErrorQueue(fakeWindow()),
    })
    expect(ok).toBe(true)
    expect(s.init).toHaveBeenCalledTimes(1)
    const options = s.init.mock.calls[0]![0]!
    expect(options.app).toBe(app)
    expect(options.integrations).toEqual([s.integration])
    expect(s.browserTracingIntegration).toHaveBeenCalledWith({ router })
    expect(options.dsn).toMatch(/^https:\/\/.+@.+\.ingest\..*sentry\.io\/\d+$/)
    expect(options.tracesSampleRate).toBe(0.2)
    expect(typeof options.beforeSend).toBe('function')
    expect(typeof options.beforeSendTransaction).toBe('function')
    expect(typeof options.beforeBreadcrumb).toBe('function')
    expect('attachErrorHandler' in s.module).toBe(false)
    app.unmount()
  })

  it('options.beforeSend 剥离 ?q= 与 ?name=', () => {
    const s = fakeSentry()
    const options = buildSentryOptions(s.module, createApp({}), makeRouter())
    const out = options.beforeSend!(
      { request: { url: 'https://www.seatmark.cn/templates?q=考场&name=张三&cat=exam' } } as never,
      {},
    ) as { request: { url: string } }
    expect(out.request.url).toBe('https://www.seatmark.cn/templates?cat=exam')
  })

  it('init 前的 window error / unhandledrejection 入队，init 后逐条 captureException 回放并解绑', async () => {
    const s = fakeSentry()
    const win = fakeWindow()
    const queue = createPreInitErrorQueue(win)
    const err1 = new Error('before-init')
    win.dispatchEvent(new ErrorEvent('error', { error: err1, message: 'before-init' }))
    // jsdom 的 PromiseRejectionEvent 可能不存在，用同名 Event 补齐 reason
    const rej = new Event('unhandledrejection') as Event & { reason?: unknown }
    rej.reason = 'rejected-before-init'
    win.dispatchEvent(rej)

    const app = createApp({})
    const ok = await installSentry(app, makeRouter(), { load: async () => s.module, queue })
    expect(ok).toBe(true)
    expect(s.captureException).toHaveBeenCalledTimes(2)
    expect(s.captureException.mock.calls[0]![0]).toBe(err1)
    expect(s.captureException.mock.calls[0]![1]).toEqual({
      mechanism: { type: 'onerror', handled: false },
    })
    expect(s.captureException.mock.calls[1]![0]).toBe('rejected-before-init')
    expect(s.captureException.mock.calls[1]![1]).toEqual({
      mechanism: { type: 'onunhandledrejection', handled: false },
    })
    // init 后队列已解绑：再触发不再进入队列
    win.dispatchEvent(new ErrorEvent('error', { error: new Error('after') }))
    expect(queue.drain()).toEqual([])
  })

  it('队列上限 20 条，超出丢弃', () => {
    const win = fakeWindow()
    const queue = createPreInitErrorQueue(win, 3)
    for (let i = 0; i < 5; i++) {
      win.dispatchEvent(new ErrorEvent('error', { error: new Error(String(i)) }))
    }
    const drained = queue.drain()
    expect(drained.map((p) => (p.error as Error).message)).toEqual(['0', '1', '2'])
    queue.dispose()
  })

  it('SDK 加载失败：返回 false、解绑队列、不抛错', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const win = fakeWindow()
    const queue = createPreInitErrorQueue(win)
    const ok = await installSentry(createApp({}), makeRouter(), {
      load: async () => {
        throw new Error('offline')
      },
      queue,
    })
    expect(ok).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    win.dispatchEvent(new ErrorEvent('error', { error: new Error('x') }))
    expect(queue.drain()).toEqual([])
    warn.mockRestore()
  })
})
