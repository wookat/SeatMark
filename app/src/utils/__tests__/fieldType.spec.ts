import { describe, expect, it } from 'vitest'

import type { TemplateField } from '@/types/template'
import { FIELD_TYPES, isColumnField, isFieldType, isMappableField } from '../fieldType'

function field(partial: Partial<TemplateField> & Pick<TemplateField, 'type'>): TemplateField {
  return { id: 'f', label: 'f', x: 0, y: 0, width: 10, height: 10, ...partial }
}

describe('isFieldType', () => {
  it('text / image / qr 三种合法类型', () => {
    expect(FIELD_TYPES).toEqual(['text', 'image', 'qr'])
    for (const t of FIELD_TYPES) expect(isFieldType(t)).toBe(true)
  })

  it('未知类型与非字符串一律拒绝（旧分享 hash / 手改 JSON 不崩）', () => {
    expect(isFieldType('barcode')).toBe(false)
    expect(isFieldType('')).toBe(false)
    expect(isFieldType(undefined)).toBe(false)
    expect(isFieldType(null)).toBe(false)
    expect(isFieldType(1)).toBe(false)
    expect(isFieldType({ type: 'qr' })).toBe(false)
  })
})

describe('isColumnField / isMappableField', () => {
  it('qr 与 text 一样从名单列取值，image 不取', () => {
    expect(isColumnField({ type: 'text' })).toBe(true)
    expect(isColumnField({ type: 'qr' })).toBe(true)
    expect(isColumnField({ type: 'image' })).toBe(false)
  })

  it('固定文本与镜像字段不参与映射；qr 字段参与映射', () => {
    expect(isMappableField(field({ type: 'qr' }))).toBe(true)
    expect(isMappableField(field({ type: 'text' }))).toBe(true)
    expect(isMappableField(field({ type: 'text', fixedText: '请对号入座' }))).toBe(false)
    expect(isMappableField(field({ type: 'text', mirrorOf: 'name' }))).toBe(false)
    expect(isMappableField(field({ type: 'image' }))).toBe(false)
  })
})
