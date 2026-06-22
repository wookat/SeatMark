import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import type { TemplateField } from '@/types/template'
import { autoMapFields } from '@/utils/autoMap'

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

  it('固定文本字段不参与映射', () => {
    const fixed = { ...textField('caption', '姓名'), fixedText: '请对号入座' }
    const mapping = autoMapFields([fixed, textField('name', '姓名')], ['姓名'])
    expect(mapping.caption).toBeUndefined()
    expect(mapping.name).toBe('姓名')
  })
})
