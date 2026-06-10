import type { FieldMapping, TemplateField } from '@/types/template'

const MATCH_PATTERNS: Record<string, string[]> = {
  seatNo: ['座位', '座号', '序号', 'seat', '考号', '编号'],
  name: ['姓名', '名字', '考生', 'name'],
  room: ['考场', '教室', '场次', 'room', '地点'],
  examId: ['准考证', 'examid', '准考证号'],
  gender: ['性别', 'gender', 'sex'],
  idCard: ['身份证', '证件号', 'idcard'],
  studentId: ['学号', '学籍', 'student', 'studentid'],
}

/**
 * 根据表头智能匹配模板文本字段。
 * 优先把每个字段匹配到尚未被占用的列，避免两个字段抢同一列。
 */
export function autoMapFields(fields: TemplateField[], headers: string[]): FieldMapping {
  const mapping: FieldMapping = {}
  const used = new Set<string>()

  for (const field of fields) {
    if (field.type !== 'text' || field.fixedText != null) continue
    const patterns = MATCH_PATTERNS[field.id] ?? [field.id, field.label]
    const lowered = patterns.map((p) => String(p).toLowerCase()).filter(Boolean)

    let fallback = ''
    for (const header of headers) {
      const lowerHeader = header.toLowerCase()
      if (!lowered.some((p) => lowerHeader.includes(p))) continue
      if (!used.has(header)) {
        mapping[field.id] = header
        used.add(header)
        fallback = ''
        break
      }
      if (!fallback) fallback = header
    }
    if (!mapping[field.id] && fallback) {
      mapping[field.id] = fallback
    }
  }

  return mapping
}
