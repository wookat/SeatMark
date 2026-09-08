import { describe, expect, it, vi } from 'vitest'

import {
  PHOTO_MAX_EDGE,
  type PhotoResizer,
  detectPhotoKind,
  fitWithinMaxEdge,
  loadPhotoDataUrl,
  loadPhotoFiles,
  pickOutputFormat,
  resizePhoto,
  shouldDownsample,
} from '@/utils/photos'

function mockImageFile(name: string): File {
  // 真实 JPEG 魔数头，通过图片内容校验
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], name, {
    type: 'image/jpeg',
  })
}

function mockFakeImageFile(name: string): File {
  return new File(['this is plain text, not an image'], name, { type: 'image/jpeg' })
}

describe('loadPhotoFiles', () => {
  it('文件名与列值完全一致时命中', async () => {
    const result = await loadPhotoFiles(
      [mockImageFile('2026061001.jpg')],
      new Set(['2026061001']),
    )
    expect(result.matched).toBe(1)
    expect(result.unmatched).toBe(0)
    expect(result.photos.has('2026061001')).toBe(true)
  })

  it('组合命名 + 姓名列：文件名包含姓名即可命中', async () => {
    const result = await loadPhotoFiles(
      [mockImageFile('张伟2023010101.jpg')],
      new Set(['张伟', '王芳']),
    )
    expect(result.matched).toBe(1)
    expect(result.photos.has('张伟')).toBe(true)
  })

  it('组合命名 + 学号列：文件名包含学号即可命中', async () => {
    const result = await loadPhotoFiles(
      [mockImageFile('张伟2023010101.png')],
      new Set(['2023010101', '2023010102']),
    )
    expect(result.matched).toBe(1)
    expect(result.photos.has('2023010101')).toBe(true)
  })

  it('完全一致优先于包含匹配，且不会被后续包含匹配覆盖', async () => {
    const result = await loadPhotoFiles(
      [mockImageFile('张伟.jpg'), mockImageFile('张伟2023010101.jpg')],
      new Set(['张伟']),
    )
    expect(result.matched).toBe(2)
    expect(result.photos.get('张伟')).toMatch(/^data:/)
    expect(result.photos.size).toBe(1)
  })

  it('改名的非图片文件被拒绝并记录错误，不进入照片集', async () => {
    const result = await loadPhotoFiles([mockFakeImageFile('张伟.jpg')], new Set(['张伟']))
    expect(result.matched).toBe(0)
    expect(result.unmatched).toBe(1)
    expect(result.errors[0]).toContain('不是有效的图片文件')
    expect(result.photos.size).toBe(0)
  })

  it('PNG/SVG 魔数头均可通过校验', async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], '王芳.png', {
      type: 'image/png',
    })
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], '李娜.svg', {
      type: 'image/svg+xml',
    })
    const result = await loadPhotoFiles([png, svg], new Set(['王芳', '李娜']))
    expect(result.matched).toBe(2)
    expect(result.errors).toEqual([])
  })

  it('无匹配时记录错误', async () => {
    const result = await loadPhotoFiles(
      [mockImageFile('unknown.jpg')],
      new Set(['张三']),
    )
    expect(result.matched).toBe(0)
    expect(result.unmatched).toBe(1)
    expect(result.errors[0]).toContain('unknown.jpg')
  })
})

