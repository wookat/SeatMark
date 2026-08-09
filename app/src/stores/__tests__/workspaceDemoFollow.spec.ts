/**
 * 切换模板时演示名单跟随场景：会话内载入的演示数据在切到不同场景模板时
 * 自动换成对应数据集（婚宴名单不带进考场模板）；用户导入的名单保持不动。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWorkspaceStore } from '@/stores/workspace'
import { defaultTemplates } from '@/data/defaultTemplates'
import { demoExcelFor } from '@/data/demoDatasets'

const templateById = (id: string) => {
  const found = defaultTemplates.find((t) => t.id === id)
  if (!found) throw new Error(`模板不存在：${id}`)
  return found
}

describe('workspace 切换模板演示名单跟随场景', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('演示数据跨场景切换模板时换用新模板对应数据集', () => {
    const workspace = useWorkspaceStore()
    const wedding = templateById('weddingPlace')
    workspace.selectTemplate(wedding, { silent: true })
    workspace.useDemoData()
    const weddingSheet = demoExcelFor(wedding).sheetName
    expect(workspace.excel.sheetName).toBe(weddingSheet)

    const exam = templateById('standard')
    workspace.selectTemplate(exam, { silent: true })
    const examSheet = demoExcelFor(workspace.template).sheetName
    expect(examSheet).not.toBe(weddingSheet)
    expect(workspace.excel.sheetName).toBe(examSheet)
    expect(workspace.isDemoData).toBe(true)
    expect(workspace.excel.rows.length).toBeGreaterThan(0)
  })

  it('同场景切换模板时演示数据不重载', () => {
    const workspace = useWorkspaceStore()
    const wedding = templateById('weddingPlace')
    workspace.selectTemplate(wedding, { silent: true })
    workspace.useDemoData()
    const rowsBefore = workspace.excel.rows

    const sameScene = defaultTemplates.find(
      (t) => t.id !== wedding.id && demoExcelFor(t).sheetName === demoExcelFor(wedding).sheetName,
    )
    expect(sameScene).toBeTruthy()
    workspace.selectTemplate(sameScene!, { silent: true })
    expect(workspace.excel.rows).toBe(rowsBefore)
  })

  it('用户导入的名单跨场景切换模板不被替换', () => {
    const workspace = useWorkspaceStore()
    workspace.selectTemplate(templateById('weddingPlace'), { silent: true })
    workspace.applyDataset('自定义名单.xlsx', ['姓名'], [{ 姓名: '张三' }])

    workspace.selectTemplate(templateById('standard'), { silent: true })
    expect(workspace.excel.fileName).toBe('自定义名单.xlsx')
    expect(workspace.excel.rows).toEqual([{ 姓名: '张三' }])
    expect(workspace.isDemoData).toBe(false)
  })
})
