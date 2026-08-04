<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import TemplateThumb from '@/components/label/TemplateThumb.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import { TEMPLATE_CATEGORIES } from '@/data/defaultTemplates'
import { useTemplateLibrary, isValidTemplate } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import type { LabelTemplate, TemplateCategory } from '@/types/template'
import { uid } from '@/utils/id'
import { copyToClipboard, encodeTemplateForShare, SHARE_HASH_PREFIX } from '@/utils/share'

const emit = defineEmits<{ openDesigner: [template: LabelTemplate | null] }>()

const workspace = useWorkspaceStore()
const library = useTemplateLibrary()
const toast = useToastStore()
const router = useRouter()

const importInput = ref<HTMLInputElement | null>(null)
const deleteTarget = ref<LabelTemplate | null>(null)

// ---------- 面板只露出少量模板，全部模板用弹窗浏览 ----------
const COLLAPSED_COUNT = 3

const visibleTemplates = computed<LabelTemplate[]>(() => {
  const all = library.allTemplates
  if (all.length <= COLLAPSED_COUNT) return all
  const head = all.slice(0, COLLAPSED_COUNT)
  if (head.some((t) => t.id === workspace.selectedTemplateId)) return head
  // 选中的模板不在前几位时，置顶展示，保证折叠状态下也能看到当前选择
  const selected = all.find((t) => t.id === workspace.selectedTemplateId)
  return selected ? [selected, ...head.slice(0, COLLAPSED_COUNT - 1)] : head
})

// ---------- 全部模板弹窗：按场景分类筛选 ----------
const pickerOpen = ref(false)

type CategoryFilter = TemplateCategory | 'all' | 'custom'
const activeCategory = ref<CategoryFilter>('all')

const categoryOptions = computed<{ id: CategoryFilter; name: string; count: number }[]>(() => {
  const all = library.allTemplates
  const options: { id: CategoryFilter; name: string; count: number }[] = [
    { id: 'all', name: '全部', count: all.length },
    ...TEMPLATE_CATEGORIES.map((c) => ({
      id: c.id as CategoryFilter,
      name: c.name,
      count: all.filter((t) => t.category === c.id).length,
    })),
  ]
  const customCount = all.filter((t) => !t.builtin).length
  if (customCount > 0) options.push({ id: 'custom', name: '自定义', count: customCount })
  return options.filter((o) => o.count > 0)
})

const filteredTemplates = computed<LabelTemplate[]>(() => {
  const all = library.allTemplates
  if (activeCategory.value === 'all') return all
  if (activeCategory.value === 'custom') return all.filter((t) => !t.builtin)
  return all.filter((t) => t.category === activeCategory.value)
})

function pickFromModal(t: LabelTemplate) {
  workspace.selectTemplate(t)
  pickerOpen.value = false
}

function openDesignerFromModal(t: LabelTemplate) {
  pickerOpen.value = false
  emit('openDesigner', t)
}

/** 链接长度超过该阈值时提示改用 JSON 文件分享（聊天工具对超长 URL 不友好） */
const SHARE_URL_LIMIT = 8000

async function shareCurrentTemplate() {
  try {
    const payload = await encodeTemplateForShare(workspace.template)
    const studioPath = router.resolve({ name: 'studio' }).href
    const url = `${location.origin}${studioPath}${SHARE_HASH_PREFIX}${payload}`
    if (url.length > SHARE_URL_LIMIT) {
      toast.warning(
        '模板体积过大，不适合用链接分享',
        '通常是包含了固定图片（Logo）。请改用「导出 JSON」分享文件。',
      )
      return
    }
    if (await copyToClipboard(url)) {
      toast.success('分享链接已复制', '对方打开链接即可导入该模板（数据不经过服务器）')
    } else {
      toast.danger('复制失败', '请改用「导出 JSON」分享文件')
    }
  } catch {
    toast.danger('生成分享链接失败', '请改用「导出 JSON」分享文件')
  }
}

function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed: unknown = JSON.parse(String(reader.result))
      if (!isValidTemplate(parsed)) {
        toast.danger('模板文件无效', '文件缺少 label、page 或 fields 字段')
        return
      }
      parsed.id = uid('custom')
      parsed.name = parsed.name || '导入的模板'
      const saved = library.saveAsCustom(parsed)
      workspace.selectTemplate(saved, { silent: true })
      toast.success('模板导入成功', saved.name)
    } catch {
      toast.danger('模板解析失败', '请确认导入的是有效的 JSON 模板文件')
    }
  }
  reader.readAsText(file)
}

