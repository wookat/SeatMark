import { describe, expect, it, vi } from 'vitest'

import {
  adaptiveRasterScale,
  bytesAlias,
  classifyPixelColors,
  containsRtlText,
  defaultImageFormat,
  defaultPdfFileName,
  defaultRasterScale,
  estimatePdfBytes,
  EXPORT_CANCELLED_MESSAGE,
  exportPagedPdf,
  formatBytes,
  isCanvasBlank,
  isPixelDataBlank,
  JPEG_QUALITY,
  jpegQualityFor,
  neutralizeSyntheticBoldRareGlyphs,
  rasterDpi,
  rasterizeRtlText,
  truncateClampedText,
  waitForElementReady,
  withTimeout,
} from '@/utils/pdfExport'

describe('truncateClampedText 导出前物理截断', () => {
  /** 构造字段结构，并用 getter 模拟布局：每行容 10 字、可见高度固定 1 行 */
  function makeBody(text: string, charsPerLine = 10) {
    const body = document.createElement('span')
    body.className = 'label-field__body'
    const content = document.createElement('span')
    content.className = 'label-field__content'
    content.textContent = text
    body.appendChild(content)
    Object.defineProperty(body, 'clientHeight', { get: () => 20 })
    Object.defineProperty(body, 'scrollHeight', {
      get: () =>
        Math.max(1, Math.ceil(Array.from(content.textContent ?? '').length / charsPerLine)) * 20,
    })
    const root = document.createElement('div')
    root.appendChild(body)
    return { root, content }
  }

  it('不溢出的文本不动', () => {
    const { root, content } = makeBody('张同学')
    truncateClampedText(root)
    expect(content.textContent).toBe('张同学')
  })

  it('溢出文本截断为可见前缀 + 省略号，不再多行', () => {
    const long = '欧阳先生'.repeat(6) // 24 字
    const { root, content } = makeBody(long)
    truncateClampedText(root)
    const out = content.textContent!
    expect(out.endsWith('…')).toBe(true)
    // 含省略号共 10 字以内：只占一行
    expect(Array.from(out).length).toBeLessThanOrEqual(10)
    expect(long.startsWith(out.slice(0, -1))).toBe(true)
  })

  it('emoji 不被劈开（按码点截断）', () => {
    const text = '🎉'.repeat(30)
    const { root, content } = makeBody(text)
    truncateClampedText(root)
    const out = content.textContent!
    expect(out.endsWith('…')).toBe(true)
    // 前缀部分全部是完整 emoji
    for (const ch of Array.from(out.slice(0, -1))) expect(ch).toBe('🎉')
  })

  it('极端溢出（500 字单元格）也收敛到单行', () => {
    const { root, content } = makeBody('长'.repeat(500))
    truncateClampedText(root)
    expect(Array.from(content.textContent!).length).toBeLessThanOrEqual(10)
    expect(content.textContent!.endsWith('…')).toBe(true)
  })

  it('截断后解除 overflow / line-clamp 裁切（字形 ascent 不被平切）', () => {
    const { root } = makeBody('欧阳先生'.repeat(6))
    truncateClampedText(root)
    const body = root.querySelector<HTMLElement>('.label-field__body')!
    expect(body.style.overflow).toBe('visible')
    expect(body.style.getPropertyValue('-webkit-line-clamp')).toBe('unset')
  })

  it('不溢出的字段也解除裁切样式（Firefox Range 度量下单行 ascent 也会被平切）', () => {
    const { root, content } = makeBody('张同学')
    truncateClampedText(root)
    const body = root.querySelector<HTMLElement>('.label-field__body')!
    expect(content.textContent).toBe('张同学')
    expect(body.style.overflow).toBe('visible')
    expect(body.style.getPropertyValue('-webkit-line-clamp')).toBe('unset')
  })
})

