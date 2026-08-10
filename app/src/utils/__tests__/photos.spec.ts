import { describe, expect, it } from 'vitest'

import { loadPhotoFiles } from '@/utils/photos'

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
