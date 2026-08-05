import { describe, expect, it } from 'vitest'

import { encodeQr, qrToSvg } from '../qrcode'

describe('encodeQr', () => {
  it('短文本生成版本 1–3 的方阵', () => {
    const m = encodeQr('https://www.seatmark.cn/')
    expect(m.length).toBeGreaterThanOrEqual(21)
    expect(m.length % 4).toBe(1) // size = 4v + 17
    for (const row of m) expect(row).toHaveLength(m.length)
  })

  it('三个定位图形角落为深色模块', () => {
    const m = encodeQr('seatmark')
    const size = m.length
    expect(m[0]![0]).toBe(true)
    expect(m[0]![size - 1]).toBe(true)
    expect(m[size - 1]![0]).toBe(true)
  })

  it('长链接自动升级版本，超长报错', () => {
    const long = `https://www.seatmark.cn/studio#tpl=v1.${'A'.repeat(1200)}`
    const m = encodeQr(long)
    expect(m.length).toBeGreaterThan(21)
    expect(() => encodeQr('A'.repeat(5000))).toThrow()
  })
})

describe('qrToSvg', () => {
  it('输出含静区与路径的 SVG', () => {
    const svg = qrToSvg('https://www.seatmark.cn/')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 ')
    expect(svg).toContain('<path d="M')
  })
})