describe('neutralizeSyntheticBoldRareGlyphs 导出前中和合成加粗', () => {
  function makeBoldContent(text: string) {
    const root = document.createElement('div')
    const content = document.createElement('span')
    content.className = 'label-field__content'
    content.style.fontWeight = '700'
    content.textContent = text
    root.appendChild(content)
    document.body.appendChild(root)
    return { root, content }
  }

  it('粗体字段内扩展字库字符被包常规字重 span，其余文本不变', () => {
    const { root, content } = makeBoldContent('王\u{3106C}明')
    neutralizeSyntheticBoldRareGlyphs(root)
    const span = content.querySelector('span')
    expect(span?.textContent).toBe('\u{3106C}')
    expect(span?.style.fontWeight).toBe('400')
    expect(content.textContent).toBe('王\u{3106C}明')
    root.remove()
  })

  it('连续扩展字库字符合并为一个 span', () => {
    const { root, content } = makeBoldContent('张\u{20000}\u{2A6A5}伟')
    neutralizeSyntheticBoldRareGlyphs(root)
    const spans = content.querySelectorAll('span')
    expect(spans.length).toBe(1)
    expect(spans[0]?.textContent).toBe('\u{20000}\u{2A6A5}')
    root.remove()
  })

  it('非粗体字段/无扩展字库字符时不改动 DOM', () => {
    const { root, content } = makeBoldContent('张伟 Alice')
    neutralizeSyntheticBoldRareGlyphs(root)
    expect(content.querySelector('span')).toBeNull()
    root.remove()

    const normal = makeBoldContent('王\u{3106C}明')
    normal.content.style.fontWeight = '400'
    neutralizeSyntheticBoldRareGlyphs(normal.root)
    expect(normal.content.querySelector('span')).toBeNull()
    normal.root.remove()
  })
})

describe('rasterizeRtlText 导出前 RTL 文本预栅格化', () => {
  function makeContent(text: string) {
    const root = document.createElement('div')
    const content = document.createElement('span')
    content.className = 'label-field__content'
    content.textContent = text
    root.appendChild(content)
    return { root, content }
  }

  it('containsRtlText 识别阿拉伯字母（维文）/希伯来文，不误报 CJK/拉丁/藏文/蒙文/彝文/韩文', () => {
    expect(containsRtlText('ئابدۇللا ئابلىز')).toBe(true)
    expect(containsRtlText('שלום')).toBe(true)
    expect(containsRtlText('张三')).toBe(false)
    expect(containsRtlText('Alice')).toBe(false)
    expect(containsRtlText('བསོད་ནམས')).toBe(false)
    expect(containsRtlText('ᠠᠡᠨ')).toBe(false)
    expect(containsRtlText('ꆈꌠ')).toBe(false)
    expect(containsRtlText('김철수')).toBe(false)
  })

  it('非 RTL 文本不被改动', async () => {
    const { root, content } = makeContent('张三')
    await rasterizeRtlText(root)
    expect(content.textContent).toBe('张三')
    expect(content.querySelector('img')).toBeNull()
  })

  it('环境无 2D 上下文/零尺寸时跳过，不破坏 DOM', async () => {
    const { root, content } = makeContent('ئابدۇللا')
    // jsdom 下 getBoundingClientRect 全 0，函数应跳过而非报错
    await expect(rasterizeRtlText(root)).resolves.toBeUndefined()
    expect(content.textContent).toBe('ئابدۇللا')
  })

  it('含 RTL 文本且环境支持时替换为同尺寸图片', async () => {
    const { root, content } = makeContent('ئابدۇللا')
    Object.defineProperty(content, 'getBoundingClientRect', {
      value: () => ({ width: 120, height: 40 }),
    })
    const fillText = vi.fn()
    const ctx = {
      scale: vi.fn(),
      measureText: () => ({ width: 100 }),
      fillText,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      direction: 'ltr',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      font: '',
      fillStyle: '',
    }
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = origCreate('canvas') as HTMLCanvasElement
        canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
        canvas.toDataURL = () => 'data:image/png;base64,AAAA'
        return canvas
      }
      return origCreate(tag)
    })
    try {
      await rasterizeRtlText(root)
    } finally {
      vi.restoreAllMocks()
    }
    const img = content.querySelector('img')!
    expect(img).not.toBeNull()
    expect(img.style.width).toBe('120px')
    expect(img.style.height).toBe('40px')
    expect(fillText).toHaveBeenCalledOnce()
  })
})

