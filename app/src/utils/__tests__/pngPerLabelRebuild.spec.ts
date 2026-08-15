/**
 * 第 323 轮防线：逐标签导出偶发空白标签（整页非空但局部未绘出的渲染竞态）
 * - 无 rebuildHost：整页重渲一次仍空白即报错（原有行为）
 * - 有 rebuildHost：重渲仍空白时重建离屏容器做最后一次重渲，仍空白才报错
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exportPagedPng } from '@/utils/pngExport'

const html2canvasMock = vi.hoisted(() => vi.fn())

vi.mock('html2canvas-pro', () => ({ default: html2canvasMock }))

type InkedCanvas = HTMLCanvasElement & { __pageInk?: boolean; __labelInk?: boolean }

/** 整页有墨迹但标签裁剪区空白的页面画布（渲染竞态的典型产物） */
function pageCanvasWithBlankLabel(): HTMLCanvasElement {
  const c = document.createElement('canvas') as InkedCanvas
  c.width = 200
  c.height = 100
  c.__pageInk = true
  c.__labelInk = false
  return c
}

const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  html2canvasMock.mockReset()
  // jsdom 无 2D 上下文：用假 ctx 以 __pageInk/__labelInk 标记模拟像素判定。
  // isCanvasBlank 探针走 5 参 drawImage（继承整页墨迹），
  // 逐标签裁剪走 9 参 drawImage（继承标签区墨迹）。
  HTMLCanvasElement.prototype.getContext = function (this: InkedCanvas) {
    const target = this
    return {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'high',
      fillStyle: '',
      fillRect: () => {},
      drawImage: (source: InkedCanvas, ...rest: number[]) => {
        target.__pageInk = rest.length >= 8 ? source.__labelInk : source.__pageInk
      },
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4).fill(255)
        if (target.__pageInk) data[0] = 0
        return { data, width: w, height: h }
      },
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

const labelsByPage = [[{ rect: { x: 5, y: 5, width: 90, height: 54 }, fileName: '张三.png' }]]

describe('逐标签空白重试与容器重建兜底', () => {
  it('无 rebuildHost：重渲一次仍空白即以页码/标签序号报错（共 2 次渲染）', async () => {
    html2canvasMock.mockImplementation(() => Promise.resolve(pageCanvasWithBlankLabel()))
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage: () => document.createElement('div'),
        pageWidth: 210,
        pageHeight: 297,
        labelsByPage,
      }),
    ).rejects.toThrow('第 1/1 页第 1 枚标签渲染为空白')
    expect(html2canvasMock).toHaveBeenCalledTimes(2)
  })

  it('有 rebuildHost：重渲仍空白时重建容器再渲最后一次，仍空白才报错（共 3 次渲染，rebuildHost 恰好一次）', async () => {
    html2canvasMock.mockImplementation(() => Promise.resolve(pageCanvasWithBlankLabel()))
    const rebuildHost = vi.fn()
    await expect(
      exportPagedPng({
        pageCount: 1,
        getPage: () => document.createElement('div'),
        pageWidth: 210,
        pageHeight: 297,
        labelsByPage,
        rebuildHost,
      }),
    ).rejects.toThrow('第 1/1 页第 1 枚标签渲染为空白')
    expect(rebuildHost).toHaveBeenCalledTimes(1)
    expect(html2canvasMock).toHaveBeenCalledTimes(3)
  })
})
