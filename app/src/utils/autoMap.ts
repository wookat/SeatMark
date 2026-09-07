import type { FieldMapping, TemplateField } from '@/types/template'

/**
 * 字段 -> 表头匹配词，按优先级排序（前面的词优先命中）。
 * 「考号 / 准考证号 / 座位号 / 考场号」等相近词分属不同字段，
 * 依赖两轮匹配（精确优先于包含）避免错配。
 */
const MATCH_PATTERNS: Record<string, string[]> = {
  seatNo: ['座位号', '座号', '座位', 'seatno', 'seat', '序号'],
  name: ['姓名', '名字', '考生姓名', '宾客', 'name', '考生', '名称', '称呼'],
  room: ['考场号', '考场', '教室', '包间名', '包间', '场次', 'room', '地点'],
  examId: ['准考证号', '准考证', '考号', '考生号', 'examid', '编号'],
  gender: ['性别', 'gender', 'sex'],
  idCard: ['身份证号', '身份证', '证件号', 'idcard'],
  studentId: ['学号', '学籍号', '学籍', 'studentid', 'student'],
  className: ['班级', '年级', 'class'],
  school: ['学校', '院校', '学院', 'school'],
  company: ['单位', '公司', '机构', '企业', '集团', 'company', 'organization', 'org'],
  org: ['单位', '公司', '机构', '企业', '集团', 'organization', 'org', 'company'],
  unit: ['单位', '公司', '机构', '企业', '集团', 'unit', 'organization', 'org'],
  department: ['部门', '科室', '院系', '处室', '科组', 'department', 'dept', 'team'],
  dept: ['部门', '科室', '院系', '处室', '科组', 'dept', 'department', 'team'],
  position: ['职务', '职位', '岗位', '职称', '头衔', 'position', 'title'],
  title: ['职务', '职位', '头衔', '职称', 'title'],
  employeeId: ['工号', '员工号', 'employeeid', 'employee', 'staff'],
  teacher: ['班主任', '老师', '教师', 'teacher'],
  doctor: ['医生', '主管医生', '主治医生', '出诊医生', 'doctor'],
  nurse: ['护士', '责任护士', 'nurse'],
  guardian: ['接送人', '家长', '监护人', 'guardian'],
  phone: ['电话', '手机号', '手机', '联系电话', 'phone', 'tel'],
}

/**
 * 同族字段组：两轮匹配后仍未映射的字段，可借用同组其他字段的匹配词命中的未占用列
 * （如模板只有「单位」字段而名单只有「部门」列），结果记入 borrowed 供 UI 提示。
 */
const FIELD_FAMILIES: string[][] = [
  ['company', 'org', 'unit', 'department', 'dept'],
  ['position', 'title', 'post'],
  ['school', 'company', 'org', 'unit'],
]

export interface AutoMapResult {
  mapping: FieldMapping
  /** 第三轮同族回退得到的映射：fieldId → 表头 */
  borrowed: Record<string, string>
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
 * 2. 包含匹配：剩余字段在剩余列中按匹配词优先级做包含匹配；
 * 3. 同族回退：仍未映射的字段借用 FIELD_FAMILIES 同组字段的匹配词，只取未占用列。
 * 每列只分配给一个字段；全部落空的字段保持未映射，由用户手动选择。
 */
export function autoMapFields(fields: TemplateField[], headers: string[]): FieldMapping {
  return autoMapFieldsDetailed(fields, headers).mapping
}

export function autoMapFieldsDetailed(fields: TemplateField[], headers: string[]): AutoMapResult {
  const mapping: FieldMapping = {}
  const borrowed: Record<string, string> = {}
  const used = new Set<string>()
  const mappable = fields.filter(
    (f) => f.type === 'text' && f.fixedText == null && f.mirrorOf == null,
  )
  const normalized = headers.map((h) => normalize(h))

  const patternsOf = (field: TemplateField): string[] =>
    [...(MATCH_PATTERNS[field.id] ?? [field.id]), field.label]
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

  // 第三轮：同族回退（只借未占用列，先精确后包含）
  for (const field of mappable) {
    if (mapping[field.id]) continue
    const siblingPatterns = FIELD_FAMILIES.filter((family) => family.includes(field.id))
      .flat()
      .filter((id) => id !== field.id)
      .flatMap((id) => MATCH_PATTERNS[id] ?? [])
      .map((p) => normalize(p))
      .filter(Boolean)
    if (!siblingPatterns.length) continue
    const pick = (test: (value: string, pattern: string) => boolean): string => {
      for (const pattern of siblingPatterns) {
        const idx = headers.findIndex((h, i) => !used.has(h) && test(normalized[i]!, pattern))
        if (idx >= 0) return headers[idx]!
      }
      return ''
    }
    const header = pick((value, pattern) => value === pattern) || pick((value, pattern) => value.includes(pattern))
    if (header) {
      mapping[field.id] = header
      borrowed[field.id] = header
      used.add(header)
    }
  }

  return { mapping, borrowed }
}