describe('pdfExport 参数选取', () => {
  it('渲染倍率随页数递减：≤2 页 300dpi，页多降到 150–200dpi', () => {
    expect(rasterDpi(defaultRasterScale(1))).toBe(300)
    expect(rasterDpi(defaultRasterScale(2))).toBe(300)
    expect(rasterDpi(defaultRasterScale(6))).toBe(240)
    expect(rasterDpi(defaultRasterScale(12))).toBeLessThanOrEqual(240)
    for (const n of [13, 30, 31, 60, 200]) {
      const dpi = rasterDpi(defaultRasterScale(n))
      expect(dpi).toBeGreaterThanOrEqual(150)
      expect(dpi).toBeLessThanOrEqual(200)
    }
  })

  it('倍率单调不增', () => {
    let prev = Infinity
    for (const n of [1, 2, 3, 6, 7, 12, 13, 30, 31, 100]) {
      const s = defaultRasterScale(n)
      expect(s).toBeLessThanOrEqual(prev)
      prev = s
    }
  })

  it('标签尺寸自适应倍率：大尺寸桌牌限档避免过采样，小标签不降档', () => {
    // 无标签信息：等同按页数选档
    expect(adaptiveRasterScale(1)).toBe(defaultRasterScale(1))
    // 小标签（90×54mm）：不降档
    expect(adaptiveRasterScale(1, { width: 90, height: 54 })).toBe(defaultRasterScale(1))
    // 大桌牌（200×140mm，短边 ≥120）：限 240dpi
    expect(rasterDpi(adaptiveRasterScale(1, { width: 200, height: 140 }))).toBe(240)
    // 中尺寸（短边 ≥80）：限 ≈269dpi
    expect(adaptiveRasterScale(1, { width: 180, height: 90 })).toBe(2.8)
    // 页数多时基础档已低于上限：不受影响
    expect(adaptiveRasterScale(60, { width: 200, height: 140 })).toBe(defaultRasterScale(60))
  })

  it('bytesAlias：相同字节同 alias，不同字节不同 alias', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5])
    const b = new Uint8Array([1, 2, 3, 4, 5])
    const c = new Uint8Array([1, 2, 3, 4, 6])
    expect(bytesAlias(a)).toBe(bytesAlias(b))
    expect(bytesAlias(a)).not.toBe(bytesAlias(c))
    expect(bytesAlias(a)).toMatch(/^img-/)
    // 长度不同也不同 alias
    expect(bytesAlias(new Uint8Array([0, 0]))).not.toBe(bytesAlias(new Uint8Array([0, 0, 0])))
  })

  it('栅格格式默认自适应：逐页按内容选 PNG 无损或 JPEG', () => {
    expect(defaultImageFormat(1)).toBe('auto')
    expect(defaultImageFormat(60)).toBe('auto')
  })

  it('JPEG 质量随页数自适应且不低于 0.87', () => {
    expect(jpegQualityFor(1)).toBe(JPEG_QUALITY)
    expect(jpegQualityFor(12)).toBe(JPEG_QUALITY)
    expect(jpegQualityFor(30)).toBeLessThan(JPEG_QUALITY)
    expect(jpegQualityFor(60)).toBeGreaterThanOrEqual(0.87)
  })

  it('classifyPixelColors：大面积纯色判 flat，颜色分散（渐变/照片）判 rich', () => {
    // 纯色页：白底 + 少量黑字像素
    const flat: number[] = []
    for (let i = 0; i < 1000; i++) flat.push(255, 255, 255, 255)
    for (let i = 0; i < 80; i++) flat.push(0, 0, 0, 255)
    expect(classifyPixelColors(flat)).toBe('flat')

    // 渐变页：每个像素颜色都不同
    const rich: number[] = []
    for (let i = 0; i < 1000; i++) rich.push(i % 256, (i * 7) % 256, (i * 13) % 256, 255)
    expect(classifyPixelColors(rich)).toBe('rich')

    expect(classifyPixelColors([])).toBe('flat')
  })

  it('体积预估：60 页 A4 默认参数应低于 50MB', () => {
    const bytes = estimatePdfBytes({
      pageCount: 60,
      scale: defaultRasterScale(60),
      pageWidth: 210,
      pageHeight: 297,
    })
    expect(bytes).toBeGreaterThan(1024 * 1024)
    expect(bytes).toBeLessThan(50 * 1024 * 1024)
  })

  it('体积预估随页数线性增长', () => {
    const one = estimatePdfBytes({ pageCount: 1, scale: 2, pageWidth: 210, pageHeight: 297 })
    const ten = estimatePdfBytes({ pageCount: 10, scale: 2, pageWidth: 210, pageHeight: 297 })
    expect(ten).toBeCloseTo(one * 10, -1)
  })

  it('formatBytes 输出人类可读体积', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(200 * 1024)).toBe('200 KB')
    expect(formatBytes(12.3 * 1024 * 1024)).toBe('12.3 MB')
  })

  it('rasterDpi 按 96dpi × 倍率换算', () => {
    expect(rasterDpi(2)).toBe(192)
    expect(rasterDpi(2.5)).toBe(240)
    expect(rasterDpi(3.125)).toBe(300)
  })

  it('文件名含日期戳与前缀', () => {
    expect(defaultPdfFileName()).toMatch(/^考场座位标签-\d{8}-\d{4}\.pdf$/)
    expect(defaultPdfFileName('桌牌')).toMatch(/^桌牌-/)
  })

  it('页数为 0 时报「没有可导出的页面」', async () => {
    await expect(
      exportPagedPdf({ pageCount: 0, getPage: () => document.createElement('div') }),
    ).rejects.toThrow('没有可导出的页面')
  })
})