describe('照片导入降采样（r361）', () => {
  const pngFile = (name: string) =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], name, { type: 'image/png' })
  const gifFile = (name: string) =>
    new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], name, { type: 'image/gif' })
  const svgFile = (name: string) =>
    new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], name, { type: 'image/svg+xml' })

  it('fitWithinMaxEdge：长边 > 1000 等比缩到 1000，不超过返回 null', () => {
    expect(fitWithinMaxEdge(4000, 3000)).toEqual({ width: 1000, height: 750 })
    expect(fitWithinMaxEdge(3000, 4000)).toEqual({ width: 750, height: 1000 })
    expect(fitWithinMaxEdge(1000, 800)).toBeNull()
    expect(fitWithinMaxEdge(413, 626)).toBeNull()
    expect(fitWithinMaxEdge(0, 5000)).toBeNull()
    expect(PHOTO_MAX_EDGE).toBe(1000)
  })

  it('pickOutputFormat：PNG 保持 PNG，其余输出 JPEG quality 0.9；SVG/GIF 不降采样', () => {
    expect(pickOutputFormat('png')).toEqual({ mime: 'image/png' })
    expect(pickOutputFormat('jpeg')).toEqual({ mime: 'image/jpeg', quality: 0.9 })
    expect(pickOutputFormat('webp')).toEqual({ mime: 'image/jpeg', quality: 0.9 })
    expect(pickOutputFormat('heif')).toEqual({ mime: 'image/jpeg', quality: 0.9 })
    expect(shouldDownsample('jpeg')).toBe(true)
    expect(shouldDownsample('png')).toBe(true)
    expect(shouldDownsample('svg')).toBe(false)
    expect(shouldDownsample('gif')).toBe(false)
  })

  it('detectPhotoKind 按魔数识别格式', async () => {
    expect(await detectPhotoKind(mockImageFile('a.jpg'))).toBe('jpeg')
    expect(await detectPhotoKind(pngFile('a.png'))).toBe('png')
    expect(await detectPhotoKind(gifFile('a.gif'))).toBe('gif')
    expect(await detectPhotoKind(svgFile('a.svg'))).toBe('svg')
    expect(await detectPhotoKind(mockFakeImageFile('a.jpg'))).toBeNull()
  })

  it('loadPhotoDataUrl：位图走注入的 resize，SVG/GIF 直接读原文件不调用 resize', async () => {
    const calls: Array<[string, string]> = []
    const resize: PhotoResizer = async (file, kind) => {
      calls.push([file.name, kind])
      return `data:image/jpeg;base64,RESIZED-${file.name}`
    }
    expect(await loadPhotoDataUrl(mockImageFile('张伟.jpg'), 'jpeg', resize)).toBe(
      'data:image/jpeg;base64,RESIZED-张伟.jpg',
    )
    expect(await loadPhotoDataUrl(pngFile('王芳.png'), 'png', resize)).toBe(
      'data:image/jpeg;base64,RESIZED-王芳.png',
    )
    expect(await loadPhotoDataUrl(svgFile('李娜.svg'), 'svg', resize)).toMatch(/^data:image\/svg\+xml/)
    expect(await loadPhotoDataUrl(gifFile('赵云.gif'), 'gif', resize)).toMatch(/^data:image\/gif/)
    expect(calls).toEqual([
      ['张伟.jpg', 'jpeg'],
      ['王芳.png', 'png'],
    ])
  })

  it('loadPhotoDataUrl：resize 抛错或返回 null 时回退原 dataURL，不丢照片', async () => {
    const throwing: PhotoResizer = async () => {
      throw new Error('decode failed')
    }
    const noop: PhotoResizer = async () => null
    const original = await loadPhotoDataUrl(mockImageFile('a.jpg'), 'jpeg', noop)
    expect(original).toMatch(/^data:image\/jpeg;base64,/)
    expect(await loadPhotoDataUrl(mockImageFile('a.jpg'), 'jpeg', throwing)).toBe(original)
  })

  it('loadPhotoFiles 串行逐张调用 resize（不并发），并把结果写入 photos', async () => {
    let inflight = 0
    let maxInflight = 0
    const order: string[] = []
    const resize: PhotoResizer = async (file) => {
      inflight++
      maxInflight = Math.max(maxInflight, inflight)
      await new Promise((r) => setTimeout(r, 2))
      order.push(file.name)
      inflight--
      return `data:image/jpeg;base64,${file.name}`
    }
    const files = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'].map(mockImageFile)
    const result = await loadPhotoFiles(files, new Set(['1', '2', '3', '4', '5']), { resize })
    expect(result.matched).toBe(5)
    expect(maxInflight).toBe(1)
    expect(order).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'])
    expect(result.photos.get('3')).toBe('data:image/jpeg;base64,3.jpg')
  })

  it('默认 resizePhoto：createImageBitmap 解码 4000×3000 → canvas 1000×750，JPEG quality 0.9，并释放 bitmap', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close })))
    const drawImage = vi.fn()
    const toDataURL = vi.fn((mime: string) => `data:${mime};base64,AAAA`)
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL }
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation(() => canvas as unknown as HTMLCanvasElement)
    try {
      const out = await resizePhoto(mockImageFile('big.jpg'), 'jpeg')
      expect(out).toBe('data:image/jpeg;base64,AAAA')
      expect(canvas.width).toBe(1000)
      expect(canvas.height).toBe(750)
      expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 4000 }), 0, 0, 1000, 750)
      expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9)
      expect(close).toHaveBeenCalledTimes(1)

      toDataURL.mockClear()
      expect(await resizePhoto(pngFile('big.png'), 'png')).toBe('data:image/png;base64,AAAA')
      expect(toDataURL).toHaveBeenCalledWith('image/png', undefined)
    } finally {
      createElement.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('默认 resizePhoto：图片长边 ≤ 1000 返回 null（保留原文件）', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 413, height: 626, close })))
    const toDataURL = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL }
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation(() => canvas as unknown as HTMLCanvasElement)
    try {
      expect(await resizePhoto(mockImageFile('small.jpg'), 'jpeg')).toBeNull()
      expect(toDataURL).not.toHaveBeenCalled()
      expect(close).toHaveBeenCalledTimes(1)
    } finally {
      createElement.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('默认 resizePhoto：createImageBitmap 不可用时回退 Image + objectURL', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: () => 'blob:mock', revokeObjectURL: revoke }))
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 2000
      naturalHeight = 5000
      set src(_v: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)
    const drawImage = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: (m: string) => `data:${m};base64,BB` }
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation(() => canvas as unknown as HTMLCanvasElement)
    try {
      expect(await resizePhoto(mockImageFile('tall.jpg'), 'jpeg')).toBe('data:image/jpeg;base64,BB')
      expect(canvas.width).toBe(400)
      expect(canvas.height).toBe(1000)
      expect(revoke).toHaveBeenCalledWith('blob:mock')
    } finally {
      createElement.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})
