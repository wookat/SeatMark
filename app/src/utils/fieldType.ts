import type { FieldType, TemplateField } from '@/types/template'

export const FIELD_TYPES: readonly FieldType[] = ['text', 'image', 'qr']

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && (FIELD_TYPES as readonly string[]).includes(value)
}

/** 从名单列取单元格文本的字段（文本 / 二维码）；图片字段走照片匹配 */
export function isColumnField(field: Pick<TemplateField, 'type'>): boolean {
  return field.type === 'text' || field.type === 'qr'
}

/** 参与 Excel 列映射的字段：列字段且非固定文本、非镜像 */
export function isMappableField(field: TemplateField): boolean {
  return isColumnField(field) && field.fixedText == null && field.mirrorOf == null
}
