/**
 * 样式表预热（第 324 轮空白标签根因修复）：
 * 栅格化引擎克隆文档会重新请求样式表，预热应把页面全部外部样式表
 * 以 force-cache 拉进 HTTP 缓存，且单个失败不拖垮整体
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { prewarmStylesheets } from '@/utils/pdfExport'

function addStylesheet(href: string): HTMLLinkElement {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
  return link
}

afterEach(() => {
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove())
  vi.unstubAllGlobals()
})

describe('prewarmStylesheets', () => {
  it('以 force-cache 逐一请求全部外部样式表', async () => {
    addStylesheet('https://example.com/assets/index-abc.css')
    addStylesheet('https://example.com/assets/en-def.css')
    const fetchMock = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
    vi.stubGlobal('fetch', fetchMock)

    await prewarmStylesheets()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/\.css$/)
      expect(init).toEqual({ cache: 'force-cache' })
    }
  })

  it('单个样式表请求失败不抛错（尽力而为预热）', async () => {
    addStylesheet('https://example.com/assets/broken.css')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(prewarmStylesheets()).resolves.toBeUndefined()
  })

  it('页面没有外部样式表时不发请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await prewarmStylesheets()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
