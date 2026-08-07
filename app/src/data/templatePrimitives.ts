import type { TemplateField } from '@/types/template'

import { DEFAULT_FONT_STACK, DEFAULT_FONT_STACK_EN } from './fonts'

/** 内置模板默认中文字体：宋体（正式考务文档气质，本机渲染零联网） */
export const FONT_FAMILY = DEFAULT_FONT_STACK

/** 内置模板默认西文字体：Times New Roman（英文/数字，与宋体经典搭配） */
export const FONT_FAMILY_EN = DEFAULT_FONT_STACK_EN

export const INK = '#0f172a'
export const INK_SOFT = '#475569'
export const INK_MUTED = '#64748b'
export const INK_FAINT = '#94a3b8'
export const LINE = '#cbd5e1'

/**
 * 细分隔线：用细长色块字段实现。
 * fixedText 为空串 → 不参与 Excel 映射、自动匹配与缺失高亮。
 */
export function hairline(
  id: string,
  rect: { x: number; y: number; width: number; height: number },
  color = LINE,
): TemplateField {
  return {
    id,
    label: '分隔线',
    type: 'text',
    ...rect,
    fixedText: '',
    background: color,
    padding: 0,
    maxLines: 1,
  }
}