function exportCurrentTemplate() {
  const json = JSON.stringify(workspace.template, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${workspace.template.name || 'template'}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('模板已导出', 'JSON 模板文件已开始下载')
}

function confirmDelete() {
  if (!deleteTarget.value) return
  const target = deleteTarget.value
  library.removeCustom(target.id)
  if (workspace.selectedTemplateId === target.id) {
    workspace.selectTemplate(library.allTemplates[0]!, { silent: true })
  }
  deleteTarget.value = null
  toast.info('自定义模板已删除', '如需保留，请先导出为 JSON')
}
</script>

<template>
  <section class="panel-card">
    <div class="panel-head">
      <h2 class="section-title"><span class="step-chip">1</span>选择模板</h2>
      <div class="flex gap-1.5">
        <button type="button" class="btn btn-ghost btn-sm" @click="importInput?.click()">
          导入 JSON
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="emit('openDesigner', null)">
          新建模板
        </button>
      </div>
    </div>
    <input
      ref="importInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onImportFile"
    />

    <div class="grid gap-3">
      <article
        v-for="t in visibleTemplates"
        :key="t.id"
        role="button"
        tabindex="0"
        class="relative cursor-pointer rounded-lg border-2 p-3 transition-all duration-150"
        :class="
          workspace.selectedTemplateId === t.id
            ? 'border-brand-500 bg-brand-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
        "
        @click="workspace.selectTemplate(t)"
        @keyup.enter="workspace.selectTemplate(t)"
      >
        <span
          v-if="workspace.selectedTemplateId === t.id"
          class="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white shadow"
        >
          <svg
            class="size-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        </span>
        <div class="flex gap-3">
          <div class="w-28 shrink-0 self-start">
            <TemplateThumb :template="t" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-900">{{ t.name }}</h3>
              <span
                v-if="!t.builtin"
                class="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
              >
                自定义
              </span>
            </div>
            <p class="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{{ t.description }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span>{{ t.label.width }} × {{ t.label.height }} mm</span>
              <span>{{ t.page.cols * t.page.rows }} 枚 / 页</span>
              <span v-if="t.scenario">{{ t.scenario }}</span>
            </div>
            <div class="mt-2 flex gap-1.5">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                @click.stop="emit('openDesigner', t)"
              >
                {{ t.builtin ? '以此为基础设计' : '编辑' }}
              </button>
              <button
                v-if="!t.builtin"
                type="button"
                class="btn btn-ghost btn-sm text-red-500 hover:bg-red-50 hover:text-red-600"
                @click.stop="deleteTarget = t"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <button
      v-if="library.allTemplates.length > visibleTemplates.length"
      type="button"
      class="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:border-brand-400 hover:text-brand-600"
      @click="pickerOpen = true"
    >
      浏览全部 {{ library.allTemplates.length }} 款模板
      <svg
        class="size-3.5"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />
      </svg>
    </button>

    <div class="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
      <button type="button" class="btn btn-secondary btn-sm" @click="shareCurrentTemplate">
        复制当前模板分享链接
      </button>
      <button type="button" class="btn btn-ghost btn-sm" @click="exportCurrentTemplate">
        导出 JSON
      </button>
    </div>

    <ModalDialog
      :open="pickerOpen"
      :title="`全部模板（${library.allTemplates.length} 款）`"
      size="xl"
      @close="pickerOpen = false"
    >
      <div class="sticky -top-1 z-10 -mx-1 mb-3 flex flex-wrap gap-1.5 bg-white/95 px-1 py-1.5 backdrop-blur">
        <button
          v-for="opt in categoryOptions"
          :key="opt.id"
          type="button"
          class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150"
          :class="
            activeCategory === opt.id
              ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600'
          "
          @click="activeCategory = opt.id"
        >
          {{ opt.name }}
          <span :class="activeCategory === opt.id ? 'text-brand-100' : 'text-slate-400'">
            {{ opt.count }}
          </span>
        </button>
      </div>
      <div class="columns-1 gap-3 sm:columns-2 lg:columns-3">
        <article
          v-for="t in filteredTemplates"
          :key="t.id"
          role="button"
          tabindex="0"
          class="relative mb-3 inline-block w-full cursor-pointer break-inside-avoid rounded-lg border-2 p-3 transition-all duration-150"
          :class="
            workspace.selectedTemplateId === t.id
              ? 'border-brand-500 bg-brand-50/60 shadow-sm'
              : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
          "
          @click="pickFromModal(t)"
          @keyup.enter="pickFromModal(t)"
        >
          <span
            v-if="workspace.selectedTemplateId === t.id"
            class="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white shadow"
          >
            <svg
              class="size-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          </span>
          <TemplateThumb :template="t" />
          <div class="mt-2 flex items-start justify-between gap-2">
            <h3 class="truncate text-sm font-bold text-slate-900">{{ t.name }}</h3>
            <span
              v-if="!t.builtin"
              class="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
            >
              自定义
            </span>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">
            {{ t.label.width }} × {{ t.label.height }} mm · {{ t.page.cols * t.page.rows }}
            枚/页<template v-if="t.scenario"> · {{ t.scenario }}</template>
          </p>
          <div class="mt-2 flex gap-1.5">
            <button type="button" class="btn btn-ghost btn-sm" @click.stop="openDesignerFromModal(t)">
              {{ t.builtin ? '以此为基础设计' : '编辑' }}
            </button>
            <button
              v-if="!t.builtin"
              type="button"
              class="btn btn-ghost btn-sm text-red-500 hover:bg-red-50 hover:text-red-600"
              @click.stop="deleteTarget = t"
            >
              删除
            </button>
          </div>
        </article>
      </div>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="pickerOpen = false">
          关闭
        </button>
      </template>
    </ModalDialog>

    <ModalDialog :open="!!deleteTarget" title="删除自定义模板" @close="deleteTarget = null">
      <p>
        确定删除模板
        <strong class="text-slate-800">“{{ deleteTarget?.name }}”</strong>
        吗？删除后无法恢复，如需保留可先导出为 JSON。
      </p>
      <template #actions>
        <button type="button" class="btn btn-secondary btn-md" @click="deleteTarget = null">
          取消
        </button>
        <button type="button" class="btn btn-danger btn-md" @click="confirmDelete">删除</button>
      </template>
    </ModalDialog>
  </section>
</template>
