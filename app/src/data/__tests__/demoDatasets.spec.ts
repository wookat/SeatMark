import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import {
  CATEGORY_DEMO_DATASET,
  DEMO_DATASETS,
  demoExcelFor,
  resolveDemoDataset,
  TEMPLATE_DEMO_DATASET_OVERRIDES,
} from '@/data/demoDatasets'

describe('demoDatasets', () => {
  it('数据集 id 唯一且每套都有表头与数据行', () => {
    const ids = DEMO_DATASETS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DEMO_DATASETS) {
      expect(d.headers.length).toBeGreaterThan(0)
      expect(d.rows.length).toBeGreaterThanOrEqual(12)
      for (const row of d.rows) {
        for (const h of d.headers) {
          expect(row[h], `${d.id} 数据行缺少「${h}」`).toBeTruthy()
        }
      }
    }
  })

  it('分类默认映射与覆写表都指向存在的数据集', () => {
    const ids = new Set(DEMO_DATASETS.map((d) => d.id))
    for (const id of Object.values(CATEGORY_DEMO_DATASET)) expect(ids.has(id)).toBe(true)
    for (const id of Object.values(TEMPLATE_DEMO_DATASET_OVERRIDES)) expect(ids.has(id)).toBe(true)
  })

  it('覆写表中的模板 id 都是内置模板', () => {
    const templateIds = new Set(defaultTemplates.map((t) => t.id))
    for (const id of Object.keys(TEMPLATE_DEMO_DATASET_OVERRIDES)) {
      expect(templateIds.has(id), `覆写表中的 ${id} 不是内置模板`).toBe(true)
    }
  })

  it('每款内置模板都能解析到一套演示数据集', () => {
    for (const template of defaultTemplates) {
      const dataset = resolveDemoDataset(template)
      expect(dataset, `${template.id} 未解析到数据集`).toBeTruthy()
    }
  })

  it('每款模板的演示数据字段齐全：所有可映射字段都有列且每行有值', () => {
    for (const template of defaultTemplates) {
      const demo = demoExcelFor(template)
      expect(new Set(demo.headers).size, `${template.id} 表头重复`).toBe(demo.headers.length)
      const mappable = template.fields.filter(
        (f) => f.type === 'text' && f.fixedText == null && f.mirrorOf == null,
      )
      for (const field of mappable) {
        const header = demo.mapping[field.id]
        expect(header, `${template.id}.${field.id} 未映射到演示数据列`).toBeTruthy()
        expect(demo.headers).toContain(header)
        for (const row of demo.rows) {
          expect(
            row[header!],
            `${template.id}.${field.id} 在「${header}」列存在空值`,
          ).toBeTruthy()
        }
      }
    }
  })
})
