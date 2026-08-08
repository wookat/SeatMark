import { describe, expect, it } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import {
  CATEGORY_DEMO_DATASET,
  DEMO_DATASETS,
  demoExcelFor,
  resolveDemoDataset,
  sampleExcelFor,
  TEMPLATE_DEMO_DATASET_OVERRIDES,
} from '@/data/demoDatasets'

/** 数据集声明的刻意留空单元格（rowIndex:header） */
function blankCellKeys(dataset: (typeof DEMO_DATASETS)[number]): Set<string> {
  return new Set((dataset.blankCells ?? []).map((c) => `${c.row}:${c.header}`))
}

describe('demoDatasets', () => {
  it('数据集 id 唯一且每套都有表头与数据行', () => {
    const ids = DEMO_DATASETS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DEMO_DATASETS) {
      expect(d.headers.length).toBeGreaterThan(0)
      expect(d.rows.length).toBeGreaterThanOrEqual(12)
      const blanks = blankCellKeys(d)
      d.rows.forEach((row, i) => {
        for (const h of d.headers) {
          if (blanks.has(`${i}:${h}`)) {
            expect(row[h], `${d.id} 第 ${i} 行「${h}」应为声明的空单元格`).toBe('')
          } else {
            expect(row[h], `${d.id} 数据行缺少「${h}」`).toBeTruthy()
          }
        }
      })
    }
  })

  it('考场数据集含「考场」列，且至少一套数据集含刻意留空的单元格', () => {
    const exam = DEMO_DATASETS.find((d) => d.id === 'exam')!
    expect(exam.headers).toContain('考场')
    expect(exam.rows.every((r) => '考场' in r)).toBe(true)

    const withBlanks = DEMO_DATASETS.filter((d) => (d.blankCells ?? []).length > 0)
    expect(withBlanks.length).toBeGreaterThanOrEqual(1)
    for (const d of withBlanks) {
      for (const cell of d.blankCells!) {
        expect(d.headers, `${d.id} 空单元格表头「${cell.header}」不在表头中`).toContain(cell.header)
        expect(d.rows[cell.row]?.[cell.header], `${d.id} 第 ${cell.row} 行「${cell.header}」应为空`).toBe('')
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

  it('每款模板的演示数据字段齐全：所有可映射字段都有列且每行有值（声明的空单元格除外）', () => {
    for (const template of defaultTemplates) {
      const dataset = resolveDemoDataset(template)
      const blanks = blankCellKeys(dataset)
      const demo = demoExcelFor(template)
      expect(new Set(demo.headers).size, `${template.id} 表头重复`).toBe(demo.headers.length)
      const mappable = template.fields.filter(
        (f) => f.type === 'text' && f.fixedText == null && f.mirrorOf == null,
      )
      for (const field of mappable) {
        const header = demo.mapping[field.id]
        expect(header, `${template.id}.${field.id} 未映射到演示数据列`).toBeTruthy()
        expect(demo.headers).toContain(header)
        demo.rows.forEach((row, i) => {
          if (blanks.has(`${i}:${header}`)) return
          expect(
            row[header!],
            `${template.id}.${field.id} 在「${header}」列第 ${i} 行存在空值`,
          ).toBeTruthy()
        })
      }
    }
  })

  it('餐饮模板的主字段映射到数据集列而非模板示例合成列', () => {
    const reserved = defaultTemplates.find((t) => t.id === 'reservedTable')!
    expect(demoExcelFor(reserved).mapping['name']).toBe('宾客')
    const roomDoor = defaultTemplates.find((t) => t.id === 'privateRoomDoor')!
    expect(demoExcelFor(roomDoor).mapping['room']).toBe('包间名')
  })

  it('饮品杯贴映射到饮品专属列，逐行不同品名', () => {
    const drinkCup = defaultTemplates.find((t) => t.id === 'drinkCup')!
    const { mapping, rows } = demoExcelFor(drinkCup)
    expect(mapping['drink']).toBe('品名')
    expect(mapping['spec']).toBe('甜度冰量')
    expect(mapping['orderNo']).toBe('单号')
    expect(new Set(rows.map((r) => r['品名'])).size).toBe(rows.length)
  })

  it('电竞赛位牌映射到电竞专属列，逐行不同选手 ID', () => {
    const esportsSeat = defaultTemplates.find((t) => t.id === 'esportsSeat')!
    const { mapping, rows } = demoExcelFor(esportsSeat)
    expect(mapping['playerId']).toBe('选手 ID')
    expect(mapping['team']).toBe('战队')
    expect(mapping['role']).toBe('位置')
    expect(new Set(rows.map((r) => r['选手 ID'])).size).toBe(rows.length)
  })

  it('科技系电竞选手席映射到「战队位次」列', () => {
    const tech = defaultTemplates.find((t) => t.id === 'techEsportsSeat')!
    const { mapping, rows } = demoExcelFor(tech)
    expect(mapping['playerId']).toBe('选手 ID')
    expect(mapping['team']).toBe('战队位次')
    expect(new Set(rows.map((r) => r['选手 ID'])).size).toBe(rows.length)
  })

  describe('sampleExcelFor', () => {
    it('每款模板都能生成样例：表头与演示数据一致、行数限制、无空单元格', () => {
      for (const template of defaultTemplates) {
        const demo = demoExcelFor(template)
        const sample = sampleExcelFor(template)
        expect(sample.headers).toEqual(demo.headers)
        expect(sample.rows.length).toBeGreaterThanOrEqual(3)
        expect(sample.rows.length).toBeLessThanOrEqual(5)
        expect(sample.sheetName).toBe(demo.sheetName)
        expect(sample.fileName).toBe(`${demo.sheetName}样例.xlsx`)
        for (const row of sample.rows) {
          for (const h of sample.headers) {
            expect(row[h], `${template.id} 样例「${h}」列存在空值`).toBeTruthy()
          }
        }
      }
    })

    it('样例按模板场景区分：不同场景模板生成不同表头的样例', () => {
      const examTemplate = defaultTemplates.find((t) => resolveDemoDataset(t).id === 'exam')!
      const weddingTemplate = defaultTemplates.find((t) => resolveDemoDataset(t).id === 'wedding')!
      const examSample = sampleExcelFor(examTemplate)
      const weddingSample = sampleExcelFor(weddingTemplate)
      expect(examSample.headers).toContain('考场')
      expect(weddingSample.headers).toContain('桌号')
      expect(examSample.sheetName).not.toBe(weddingSample.sheetName)
    })

    it('样例行是副本：修改样例不影响演示数据集', () => {
      const template = defaultTemplates[0]!
      const sample = sampleExcelFor(template)
      const before = demoExcelFor(template).rows[0]![sample.headers[0]!]
      sample.rows[0]![sample.headers[0]!] = '篡改'
      expect(demoExcelFor(template).rows[0]![sample.headers[0]!]).toBe(before)
    })
  })
})
