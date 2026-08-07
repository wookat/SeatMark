import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deliverPdfForMobilePrint,
  isMobilePrintEnvironment,
  printAndWaitUntilDone,
} from '@/utils/printing'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isMobilePrintEnvironment', () => {
  it('Android / iPhone UA 判为移动端', () => {
    for (const ua of [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    ]) {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
      expect(isMobilePrintEnvironment()).toBe(true)
    }
  })

  it('桌面 Chrome UA 判为桌面端', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0 Safari/537.36',
    )
    expect(isMobilePrintEnvironment()).toBe(false)
  })
})

describe('printAndWaitUntilDone', () => {
  it('window.print 立即返回时等待 afterprint 事件后才继续', async () => {
    const order: string[] = []
    vi.spyOn(window, 'print').mockImplementation(() => {
      order.push('print')
      // 模拟移动/异步预览：print 返回后预览才渲染，随后派发 afterprint
      setTimeout(() => window.dispatchEvent(new Event('afterprint')), 20)
    })
    await printAndWaitUntilDone(10_000)
    order.push('done')
    expect(order).toEqual(['print', 'done'])
  })

  it('afterprint 未派发时按兜底超时返回，不永久挂起', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    await expect(printAndWaitUntilDone(30)).resolves.toBeUndefined()
  })
})

describe('deliverPdfForMobilePrint', () => {
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })

  it('支持 Web Share 时走系统分享面板', async () => {
    const share = vi.fn(async () => {})
    Object.assign(navigator, { canShare: () => true, share })
    await expect(deliverPdfForMobilePrint(blob, 'x.pdf')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledOnce()
  })

  it('用户取消分享返回 cancelled（不视为失败）', async () => {
    const abort = new Error('cancel')
    abort.name = 'AbortError'
    Object.assign(navigator, {
      canShare: () => true,
      share: vi.fn(async () => {
        throw abort
      }),
    })
    await expect(deliverPdfForMobilePrint(blob, 'x.pdf')).resolves.toBe('cancelled')
  })

  it('不支持分享时退回新标签页打开', async () => {
    Object.assign(navigator, { canShare: undefined, share: undefined })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(window, 'open').mockReturnValue({} as Window)
    await expect(deliverPdfForMobilePrint(blob, 'x.pdf')).resolves.toBe('opened')
  })

  it('弹窗被拦截时改为直接下载', async () => {
    Object.assign(navigator, { canShare: undefined, share: undefined })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(window, 'open').mockReturnValue(null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await expect(deliverPdfForMobilePrint(blob, 'x.pdf')).resolves.toBe('downloaded')
    expect(click).toHaveBeenCalledOnce()
  })
})
