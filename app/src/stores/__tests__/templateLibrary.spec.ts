import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultTemplates } from '@/data/defaultTemplates'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { cloneTemplate } from '@/utils/layout'

const STORAGE_KEY = 'seatmark.custom-templates.v1'
const LEGACY_STORAGE_KEY = 'seat-label-custom-templates'

function legacyTemplate() {
  const t = cloneTemplate(defaultTemplates[0]!)
  t.id = 'custom_legacy'
  t.name = '旧版自定义模板'
  return t
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useTemplateLibrary', () => {
  it('默认包含全部内置模板', () => {
    const library = useTemplateLibrary()
    expect(library.customTemplates).toHaveLength(0)
    expect(library.allTemplates.map((t) => t.id)).toEqual(defaultTemplates.map((t) => t.id))
  })

  it('自动迁移旧版 localStorage 中的自定义模板', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([legacyTemplate()]))
    const library = useTemplateLibrary()
    expect(library.customTemplates).toHaveLength(1)
    expect(library.customTemplates[0]!.name).toBe('旧版自定义模板')
    expect(library.customTemplates[0]!.builtin).toBe(false)
  })

  it('损坏或非法的存储内容被安全忽略', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(useTemplateLibrary().customTemplates).toHaveLength(0)
  })

  it('saveAsCustom 重新分配 id 并持久化', () => {
    const library = useTemplateLibrary()
    const saved = library.saveAsCustom(defaultTemplates[0]!, '我的模板')
    expect(saved.id).toMatch(/^custom_/)
    expect(saved.name).toBe('我的模板')
    expect(saved.builtin).toBe(false)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(persisted).toHaveLength(1)
    expect(persisted[0].id).toBe(saved.id)
  })

  it('updateCustom 覆盖同 id 模板，removeCustom 删除', () => {
    const library = useTemplateLibrary()
    const saved = library.saveAsCustom(defaultTemplates[0]!, '原名')

    const edited = cloneTemplate(saved)
    edited.name = '改名后'
    library.updateCustom(edited)
    expect(library.customTemplates).toHaveLength(1)
    expect(library.findById(saved.id)?.name).toBe('改名后')

    library.removeCustom(saved.id)
    expect(library.customTemplates).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(0)
  })

  it('保存前先同步最新存储：不覆写其他标签页写入的模板', () => {
    const library = useTemplateLibrary()

    // 模拟另一标签页在本页启动后直接写入 localStorage
    const other = cloneTemplate(defaultTemplates[0]!)
    other.id = 'custom_other_tab'
    other.name = '其他标签页的模板'
    localStorage.setItem(STORAGE_KEY, JSON.stringify([other]))

    const saved = library.saveAsCustom(defaultTemplates[0]!, '本页模板')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { id: string }[]
    expect(persisted.map((t) => t.id)).toEqual(['custom_other_tab', saved.id])
  })

  it('其他标签页删除后本页保存不会使被删模板复活', () => {
    const library = useTemplateLibrary()
    library.saveAsCustom(defaultTemplates[0]!, '将被删除')

    // 模拟另一标签页删除了全部自定义模板
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))

    const saved = library.saveAsCustom(defaultTemplates[0]!, '新模板')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { id: string }[]
    expect(persisted.map((t) => t.id)).toEqual([saved.id])
  })

  it('存储写入失败时提示用户而非静默丢失', () => {
    const library = useTemplateLibrary()
    const toast = useToastStore()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      library.saveAsCustom(defaultTemplates[0]!, '配额满')
      expect(toast.toasts.some((t) => t.type === 'danger' && t.title.includes('未能保存'))).toBe(
        true,
      )
    } finally {
      spy.mockRestore()
    }
  })
})
