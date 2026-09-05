import { describe, expect, it } from 'vitest'

import { standardTemplate } from '@/data/templateStandard'
import type { LabelTemplate } from '@/types/template'
import { localizeTemplateForLocale, SAMPLE_NAME_EN } from '@/utils/templateLocale'

const CJK = /[\u4e00-\u9fff]/

function fixedTexts(t: LabelTemplate): string[] {
  return t.fields.flatMap((f) => (f.fixedText != null ? [f.fixedText] : []))
}

describe('localizeTemplateForLocale', () => {
  it('en：标准考场版的「座位号 SEAT」映射为 SEAT NO.，fixedText 不再含中文', () => {
    const out = localizeTemplateForLocale(standardTemplate, 'en')
    expect(fixedTexts(standardTemplate)).toContain('座位号 SEAT')
    expect(fixedTexts(out)).toContain('SEAT NO.')
    for (const text of fixedTexts(out)) expect(text).not.toMatch(CJK)
  })

  it('en：映射表全部命中，未命中的固定文案与 caption 原样保留', () => {
    const tpl: LabelTemplate = {
      ...standardTemplate,
      fields: [
        { ...standardTemplate.fields[0]!, id: 'a', fixedText: '座位号 SEAT NO.' },
        { ...standardTemplate.fields[0]!, id: 'b', fixedText: '请对号入座' },
        { ...standardTemplate.fields[0]!, id: 'c', fixedText: '某某中学', caption: '考场' },
        { ...standardTemplate.fields[0]!, id: 'd', caption: '准考证号' },
      ],
    }
    const out = localizeTemplateForLocale(tpl, 'en')
    expect(out.fields.map((f) => f.fixedText)).toEqual([
      'SEAT NO.',
      'Please sit in your assigned seat',
      '某某中学',
      undefined,
    ])
    expect(out.fields[2]!.caption).toBe('ROOM')
    expect(out.fields[3]!.caption).toBe('EXAM ID')
  })

  it('zh：返回原对象本身', () => {
    expect(localizeTemplateForLocale(standardTemplate, 'zh')).toBe(standardTemplate)
  })

  it('不修改入参：原模板与字段对象保持不变，无命中时返回原对象', () => {
    const before = JSON.stringify(standardTemplate)
    const out = localizeTemplateForLocale(standardTemplate, 'en')
    expect(out).not.toBe(standardTemplate)
    expect(JSON.stringify(standardTemplate)).toBe(before)
    // 未命中的字段对象按引用复用
    const seatNo = standardTemplate.fields.find((f) => f.id === 'seatNo')!
    expect(out.fields.find((f) => f.id === 'seatNo')).toBe(seatNo)

    const plain: LabelTemplate = { ...standardTemplate, fields: [seatNo], sampleData: undefined }
    expect(localizeTemplateForLocale(plain, 'en')).toBe(plain)
  })

  it('en：示例值考场编号→Room N，姓名→英文占位名，其余 sample 原样保留', () => {
    const out = localizeTemplateForLocale(standardTemplate, 'en')
    expect(out.fields.find((f) => f.id === 'room')!.sample).toBe('Room 1')
    expect(out.fields.find((f) => f.id === 'name')!.sample).toBe(SAMPLE_NAME_EN)
    expect(out.fields.find((f) => f.id === 'seatNo')!.sample).toBe('12')
    expect(out.sampleData).toMatchObject({ room: 'Room 1', name: SAMPLE_NAME_EN, seatNo: '12' })
    expect(standardTemplate.sampleData!.room).toBe('考场-1')

    const tpl: LabelTemplate = {
      ...standardTemplate,
      sampleData: undefined,
      fields: [
        { ...standardTemplate.fields[0]!, id: 'room', sample: '第3考场' },
        { ...standardTemplate.fields[0]!, id: 'className', sample: '高二（3）班' },
        { ...standardTemplate.fields[0]!, id: 'name', sample: 'Li Ming' },
      ],
    }
    expect(localizeTemplateForLocale(tpl, 'en').fields.map((f) => f.sample)).toEqual([
      'Room 3',
      '高二（3）班',
      'Li Ming',
    ])
  })
})
