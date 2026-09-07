import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import type { TemplateField } from '@/types/template'
import { autoMapFields, autoMapFieldsDetailed } from '@/utils/autoMap'

const standardFields = defaultTemplates[0]!.fields

function textField(id: string, label: string): TemplateField {
  return { id, label, type: 'text', x: 0, y: 0, width: 10, height: 10 }
}

describe('autoMapFields', () => {
  it('标准表头全部自动命中', () => {
    const mapping = autoMapFields(standardFields, ['姓名', '考场', '准考证号', '座位号'])
    expect(mapping).toEqual({
      seatNo: '座位号',
      name: '姓名',
      room: '考场',
      examId: '准考证号',
    })
  })

  it('英文与同义词表头也能识别', () => {
    const mapping = autoMapFields(standardFields, ['Name', 'Room', 'ExamId', 'Seat'])
    expect(mapping.name).toBe('Name')
    expect(mapping.room).toBe('Room')
    expect(mapping.examId).toBe('ExamId')
    expect(mapping.seatNo).toBe('Seat')
  })

  it('学号表头映射到 studentId 字段', () => {
    const fields = [textField('studentId', '学号'), textField('examId', '准考证号')]
    const mapping = autoMapFields(fields, ['学号', '准考证号'])
    expect(mapping.studentId).toBe('学号')
    expect(mapping.examId).toBe('准考证号')
  })

  it('无法识别的表头不强行映射', () => {
    const mapping = autoMapFields(standardFields, ['备注', '联系电话'])
    expect(mapping).toEqual({})
  })

  it('多个字段命中同一列时优先占用不同列', () => {
    const fields = [textField('a', '城市'), textField('b', '城市')]
    const mapping = autoMapFields(fields, ['城市', '城市2'])
    expect(mapping.a).toBe('城市')
    expect(mapping.b).toBe('城市2')
  })

  it('没有空余列时允许复用已占用的列', () => {
    const fields = [textField('a', '城市'), textField('b', '城市')]
    const mapping = autoMapFields(fields, ['城市'])
    expect(mapping.a).toBe('城市')
    expect(mapping.b).toBe('城市')
  })

  it('未知字段回退用 id 与 label 匹配', () => {
    const mapping = autoMapFields([textField('school', '学校')], ['学校名称'])
    expect(mapping.school).toBe('学校名称')
  })

  it('精确匹配优先：座位号/考号/准考证号/考场号 相近词不错配', () => {
    const mapping = autoMapFields(standardFields, ['考号', '座位号', '考场号', '姓名'])
    expect(mapping.seatNo).toBe('座位号')
    expect(mapping.examId).toBe('考号')
    expect(mapping.room).toBe('考场号')
    expect(mapping.name).toBe('姓名')
  })

  it('只有准考证号列时不会被座位号字段抢占', () => {
    const mapping = autoMapFields(standardFields, ['准考证号', '姓名', '座位号'])
    expect(mapping.examId).toBe('准考证号')
    expect(mapping.seatNo).toBe('座位号')
  })

  it('表头含空格/括号仍可精确匹配', () => {
    const mapping = autoMapFields(standardFields, ['座位 号', '姓名（考生）', '考场'])
    expect(mapping.seatNo).toBe('座位 号')
    expect(mapping.name).toBe('姓名（考生）')
    expect(mapping.room).toBe('考场')
  })

  it('主管医生/责任护士/接送人等字段命中数据集同义列', () => {
    const fields = [
      textField('doctor', '主管医生'),
      textField('nurse', '责任护士'),
      textField('guardian', '接送人'),
      textField('teacher', '班主任'),
    ]
    const mapping = autoMapFields(fields, ['医生', '护士', '家长', '老师'])
    expect(mapping.doctor).toBe('医生')
    expect(mapping.nurse).toBe('护士')
    expect(mapping.guardian).toBe('家长')
    expect(mapping.teacher).toBe('老师')
  })

  it('固定文本字段不参与映射', () => {
    const fixed = { ...textField('caption', '姓名'), fixedText: '请对号入座' }
    const mapping = autoMapFields([fixed, textField('name', '姓名')], ['姓名'])
    expect(mapping.caption).toBeUndefined()
    expect(mapping.name).toBe('姓名')
  })

  it('扩充同义词：职称/头衔→职务，企业/集团→单位，处室/科组→部门，名称/称呼→姓名', () => {
    const fields = [
      textField('position', '职务'),
      textField('company', '单位'),
      textField('department', '部门'),
      textField('name', '姓名'),
    ]
    const mapping = autoMapFields(fields, ['称呼', '集团', '科组', '职称'])
    expect(mapping).toEqual({ position: '职称', company: '集团', department: '科组', name: '称呼' })
  })

  it('同族回退：模板只有「单位」字段、名单只有「部门」列时映射 部门→单位并标记 borrowed', () => {
    const fields = [textField('org', '单位'), textField('name', '姓名')]
    const { mapping, borrowed } = autoMapFieldsDetailed(fields, ['姓名', '部门', '职务'])
    expect(mapping.org).toBe('部门')
    expect(mapping.name).toBe('姓名')
    expect(borrowed).toEqual({ org: '部门' })
  })

  it('会议桌牌三字段（单位/姓名/职务）导入「姓名/部门/职务」后 0 个未映射', () => {
    const fields = [textField('org', '单位'), textField('name', '姓名'), textField('title', '职务')]
    const { mapping, borrowed } = autoMapFieldsDetailed(fields, ['姓名', '部门', '职务'])
    expect(mapping).toEqual({ org: '部门', name: '姓名', title: '职务' })
    expect(borrowed).toEqual({ org: '部门' })
  })

  it('职务列被 title（头衔）字段吸收，不算回退', () => {
    const { mapping, borrowed } = autoMapFieldsDetailed([textField('title', '头衔')], ['姓名', '职务'])
    expect(mapping.title).toBe('职务')
    expect(borrowed).toEqual({})
  })

  it('精确匹配优先级不被回退破坏：单位/部门各归各', () => {
    const fields = [textField('company', '单位'), textField('department', '部门')]
    const { mapping, borrowed } = autoMapFieldsDetailed(fields, ['部门', '单位'])
    expect(mapping).toEqual({ company: '单位', department: '部门' })
    expect(borrowed).toEqual({})
  })

  it('同族回退只借未占用列：名单只有一列「部门」时不会同时给单位与部门', () => {
    const fields = [textField('department', '部门'), textField('company', '单位')]
    const { mapping, borrowed } = autoMapFieldsDetailed(fields, ['部门'])
    expect(mapping.department).toBe('部门')
    expect(mapping.company).toBeUndefined()
    expect(borrowed).toEqual({})
  })

  it('学校字段可借用单位列（school ↔ company 同族）', () => {
    const { mapping, borrowed } = autoMapFieldsDetailed([textField('school', '学校')], ['姓名', '单位'])
    expect(mapping.school).toBe('单位')
    expect(borrowed).toEqual({ school: '单位' })
  })

  it('非同族字段（考场/座位号）不参与回退', () => {
    const mapping = autoMapFields(standardFields, ['部门', '职务'])
    expect(mapping).toEqual({})
  })
})
