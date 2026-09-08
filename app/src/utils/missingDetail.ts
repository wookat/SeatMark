/**
 * 空字段明细文案：MappingPanel 的逐行清单与 PreviewArea 导出旁的示例共用同一口径，
 * 行号为数据行 1 起的序号（不含表头，与导入预览一致）。
 */

export interface MissingDetailItem {
  rowIndex: number
  fields: string[]
  /** 该行姓名（已映射且非空时才有），用于导出旁示例定位 */
  name?: string
}

type Translate = (key: string) => string

/** 「第 X 行：姓名、桌号 为空」 / "Row X: Name, Table empty" */
export function missingDetailText(
  item: Pick<MissingDetailItem, 'rowIndex' | 'fields'>,
  locale: string,
  t: Translate,
): string {
  const en = locale === 'en'
  const fields = item.fields.map((f) => t(f)).join(en ? ', ' : '、')
  return `${t('第 {n} 行').replace('{n}', String(item.rowIndex))}${en ? ': ' : '：'}${fields} ${t('为空')}`
}

/**
 * 导出旁首个缺失示例：「例：第 3 行 张三 · 座位号为空」，缺失行超过 1 时追加「等 N 行」；
 * 无明细时返回空串。
 */
export function missingExampleText(
  details: readonly MissingDetailItem[],
  missingRows: number,
  locale: string,
  t: Translate,
): string {
  const first = details[0]
  if (!first) return ''
  const en = locale === 'en'
  const fields = first.fields.map((f) => t(f)).join(en ? ', ' : '、')
  const row = t('第 {n} 行').replace('{n}', String(first.rowIndex))
  const who = first.name ? ` ${first.name}` : ''
  const body = en ? `${row}${who} · ${fields} ${t('为空')}` : `${row}${who} · ${fields}${t('为空')}`
  const more = missingRows > 1 ? ` ${t('等 {n} 行').replace('{n}', String(missingRows))}` : ''
  return `${t('例：')}${body}${more}`
}
