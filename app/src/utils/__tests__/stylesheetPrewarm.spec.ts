/**
 * 样式表预热（第 324/325 轮空白标签根因修复）：
 * 栅格化引擎克隆文档会重新请求样式表；生产 link 带 crossorigin 且 CDN 对
 * CSS 响应 Vary: Origin，预热必须用复制了 crossorigin 的 <link rel="preload">
 * 才能与克隆 link 命中同一缓存键（fetch 预热无 Origin 头，永不命中）
 */
import { afterEach, describe, expect, it } from 'vitest'

import { prewarmStylesheets } from '@/utils/pdfExport'

function addStylesheet(href: string, crossorigin?: string): HTMLLinkElement {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  if (crossorigin !== undefined) link.setAttribute('crossorigin', crossorigin)
  document.head.appendChild(link)
  return link
}

function firePreloads(event: 'load' | 'error'): HTMLLinkElement[] {
  const preloads = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="style"]'),
  )
  for (const el of preloads) el.dispatchEvent(new Event(event))
  return preloads
}

afterEach(() => {
  document.head.querySelectorAll('link').forEach((el) => el.remove())
})

describe('prewarmStylesheets', () => {
  it('为每张样式表插入同 href 的 preload，并复制 crossorigin 保证缓存键一致', async () => {
    addStylesheet('https://example.com/assets/index-abc.css', '')
    addStylesheet('https://example.com/assets/en-def.css')

    const task = prewarmStylesheets()
    const preloads = firePreloads('load')

    expect(preloads).toHaveLength(2)
    const byHref = new Map(preloads.map((el) => [el.href, el]))
    expect(byHref.get('https://example.com/assets/index-abc.css')?.getAttribute('crossorigin')).toBe('')
    expect(byHref.get('https://example.com/assets/en-def.css')?.hasAttribute('crossorigin')).toBe(false)

    await task
    // 完成后 preload 节点清理，不残留在 head
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(0)
  })

  it('preload 加载失败也照常落定（尽力而为预热，不拖垮导出）', async () => {
    addStylesheet('https://example.com/assets/broken.css')

    const task = prewarmStylesheets()
    firePreloads('error')

    await expect(task).resolves.toBeUndefined()
  })

  it('页面没有外部样式表时不插入任何 preload', async () => {
    await prewarmStylesheets()
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(0)
  })
})
