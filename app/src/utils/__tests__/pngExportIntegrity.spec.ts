/**
 * 第 349 轮防线：/seating PNG 导出静默坏图（横版座位表导出成 2481×3509 竖版纯文本堆叠）
 * - 输出画布长宽比与 pageWidth/pageHeight 不符 → throw → 重试 → rebuildHost → 仍失败才报错
 * - 整页右侧/下部无墨迹（无网格/边框）→ 同一链路
 * - 校验失败绝不落到「PNG 已导出」：exportPagedPng reject
 * - onclone 把宿主 CSSOM 内联进克隆文档、修正克隆节点尺寸
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPageRenderer,
  inlineLinkedStylesIntoClone,
  pinCloneSizeToSource,
} from '@/utils/pdfExport'
import {
  canvasAspectMismatch,
  createCanvasIntegrityCheck,
  exportPagedPng,
  isProbeMissingEdgeInk,
} from '@/utils/pngExport'

const html2canvasMock = vi.hoisted(() => vi.fn())

vi.mock('html2canvas-pro', () => ({ default: html2canvasMock }))

type InkedCanvas = HTMLCanvasElement & { __ink?: 'full' | 'topLeft' }

function canvasOf(width: number, height: number, ink: 'full' | 'topLeft' = 'full'): HTMLCanvasElement {
  const c = document.createElement('canvas') as InkedCanvas
  c.width = width
  c.height = height
  c.__ink = ink
  c.toBlob = (cb: BlobCallback) => cb(new Blob([new Uint8Array([1, 2, 3])]))
  return c
}

const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  html2canvasMock.mockReset()
  URL.createObjectURL = () => 'blob:seatmark-test'
  URL.revokeObjectURL = () => {}
  // jsdom 无 2D 上下文：用 __ink 标记模拟像素——full 满版有墨迹；topLeft 只有左上角有字（丢样式的纯文本堆叠）
  HTMLCanvasElement.prototype.getContext = function (this: InkedCanvas) {
    const target = this
    return {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'high',
      fillStyle: '',
      fillRect: () => {},
      drawImage: (source: InkedCanvas) => {
        target.__ink = source.__ink
      },
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4).fill(255)
        if (target.__ink === 'full') {
          for (let i = 0; i < w * h; i++) data[i * 4] = 0
        } else if (target.__ink === 'topLeft') {
          data[0] = 0
        }
        return { data, width: w, height: h }
      },
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

describe('canvasAspectMismatch：输出长宽比与页面尺寸比对', () => {
  it('A4 横版页输出 3509×2481 通过；竖版 2481×3509 判为不符', () => {
    expect(canvasAspectMismatch({ width: 3509, height: 2481 }, 297, 210)).toBe(false)
    expect(canvasAspectMismatch({ width: 2481, height: 3509 }, 297, 210)).toBe(true)
  })

  it('取整误差在 3% 容差内放行；尺寸为 0 交给空白判据不重复报', () => {
    expect(canvasAspectMismatch({ width: 1123, height: 795 }, 297, 210)).toBe(false)
    expect(canvasAspectMismatch({ width: 0, height: 0 }, 297, 210)).toBe(false)
  })
})

describe('isProbeMissingEdgeInk：整页右上/下部内容分布', () => {
  function probe(w: number, h: number, paint: (x: number, y: number) => boolean) {
    const data = new Uint8ClampedArray(w * h * 4).fill(255)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) if (paint(x, y)) data[(y * w + x) * 4] = 0
    }
    return data
  }

  it('满版网格（右下均有墨迹）通过', () => {
    expect(isProbeMissingEdgeInk(probe(30, 30, (x, y) => x % 5 === 0 || y % 5 === 0), 30, 30)).toBe(false)
  })

  it('只有页首左上一坨文字（无边框无网格）判为缺失', () => {
    expect(isProbeMissingEdgeInk(probe(30, 30, (x, y) => x < 8 && y < 6), 30, 30)).toBe(true)
  })

  it('右侧有内容但下部全白同样判为缺失', () => {
    expect(isProbeMissingEdgeInk(probe(30, 30, (_x, y) => y < 5), 30, 30)).toBe(true)
  })

  it('丢样式的真实形态：左侧一列文字 + 右下角底边水印（右上区纯白）判为缺失', () => {
    const data = probe(30, 30, (x, y) => x < 6 || (y >= 28 && x >= 20))
    expect(isProbeMissingEdgeInk(data, 30, 30)).toBe(true)
  })
})

describe('createCanvasIntegrityCheck：命中即 throw', () => {
  it('长宽比不符抛出带实际/预期尺寸的错误', () => {
    const check = createCanvasIntegrityCheck({ pageWidth: 297, pageHeight: 210 })
    expect(() => check(canvasOf(2481, 3509))).toThrow('页面尺寸渲染错误（输出 2481×3509')
    expect(() => check(canvasOf(3509, 2481))).not.toThrow()
  })

  it('fullPageInk 打开时右下无墨迹抛「缺少座位网格与边框」；关闭时不查', () => {
    const strict = createCanvasIntegrityCheck({ pageWidth: 297, pageHeight: 210, fullPageInk: true })
    expect(() => strict(canvasOf(3509, 2481, 'topLeft'))).toThrow('缺少座位网格与边框')
    expect(() => strict(canvasOf(3509, 2481, 'full'))).not.toThrow()
    const loose = createCanvasIntegrityCheck({ pageWidth: 297, pageHeight: 210 })
    expect(() => loose(canvasOf(3509, 2481, 'topLeft'))).not.toThrow()
  })
})

describe('exportPagedPng：完整性校验失败走 重试 → rebuildHost → 报错，不静默交付', () => {
  const page = () => {
    const el = document.createElement('div')
    el.className = 'sheet-page'
    return el
  }

  it('首两次竖版、重建宿主后横版：导出成功且 rebuildHost 恰好一次', async () => {
    html2canvasMock
      .mockResolvedValueOnce(canvasOf(2481, 3509))
      .mockResolvedValueOnce(canvasOf(2481, 3509))
      .mockResolvedValueOnce(canvasOf(3509, 2481))
    const rebuildHost = vi.fn()
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage: page,
        pageWidth: 297,
        pageHeight: 210,
        rebuildHost,
        fullPageInk: true,
      }),
    ).resolves.toBeUndefined()
    expect(rebuildHost).toHaveBeenCalledTimes(1)
    expect(html2canvasMock).toHaveBeenCalledTimes(3)
  })

  it('重建后仍竖版：以页码报「页面尺寸渲染错误」reject（共 3 次渲染）', async () => {
    html2canvasMock.mockImplementation(() => Promise.resolve(canvasOf(2481, 3509)))
    const rebuildHost = vi.fn()
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage: page,
        pageWidth: 297,
        pageHeight: 210,
        rebuildHost,
        fullPageInk: true,
      }),
    ).rejects.toThrow('第 1/1 页渲染失败：页面尺寸渲染错误（输出 2481×3509，预期 297×210mm 比例）')
    expect(rebuildHost).toHaveBeenCalledTimes(1)
    expect(html2canvasMock).toHaveBeenCalledTimes(3)
  })

  it('长宽比正确但整页无网格（只有页首文字）：同样 reject', async () => {
    html2canvasMock.mockImplementation(() => Promise.resolve(canvasOf(3509, 2481, 'topLeft')))
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage: page,
        pageWidth: 297,
        pageHeight: 210,
        fullPageInk: true,
      }),
    ).rejects.toThrow('第 1/1 页渲染失败：页面渲染不完整（缺少座位网格与边框）')
    expect(html2canvasMock).toHaveBeenCalledTimes(2)
  })

  it('逐标签导出同样校验页面长宽比', async () => {
    html2canvasMock.mockImplementation(() => Promise.resolve(canvasOf(2481, 3509)))
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage: page,
        pageWidth: 297,
        pageHeight: 210,
        labelsByPage: [[{ rect: { x: 5, y: 5, width: 90, height: 54 } }]],
      }),
    ).rejects.toThrow('页面尺寸渲染错误')
  })
})

describe('createPageRenderer onclone：克隆文档样式与尺寸修正', () => {
  it('每次 html2canvas 调用都传入 onclone 回调', async () => {
    html2canvasMock.mockResolvedValue(canvasOf(3509, 2481))
    const render = createPageRenderer(
      { pageCount: 1, getPage: () => document.createElement('div'), scale: 1 },
      html2canvasMock,
    )
    await render(0)
    const opts = html2canvasMock.mock.calls[0]?.[1] as { onclone?: unknown }
    expect(typeof opts.onclone).toBe('function')
  })

  it('inlineLinkedStylesIntoClone：宿主 <link> 样式表规则以 <style> 原位替换克隆文档中的同名 <link>', () => {
    const source = document.implementation.createHTMLDocument('src')
    const link = source.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/assets/SeatingView-abc.css'
    source.head.appendChild(link)
    // jsdom 不会为 <link> 建 CSSStyleSheet：以最小假样式表模拟已生效的外链样式表
    const sheet = {
      ownerNode: link,
      cssRules: [{ cssText: '.seating-sheet { width: 297mm; height: 210mm; }' }],
    } as unknown as CSSStyleSheet
    Object.defineProperty(source, 'styleSheets', { value: [sheet] })

    const clone = document.implementation.createHTMLDocument('clone')
    const otherLink = clone.createElement('link')
    otherLink.rel = 'stylesheet'
    otherLink.href = 'https://cdn.example.com/other.css'
    clone.head.appendChild(otherLink)
    const cloneLink = clone.createElement('link')
    cloneLink.rel = 'stylesheet'
    cloneLink.href = '/assets/SeatingView-abc.css'
    clone.head.appendChild(cloneLink)

    expect(inlineLinkedStylesIntoClone(clone, source)).toBe(1)
    expect(clone.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1)
    const inlined = clone.querySelector('style[data-inlined-from="/assets/SeatingView-abc.css"]')
    expect(inlined?.textContent).toContain('width: 297mm')
    // 原位替换：保持级联顺序（在其它 link 之后）
    expect(clone.head.lastElementChild).toBe(inlined)
  })

  it('pinCloneSizeToSource：克隆节点尺寸偏离宿主时写入宿主像素宽高，一致时不动', () => {
    const src = document.createElement('div')
    src.getBoundingClientRect = () => ({ width: 1123, height: 794 }) as DOMRect
    const clone = document.createElement('div')
    clone.getBoundingClientRect = () => ({ width: 794, height: 1123 }) as DOMRect
    expect(pinCloneSizeToSource(clone, src)).toBe(true)
    expect(clone.style.width).toBe('1123px')
    expect(clone.style.height).toBe('794px')

    const same = document.createElement('div')
    same.getBoundingClientRect = () => ({ width: 1123, height: 794 }) as DOMRect
    expect(pinCloneSizeToSource(same, src)).toBe(false)
    expect(same.style.width).toBe('')
  })
})
