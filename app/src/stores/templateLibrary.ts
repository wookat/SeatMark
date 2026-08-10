import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { defaultTemplates } from '@/data/defaultTemplates'
import { useToastStore } from '@/stores/toast'
import type { LabelTemplate } from '@/types/template'
import { uid } from '@/utils/id'
import { isValidTemplate } from '@/utils/templateValidate'
import { cloneTemplate } from '@/utils/layout'

const STORAGE_KEY = 'seatmark.custom-templates.v1'
/** 旧版（seat-label-generator）的存储键，首次启动时自动迁移 */
const LEGACY_STORAGE_KEY = 'seat-label-custom-templates'

export { isValidTemplate }

function loadFromStorage(): LabelTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidTemplate).map((t) => ({ ...t, builtin: false }))
  } catch {
    return []
  }
}

export const useTemplateLibrary = defineStore('templateLibrary', () => {
  const toast = useToastStore()
  const customTemplates = ref<LabelTemplate[]>(loadFromStorage())
  /** 最近一次写入是否成功落盘（存储满时为 false，调用方据此决定是否弹成功提示） */
  const lastPersistOk = ref(true)

  // 其他标签页写入后同步内存，避免本页后续保存用陈旧数组整体覆写
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === null) customTemplates.value = loadFromStorage()
    })
  }

  const allTemplates = computed<LabelTemplate[]>(() => [
    ...defaultTemplates,
    ...customTemplates.value,
  ])

  /** 写入前先取最新存储作为基底：本页只应用自己的增删改，不覆写其他标签页的写入 */
  function syncFromStorage() {
    customTemplates.value = loadFromStorage()
  }

  function persist(): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates.value))
      lastPersistOk.value = true
      return true
    } catch {
      lastPersistOk.value = false
      // 存储满 / 隐私模式：模板仍保留在内存中，但需明确告知用户未持久化
      toast.danger(
        '模板未能保存到本设备',
        '浏览器本地存储空间已满或不可用，刷新后此模板将丢失。可删除部分自定义模板后重试',
      )
      return false
    }
  }

  function findById(id: string): LabelTemplate | undefined {
    return allTemplates.value.find((t) => t.id === id)
  }

  /** 保存为新的自定义模板，返回持久化后的副本 */
  function saveAsCustom(template: LabelTemplate, name?: string): LabelTemplate {
    const copy = cloneTemplate(template)
    copy.id = uid('custom')
    copy.builtin = false
    if (name) copy.name = name
    copy.description = copy.description || '自定义模板'
    syncFromStorage()
    customTemplates.value.push(copy)
    persist()
    return copy
  }

  /** 覆盖已有的自定义模板；若不存在则按新模板保存 */
  function updateCustom(template: LabelTemplate): LabelTemplate {
    syncFromStorage()
    const idx = customTemplates.value.findIndex((t) => t.id === template.id)
    if (idx === -1) return saveAsCustom(template)
    const copy = cloneTemplate(template)
    copy.builtin = false
    customTemplates.value[idx] = copy
    persist()
    return copy
  }

  function removeCustom(id: string) {
    syncFromStorage()
    customTemplates.value = customTemplates.value.filter((t) => t.id !== id)
    persist()
  }

  /** 从云端找回：按 id 升级合并（保留云端 id，避免反复找回产生重复），返回新增数量 */
  function importTemplates(templates: LabelTemplate[]): number {
    syncFromStorage()
    let added = 0
    for (const template of templates) {
      const copy = { ...cloneTemplate(template), builtin: false }
      const idx = customTemplates.value.findIndex((t) => t.id === copy.id)
      if (idx === -1) {
        customTemplates.value.push(copy)
        added += 1
      } else {
        customTemplates.value[idx] = copy
      }
    }
    persist()
    return added
  }

  function isCustom(id: string): boolean {
    return customTemplates.value.some((t) => t.id === id)
  }

  return {
    customTemplates,
    lastPersistOk,
    allTemplates,
    findById,
    saveAsCustom,
    updateCustom,
    removeCustom,
    importTemplates,
    isCustom,
  }
})
