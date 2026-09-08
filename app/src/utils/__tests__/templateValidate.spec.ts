import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import type { LabelTemplate } from '@/types/template'
import {
  isSafeCssColor,
  isSafeImageSrc,
  isValidTemplate,
  sanitizeTemplateForImport,
} from '@/utils/templateValidate'
import { cloneTemplate } from '@/utils/layout'

const standard = defaultTemplates[0]!

function tampered(patch: (t: LabelTemplate) => void): LabelTemplate {
  const copy = cloneTemplate(standard)
  patch(copy)
  return copy
}

describe('isSafeCssColor', () => {
  it('放行 #hex / rgb() / hsl() / 颜色名 / 无外链渐变', () => {
    for (const v of [
      '#fff',
      '#ffffff',
      '#0f172a80',
      'rgb(15, 23, 42)',
      'rgba(15,23,42,.5)',
      'hsl(210 40% 20%)',
      'hsla(210, 40%, 20%, 0.8)',
      'transparent',
      'white',
      'linear-gradient(135deg, #0369a1 0%, #0e7490 100%)',
      'radial-gradient(circle at 30% 30%, rgba(255,255,255,.6), #fff1f2)',
    ]) {
      expect(isSafeCssColor(v), v).toBe(true)
    }
  })

  it('剥离 url( / expression / javascript: / 转义混淆', () => {
    for (const v of [
      'url(https://evil.example/pixel.png)',
      '#fff url("https://evil.example/p.png")',
      'linear-gradient(#fff, #000), url(https://evil.example/p.png)',
      'linear-gradient(url(https://evil.example/p.png), #fff)',
      'radial-gradient(#fff, #000) ; background-image: url(//evil.example/p)',
      'expression(alert(1))',
      'javascript:alert(1)',
      'image-set("https://evil.example/p.png" 1x)',
      '\\75rl(https://evil.example/p.png)',
      'red</style><script>alert(1)</script>',
      '',
    ]) {
      expect(isSafeCssColor(v), v).toBe(false)
    }
  })
})

describe('isSafeImageSrc', () => {
  it('放行 data:image/*;base64 与 blob:', () => {
    expect(isSafeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isSafeImageSrc('data:image/svg+xml;base64,PHN2Zy8+')).toBe(true)
    expect(isSafeImageSrc('data:image/webp;base64,UklGRg==')).toBe(true)
    expect(isSafeImageSrc('blob:https://www.seatmark.cn/1234-5678')).toBe(true)
  })

  it('拒绝 http(s) 外链、非图片 data: 与脚本伪协议', () => {
    expect(isSafeImageSrc('https://evil.example/track.gif')).toBe(false)
    expect(isSafeImageSrc('//evil.example/track.gif')).toBe(false)
    expect(isSafeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    expect(isSafeImageSrc('data:image/svg+xml,<svg onload=alert(1)/>')).toBe(false)
    expect(isSafeImageSrc('javascript:alert(1)')).toBe(false)
    expect(isSafeImageSrc('')).toBe(false)
  })
})

describe('sanitizeTemplateForImport', () => {
  it('url() 背景被剥离（标签与字段）', () => {
    const dirty = tampered((t) => {
      t.label.background = 'url(https://evil.example/pixel.png)'
      t.label.borderColor = '#fff url(https://evil.example/b.png)'
      t.fields[0]!.background = 'linear-gradient(#fff, #000), url(https://evil.example/p.png)'
      t.fields[0]!.color = 'expression(alert(1))'
    })
    const clean = sanitizeTemplateForImport(dirty)
    expect(clean.label.background).toBeUndefined()
    expect(clean.label.borderColor).toBeUndefined()
    expect(clean.fields[0]!.background).toBeUndefined()
    expect(clean.fields[0]!.color).toBeUndefined()
    expect(JSON.stringify(clean)).not.toMatch(/evil\.example|url\(|expression/)
  })

  it('http(s) imageSrc 被剥离，data:image 与 blob: 保留', () => {
    const dirty = tampered((t) => {
      t.fields[0]!.imageSrc = 'https://evil.example/track.gif'
      t.fields[1]!.imageSrc = 'data:image/png;base64,iVBORw0KGgo='
      t.fields[2]!.imageSrc = 'blob:https://www.seatmark.cn/abc'
    })
    const clean = sanitizeTemplateForImport(dirty)
    expect(clean.fields[0]!.imageSrc).toBeUndefined()
    expect(clean.fields[1]!.imageSrc).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(clean.fields[2]!.imageSrc).toBe('blob:https://www.seatmark.cn/abc')
  })

  it('#hex 与渐变背景原样保留', () => {
    const okGradient = 'linear-gradient(135deg, #0369a1 0%, #0e7490 100%)'
    const dirty = tampered((t) => {
      t.label.background = okGradient
      t.fields[0]!.background = '#0f172a'
      t.fields[0]!.color = 'rgba(255, 255, 255, 0.9)'
    })
    const clean = sanitizeTemplateForImport(dirty)
    expect(clean.label.background).toBe(okGradient)
    expect(clean.fields[0]!.background).toBe('#0f172a')
    expect(clean.fields[0]!.color).toBe('rgba(255, 255, 255, 0.9)')
  })

  it('非字符串的颜色 / 图片值也被剥离', () => {
    const dirty = tampered((t) => {
      ;(t.label as unknown as Record<string, unknown>).background = { toString: () => 'url(x)' }
      ;(t.fields[0] as unknown as Record<string, unknown>).imageSrc = 42
    })
    const clean = sanitizeTemplateForImport(dirty)
    expect(clean.label.background).toBeUndefined()
    expect(clean.fields[0]!.imageSrc).toBeUndefined()
  })

  it('不改动入参，返回新对象', () => {
    const dirty = tampered((t) => {
      t.label.background = 'url(https://evil.example/pixel.png)'
    })
    const clean = sanitizeTemplateForImport(dirty)
    expect(dirty.label.background).toBe('url(https://evil.example/pixel.png)')
    expect(clean).not.toBe(dirty)
    expect(clean.label).not.toBe(dirty.label)
  })

  it('全部内置模板经净化后与自身严格深等（不误伤）', () => {
    expect(defaultTemplates.length).toBeGreaterThan(40)
    for (const template of defaultTemplates) {
      expect(isValidTemplate(template)).toBe(true)
      expect(sanitizeTemplateForImport(template), template.id).toStrictEqual(template)
    }
  })
})
