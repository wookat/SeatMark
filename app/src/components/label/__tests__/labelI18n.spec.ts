import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import LabelCard from '@/components/label/LabelCard.vue'
import LabelSheet from '@/components/label/LabelSheet.vue'
import { defaultTemplates } from '@/data/defaultTemplates'
import { setLocale } from '@/i18n'
import type { DataRow } from '@/types/template'
import { BlankLabelError } from '@/utils/pngExport'

const standard = defaultTemplates.find((t) => t.id === 'standard')!
const rows: DataRow[] = [
  { seatNo: '1', name: '甲' },
  { seatNo: '2', name: '乙' },
]
const getText = (row: DataRow, fieldId: string) => String(row[fieldId] ?? '')

afterEach(async () => {
  await setLocale('zh')
})

describe('label components / en locale', () => {
  it('LabelCard 未映射字段在 en 下渲染 Unmapped，zh 下保持中文', async () => {
    const props = {
      template: standard,
      texts: { seatNo: '1', name: 'n', room: '', examId: 'e' },
      unmappedFields: new Set(['room']),
    }
    const zh = mount(LabelCard, { props })
    expect(zh.text()).toContain('未映射')
    expect(zh.text()).not.toContain('Unmapped')

    await setLocale('en')
    const en = mount(LabelCard, { props })
    expect(en.text()).toContain('Unmapped')
    expect(en.text()).not.toContain('未映射')
  })

  it('LabelSheet 单张覆写徽标在 en 下渲染 Edited', async () => {
    const props = {
      template: standard,
      rows,
      getText,
      interactive: true,
      overriddenRows: new Set([rows[0]!]),
    }
    const zh = mount(LabelSheet, { props })
    expect(zh.text()).toContain('已改')

    await setLocale('en')
    const en = mount(LabelSheet, { props })
    expect(en.text()).toContain('Edited')
    expect(en.text()).not.toContain('已改')
    expect(en.find('[aria-label="This label has a per-label override"]').exists()).toBe(true)
  })
})

describe('BlankLabelError', () => {
  it('携带 page/total/index 三个结构化字段，message 保持原中文文案', () => {
    const err = new BlankLabelError(2, 5, 7)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('BlankLabelError')
    expect(err.page).toBe(2)
    expect(err.total).toBe(5)
    expect(err.index).toBe(7)
    expect(err.message).toBe('第 2/5 页第 7 枚标签渲染为空白')
  })

  it('三个数字与旧版正则解析结果一致', () => {
    const err = new BlankLabelError(12, 34, 56)
    const m = err.message.match(/^第 (\d+)\/(\d+) 页第 (\d+) 枚标签渲染为空白$/)!
    expect([Number(m[1]), Number(m[2]), Number(m[3])]).toEqual([err.page, err.total, err.index])
  })
})
