<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useIsMobile } from '@/composables/useMediaQuery'

import TemplateDesigner from '@/components/designer/TemplateDesigner.vue'
import DataImportPanel from '@/components/studio/DataImportPanel.vue'
import FirstVisitGuide from '@/components/studio/FirstVisitGuide.vue'
import FitSuggestionBanner from '@/components/studio/FitSuggestionBanner.vue'
import LayoutPanel from '@/components/studio/LayoutPanel.vue'
import MappingPanel from '@/components/studio/MappingPanel.vue'
import PreviewArea from '@/components/studio/PreviewArea.vue'
import TemplatePickerPanel from '@/components/studio/TemplatePickerPanel.vue'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import { createBlankTemplate } from '@/data/defaultTemplates'
import { findLabelPaper } from '@/data/labelPapers'
import { useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { useWorkspaceStore } from '@/stores/workspace'
import type { LabelTemplate } from '@/types/template'
import { uid } from '@/utils/id'
import { cloneTemplate } from '@/utils/layout'
import { applyLabelPaper } from '@/utils/labelPaper'
import { takeSeatingHandoff } from '@/utils/seating'
import { decodeSharedTemplate, extractSharePayload } from '@/utils/share'

const route = useRoute()
const workspace = useWorkspaceStore()
const library = useTemplateLibrary()
const toast = useToastStore()

const isMobile = useIsMobile()
type MobileTab = 'settings' | 'preview'
const mobileTab = ref<MobileTab>('settings')

const MOBILE_TABS: { key: MobileTab; label: string; icon: string }[] = [
  {
    key: 'settings',
    label: '设置',
    icon: 'M4 6h16M4 12h16M4 18h10M9 4v4M15 10v4M11 16v4',
  },
  {
    key: 'preview',
    label: '预览',
    icon: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  },
]

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
  // 从纸型落地页进入：按纸型锁定排版
  if (typeof route.query.paper === 'string') {
    const spec = findLabelPaper(route.query.paper)
    if (spec) {
      applyLabelPaper(workspace.template, spec)
      toast.info('已按纸型锁定排版', `${spec.name}：每页 ${spec.cols * spec.rows} 枚`)
    }
  }
  // 从教室座位表一键带入同一份名单
  if (route.query.from === 'seating') {
    const handoff = takeSeatingHandoff()
    if (handoff) {
      workspace.applyDataset(
        `${handoff.title || '教室座位表'}.名单`,
        Object.keys(handoff.rows[0]!),
        handoff.rows,
      )
      toast.success('座位表名单已带入', `共 ${handoff.rows.length} 人，选好模板即可批量生成桌贴`)
    }
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
    <h1 class="sr-only">SeatMark 座签工坊：批量生成桌牌 / 座签 / 席位卡</h1>
    <!-- 移动端分段切换：跟随页面吸顶，随时在设置与预览之间翻面 -->
    <div v-if="isMobile" class="sticky top-14 z-30 -mx-4 mb-3 bg-slate-50/90 px-4 py-2 backdrop-blur">
      <div class="flex rounded-lg border border-slate-200 bg-white p-1 shadow-card">
        <button
          v-for="tab in MOBILE_TABS"
          :key="tab.key"
          type="button"
          class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors duration-150"
          :class="
            mobileTab === tab.key
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          "
          @click="mobileTab = tab.key"
        >
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path :d="tab.icon" />
          </svg>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 单列时轨道同样限宽 minmax(0,1fr)：预览区固定像素宽的纸张内容（如 100% 缩放）在容器内部滚动，不撑宽页面 -->
    <div class="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <!-- min-w-0 + flex 纵排：防止宽表格把侧栏撑出 400px 网格轨道、压到预览区 -->
      <aside
        class="no-print flex min-w-0 flex-col gap-4"
        :class="isMobile && mobileTab !== 'settings' ? 'hidden' : ''"
      >
        <FirstVisitGuide />
        <FitSuggestionBanner />
        <TemplatePickerPanel @open-designer="openDesigner" />
        <DataImportPanel />
        <MappingPanel v-if="workspace.excel.rows.length" />
        <LayoutPanel @open-designer="openDesigner" />
      </aside>

      <div
        :class="[
          isMobile && mobileTab !== 'preview' ? 'hidden' : '',
          'min-w-0 lg:sticky lg:top-[72px] lg:h-[calc(100vh-92px)]',
          isMobile ? 'h-[calc(100vh-180px)]' : '',
        ]"
      >
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
      <p class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
        SeatMark 座签是免费的在线批量制签工具：上传 Excel 名单即可批量生成座位标签 / 桌牌席卡，排版精确到毫米。选「保存并应用」即可一键开始，名单数据全程只在你的浏览器本地处理。
      </p>
      <p class="mt-2 text-xs text-slate-600">
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
