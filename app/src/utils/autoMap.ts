import type { FieldMapping, TemplateField } from '@/types/template'

/**
 * 字段 -> 表头匹配词，按优先级排序（前面的词优先命中）。
 * 「考号 / 准考证号 / 座位号 / 考场号」等相近词分属不同字段，
 * 依赖两轮匹配（精确优先于包含）避免错配。
 */
const MATCH_PATTERNS: Record<string, string[]> = {
  seatNo: ['座位号', '座号', '座位', 'seatno', 'seat', '序号'],
  name: ['姓名', '名字', '考生姓名', 'name', '考生'],
  room: ['考场号', '考场', '教室', '场次', 'room', '地点'],
  examId: ['准考证号', '准考证', '考号', '考生号', 'examid', '编号'],
  gender: ['性别', 'gender', 'sex'],
  idCard: ['身份证号', '身份证', '证件号', 'idcard'],
  studentId: ['学号', '学籍号', '学籍', 'studentid', 'student'],
  className: ['班级', '年级', 'class'],
  school: ['学校', '院校', '学院', 'school'],
  company: ['单位', '公司', '机构', 'company'],
  department: ['部门', '科室', '院系', 'department', 'dept'],
  position: ['职务', '职位', '岗位', 'position'],
  employeeId: ['工号', '员工号', 'employeeid', 'employee', 'staff'],
}

/** 归一化表头/匹配词：小写并去掉空白与常见标点 */
function normalize(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[\s_\-（）()：:、.·]/g, '')
}

/**
 * 根据表头智能匹配模板文本字段，两轮匹配：
 * 1. 精确匹配：归一化后表头与匹配词完全相等（「座位号」只会给 seatNo，
 *    不会被 examId 的「考号」包含匹配抢走）；
 * 2. 包含匹配：剩余字段在剩余列中按匹配词优先级做包含匹配。
 * 每列只分配给一个字段；全部落空的字段保持未映射，由用户手动选择。
 */
export function autoMapFields(fields: TemplateField[], headers: string[]): FieldMapping {
  const mapping: FieldMapping = {}
  const used = new Set<string>()
  const mappable = fields.filter(
    (f) => f.type === 'text' && f.fixedText == null && f.mirrorOf == null,
  )
  const normalized = headers.map((h) => normalize(h))

  const patternsOf = (field: TemplateField): string[] =>
    (MATCH_PATTERNS[field.id] ?? [field.id, field.label])
      .map((p) => normalize(p))
      .filter(Boolean)

  // 第一轮：精确匹配（匹配词按优先级，列未被占用才分配）
  for (const field of mappable) {
    for (const pattern of patternsOf(field)) {
      const idx = headers.findIndex((h, i) => !used.has(h) && normalized[i] === pattern)
      if (idx >= 0) {
        mapping[field.id] = headers[idx]!
        used.add(headers[idx]!)
        break
      }
    }
  }

  // 第二轮：包含匹配（仅处理仍未映射的字段与未占用的列）
  for (const field of mappable) {
    if (mapping[field.id]) continue
    let fallback = ''
    outer: for (const pattern of patternsOf(field)) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]!
        if (!normalized[i]!.includes(pattern)) continue
        if (!used.has(header)) {
          mapping[field.id] = header
          used.add(header)
          fallback = ''
          break outer
        }
        if (!fallback) fallback = header
      }
    }
    if (!mapping[field.id] && fallback) {
      mapping[field.id] = fallback
    }
  }

  return mapping
}