describe('导出稳定性防线', () => {
  it('withTimeout：超时以指定文案 reject', async () => {
    const never = new Promise<void>(() => {})
    await expect(withTimeout(never, 10, '渲染超时')).rejects.toThrow('渲染超时')
  })

  it('withTimeout：按时完成则透传结果', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'x')).resolves.toBe(42)
  })

  it('withTimeout：按时失败则透传原错误', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'x')).rejects.toThrow('boom')
  })

  it('isPixelDataBlank：全白/全透明视为空白', () => {
    expect(isPixelDataBlank([255, 255, 255, 255, 255, 255, 255, 255])).toBe(true)
    expect(isPixelDataBlank([0, 0, 0, 0])).toBe(true)
    expect(isPixelDataBlank([])).toBe(true)
  })

  it('isPixelDataBlank：存在可见非白像素即非空', () => {
    expect(isPixelDataBlank([255, 255, 255, 255, 30, 30, 30, 255])).toBe(false)
    expect(isPixelDataBlank([200, 200, 200, 255])).toBe(false)
  })

  it('isPixelDataBlank：接近白色的浅灰在阈值内仍算空白', () => {
    expect(isPixelDataBlank([252, 253, 251, 255])).toBe(true)
  })

  it('isCanvasBlank：零尺寸画布视为空白', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 0
    canvas.height = 0
    expect(isCanvasBlank(canvas)).toBe(true)
  })

  it('waitForElementReady：无图片节点也能正常完成', async () => {
    const el = document.createElement('div')
    await expect(waitForElementReady(el)).resolves.toBeUndefined()
  })

  it('取消信号已中止时立即以「已取消导出」失败，不调用 getPage', async () => {
    const getPage = vi.fn(() => document.createElement('div'))
    const abort = new AbortController()
    abort.abort()
    await expect(
      exportPagedPdf({ pageCount: 3, getPage, signal: abort.signal }),
    ).rejects.toThrow(EXPORT_CANCELLED_MESSAGE)
    expect(getPage).not.toHaveBeenCalled()
  })
})

describe('空白页自动重渲', () => {
  it('渲染结果持续空白：重试一次后报「第 N 页渲染失败」，绝不静默输出空白页', async () => {
    vi.doMock('html2canvas-pro', () => ({
      // 返回零尺寸画布 → isCanvasBlank 判空白
      default: vi.fn(async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 0
        canvas.height = 0
        return canvas
      }),
    }))
    vi.resetModules()
    const { exportPagedPdf: exportWithMock } = await import('@/utils/pdfExport')
    const html2canvas = (await import('html2canvas-pro')).default

    const getPage = vi.fn(() => document.createElement('div'))
    await expect(
      exportWithMock({ pageCount: 2, getPage }),
    ).rejects.toThrow('第 1/2 页渲染失败：页面渲染为空白')
    // 首次空白后自动重渲一次（共 2 次），仍空白才失败
    expect(html2canvas).toHaveBeenCalledTimes(2)
    expect(getPage).toHaveBeenCalledTimes(2)

    vi.doUnmock('html2canvas-pro')
    vi.resetModules()
  })
})
