import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { defaultTemplates } from '@/data/defaultTemplates'
import type { LabelTemplate } from '@/types/template'
import { uid } from '@/utils/id'
import { cloneTemplate } from '@/utils/layout'

const STORAGE_KEY = 'seatmark.custom-templates.v1'
/** 旧版（seat-label-generator）的存储键，首次启动时自动迁移 */
const LEGACY_STORAGE_KEY = 'seat-label-custom-templates'

export function isValidTemplate(value: unknown): value is LabelTemplate {
  if (!value || typeof value !== 'object') return false
  const t = value as Partial<LabelTemplate>
  return Boolean(t.label && t.page && Array.isArray(t.fields))
}

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
  const customTemplates = ref<LabelTemplate[]>(loadFromStorage())

  const allTemplates = computed<LabelTemplate[]>(() => [
    ...defaultTemplates,
    ...customTemplates.value,
  ])

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates.value))
    } catch {
      // 存储满 / 隐私模式下静默失败，模板仍保留在内存中
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
    customTemplates.value.push(copy)
    persist()
    return copy
  }

  /** 覆盖已有的自定义模板；若不存在则按新模板保存 */
  function updateCustom(template: LabelTemplate): LabelTemplate {
    const idx = customTemplates.value.findIndex((t) => t.id === template.id)
    if (idx === -1) return saveAsCustom(template)
    const copy = cloneTemplate(template)
    copy.builtin = false
    customTemplates.value[idx] = copy
    persist()
    return copy
  }

  function removeCustom(id: string) {
    customTemplates.value = customTemplates.value.filter((t) => t.id !== id)
    persist()
  }

  /** 从云端找回：按 id 升级合并（保留云端 id，避免反复找回产生重复），返回新增数量 */
  function importTemplates(templates: LabelTemplate[]): number {
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
    allTemplates,
    findById,
    saveAsCustom,
    updateCustom,
    removeCustom,
    importTemplates,
    isCustom,
  }
})
