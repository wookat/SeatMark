<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import TemplateDesigner from '@/components/designer/TemplateDesigner.vue'
import DataImportPanel from '@/components/studio/DataImportPanel.vue'
import LayoutPanel from '@/components/studio/LayoutPanel.vue'
import MappingPanel from '@/components/studio/MappingPanel.vue'
import PreviewArea from '@/components/studio/PreviewArea.vue'
import TemplatePickerPanel from '@/components/studio/TemplatePickerPanel.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import { createBlankTemplate } from '@/data/defaultTemplates'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import type { LabelTemplate } from '@/types/template'
import { uid } from '@/utils/id'
import { cloneTemplate } from '@/utils/layout'
import { decodeSharedTemplate, extractSharePayload } from '@/utils/share'

const route = useRoute()
const workspace = useWorkspaceStore()
const library = useTemplateLibrary()
const toast = useToastStore()

const designerOpen = ref(false)
const designerTemplate = ref<LabelTemplate | null>(null)

function openDesigner(template: LabelTemplate | null) {
  designerTemplate.value = template ? cloneTemplate(template) : createBlankTemplate()
  designerOpen.value = true
}

function onDesignerSave(template: LabelTemplate, asNew: boolean) {
  const saved =
    !asNew && library.isCustom(template.id)
      ? library.updateCustom(template)
      : library.saveAsCustom(template)
  workspace.selectTemplate(saved, { silent: true })
  designerOpen.value = false
  toast.success('模板已保存', `「${saved.name}」已加入我的模板并应用`)
}

// ---------- 分享链接接收 ----------
const sharedTemplate = ref<LabelTemplate | null>(null)

function clearShareHash() {
  history.replaceState(history.state, '', location.pathname + location.search)
}

async function handleShareHash() {
  const payload = extractSharePayload(location.hash)
  if (!payload) return
  const decoded = await decodeSharedTemplate(payload)
  clearShareHash()
  if (!decoded) {
    toast.danger('分享链接无效', '链接可能不完整或已损坏，请让对方重新生成')
    return
  }
  sharedTemplate.value = decoded
}

function useSharedOnce() {
  if (!sharedTemplate.value) return
  const temp = cloneTemplate(sharedTemplate.value)
  temp.id = uid('shared')
  workspace.selectTemplate(temp, { silent: true })
  sharedTemplate.value = null
  toast.success('已应用分享模板', '仅本次使用，未保存到我的模板')
}

function saveShared() {
  if (!sharedTemplate.value) return
  const saved = library.saveAsCustom(sharedTemplate.value)
  workspace.selectTemplate(saved, { silent: true })
  sharedTemplate.value = null
  toast.success('模板已保存', `「${saved.name}」已加入我的模板并应用`)
}

onMounted(() => {
  const templateId = route.query.template
  if (typeof templateId === 'string') {
    const found = library.findById(templateId)
    if (found) workspace.selectTemplate(found, { silent: true })
  }
  if (route.query.demo === '1' && !workspace.excel.rows.length) {
    workspace.useDemoData()
  }
  // 从主页「从空白新建模板」进入时直接打开设计器
  if (route.query.design === 'new') {
    openDesigner(null)
  }
  void handleShareHash()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] px-4 py-5">
    <div class="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside class="no-print grid gap-4">
        <TemplatePickerPanel @open-designer="openDesigner" />
        <DataImportPanel />
        <MappingPanel v-if="workspace.excel.rows.length" />
        <LayoutPanel @open-designer="openDesigner" />
      </aside>

      <div class="lg:sticky lg:top-[72px] lg:h-[calc(100vh-92px)]">
        <PreviewArea />
      </div>
    </div>

    <TemplateDesigner
      v-if="designerOpen && designerTemplate"
      :initial="designerTemplate"
      @close="designerOpen = false"
      @save="onDesignerSave"
    />

    <ModalDialog
      :open="!!sharedTemplate"
      title="收到一个分享模板"
      @close="sharedTemplate = null"
    >
      <p>
        对方分享了模板
        <strong class="text-slate-800">“{{ sharedTemplate?.name }}”</strong>
        （{{ sharedTemplate?.label.width }} × {{ sharedTemplate?.label.height }} mm，
        {{ (sharedTemplate?.page.cols ?? 0) * (sharedTemplate?.page.rows ?? 0) }} 枚/页，
        {{ sharedTemplate?.fields.length }} 个字段）。
      </p>
      <p class="mt-2 text-xs text-slate-400">
        模板完全由链接本身携带，没有经过任何服务器。
      </p>
      <template #actions>
        <button type="button" class="btn btn-ghost btn-md" @click="sharedTemplate = null">
          忽略
        </button>
        <button type="button" class="btn btn-secondary btn-md" @click="useSharedOnce">
          仅本次使用
        </button>
        <button type="button" class="btn btn-primary btn-md" @click="saveShared">
          保存并应用
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
