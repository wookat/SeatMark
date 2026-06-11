import { describe, expect, it } from 'vitest'

import { loadPhotoFiles } from '@/utils/photos'

function mockImageFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' })
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
