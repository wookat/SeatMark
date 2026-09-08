import { describe, expect, it } from 'vitest'

import { standardTemplate } from '@/data/templateStandard'
import type { LabelTemplate } from '@/types/template'
import { defaultTemplates } from '@/data/defaultTemplates'
import { WEB_FONTS } from '@/data/fonts'
import {
  FONT_NAME_EN,
  fontDisplayName,
  localizeTemplateForLocale,
  SAMPLE_NAME_EN,
  templateHasCjk,
} from '@/utils/templateLocale'

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

  it('en：首页橱窗前 5 款默认模板的固定文案 / 小注 / 示例值均不含中文', () => {
    for (const tpl of defaultTemplates.slice(0, 5)) {
      const out = localizeTemplateForLocale(tpl, 'en')
      for (const f of out.fields) {
        expect(f.fixedText ?? '', `${tpl.id}/${f.id} fixedText`).not.toMatch(CJK)
        expect(f.caption ?? '', `${tpl.id}/${f.id} caption`).not.toMatch(CJK)
        expect(f.sample ?? '', `${tpl.id}/${f.id} sample`).not.toMatch(CJK)
      }
      for (const v of Object.values(out.sampleData ?? {})) expect(v).not.toMatch(CJK)
    }
  })

  it('en：示例值考场编号→Room N，姓名/班级→英文占位值，无占位的字段 sample 原样保留', () => {
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
        { ...standardTemplate.fields[0]!, id: 'motto', sample: '学而不厌' },
        { ...standardTemplate.fields[0]!, id: 'name', sample: 'Li Ming' },
      ],
    }
    expect(localizeTemplateForLocale(tpl, 'en').fields.map((f) => f.sample)).toEqual([
      'Room 3',
      'Class 9-5',
      '学而不厌',
      'Li Ming',
    ])
  })

  it('r359 en：中英并排的固定文案只保留英文段，纯中文固定文案走映射表', () => {
    const tpl: LabelTemplate = {
      ...standardTemplate,
      sampleData: undefined,
      fields: [
        { ...standardTemplate.fields[0]!, id: 'a', fixedText: '考试出入证 · EXAM PASS' },
        { ...standardTemplate.fields[0]!, id: 'b', fixedText: '床位 BED' },
        { ...standardTemplate.fields[0]!, id: 'c', fixedText: 'VIP GUEST · 贵宾席' },
        { ...standardTemplate.fields[0]!, id: 'd', fixedText: '2026 行业博览会 · EXPO PASS' },
        { ...standardTemplate.fields[0]!, id: 'e', fixedText: '诚信应考 · 遵守考场规则' },
        { ...standardTemplate.fields[0]!, id: 'f', fixedText: '核验照片 PHOTO' },
        { ...standardTemplate.fields[0]!, id: 'g', fixedText: '仅中文无英文段' },
        { ...standardTemplate.fields[0]!, id: 'h', caption: '身份证号' },
      ],
    }
    const out = localizeTemplateForLocale(tpl, 'en')
    expect(out.fields.map((f) => f.fixedText)).toEqual([
      'EXAM PASS',
      'BED',
      'VIP GUEST',
      '2026 · EXPO PASS',
      'Exam with integrity · Follow the rules',
      'PHOTO',
      '仅中文无英文段',
      undefined,
    ])
    expect(out.fields[7]!.caption).toBe('ID NO.')
  })

  it('r359 en：示例值 第N桌/第N组/第 N 考场 与职务示例映射为英文', () => {
    const tpl: LabelTemplate = {
      ...standardTemplate,
      sampleData: { table: '第 3 桌', group: '第2组', room: '第 12 考场', title: '首席技术官', org: '某某研究院' },
      fields: [],
    }
    expect(localizeTemplateForLocale(tpl, 'en').sampleData).toEqual({
      table: 'Table 3',
      group: 'Group 2',
      room: 'Room 12',
      title: 'CTO',
      org: 'Example Institute',
    })
  })

  it('r359：全部默认模板 en 本地化后固定文案/小注不含中文；剩余中文示例由 templateHasCjk 识别；zh 下始终为原对象', () => {
    for (const tpl of defaultTemplates) {
      const out = localizeTemplateForLocale(tpl, 'en')
      for (const f of out.fields) {
        expect(f.fixedText ?? '', `${tpl.id}/${f.id} fixedText`).not.toMatch(CJK)
        expect(f.caption ?? '', `${tpl.id}/${f.id} caption`).not.toMatch(CJK)
      }
      const hasSample =
        out.fields.some((f) => CJK.test(f.sample ?? '')) ||
        Object.values(out.sampleData ?? {}).some((v) => CJK.test(v))
      expect(templateHasCjk(out), tpl.id).toBe(hasSample)
      expect(localizeTemplateForLocale(tpl, 'zh')).toBe(tpl)
    }
  })
})

describe('fontDisplayName（r359）', () => {
  it('en 下中文字体名显示英文别名，zh 下保持原名，未知名称原样返回', () => {
    expect(fontDisplayName('宋体', 'en')).toBe('SimSun')
    expect(fontDisplayName('黑体（微软雅黑）', 'en')).toBe('Microsoft YaHei')
    expect(fontDisplayName('楷体', 'en')).toBe('KaiTi')
    expect(fontDisplayName('宋体', 'zh')).toBe('宋体')
    expect(fontDisplayName('Inter', 'en')).toBe('Inter')
    expect(FONT_NAME_EN['黑体']).toBe('SimHei')
  })

  it('内置中文 WebFont 的名称全部有英文别名', () => {
    for (const font of WEB_FONTS.filter((f) => f.lang === 'zh')) {
      expect(fontDisplayName(font.name, 'en'), font.name).not.toMatch(CJK)
    }
  })
})
