<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { t } from '@/i18n'
import ModalDialog from '@/components/ui/ModalDialog.vue'
import type { AiDesignResult } from '@/utils/aiDesign'
import {
  aiByokPreset,
  generateLabelDesign,
  loadAiConfig,
  parseFieldLines,
  saveAiConfig,
} from '@/utils/aiDesign'
import { clamp } from '@/utils/layout'

const props = defineProps<{
  open: boolean
  /** 当前画布尺寸，作为默认标签尺寸 */
  labelWidth: number
  labelHeight: number
  /** 预填的字段示例文本（每行「字段名: 示例」） */
  prefill?: string
}>()

const emit = defineEmits<{
  close: []
  apply: [payload: { width: number; height: number; result: AiDesignResult }]
}>()

const SIZE_PRESETS = [
  { label: '考场桌签', w: 90, h: 28 },
  { label: '桌牌席位卡', w: 99.1, h: 67.7 },
  { label: '大字桌贴', w: 105, h: 74.25 },
  { label: '胸卡证卡', w: 90, h: 54 },
  { label: '门贴 A5', w: 210, h: 148.5 },
  { label: '门贴 A6', w: 105, h: 148.5 },
] as const

const ORIENTATION_OPTIONS = [
  { value: 'auto', label: '自适应' },
  { value: 'horizontal', label: '横排' },
  { value: 'vertical', label: '竖排' },
] as const

const STYLE_OPTIONS = [
  { value: 'auto', label: '自适应' },
  { value: 'formal', label: '正式克制' },
  { value: 'minimal', label: '简约现代' },
  { value: 'playful', label: '活泼明快' },
  { value: 'classic', label: '传统典雅' },
  { value: 'business', label: '商务专业' },
] as const

const BACKGROUND_OPTIONS = [
  { value: 'auto', label: '自适应' },
  { value: 'white', label: '纯白' },
  { value: 'light-gray', label: '浅灰' },
  { value: 'tint', label: '主色底纹' },
] as const

const config = ref(loadAiConfig())

const fieldsText = ref('')
const requirements = ref('')
const width = ref(props.labelWidth)
const height = ref(props.labelHeight)

const orientation = ref<'auto' | 'horizontal' | 'vertical'>('auto')
const style = ref<'auto' | 'formal' | 'minimal' | 'playful' | 'classic' | 'business'>('auto')
const background = ref<'auto' | 'white' | 'light-gray' | 'tint'>('auto')
const accentColor = ref('#1d4ed8')
const decoBorder = ref(false)
const decoDivider = ref(false)
const decoFooter = ref(false)

const generating = ref(false)
const errorMsg = ref('')
let aborter: AbortController | null = null

const activePreset = computed(() => aiByokPreset(config.value.provider))

/** 站点提供的具名模型（GET /api/ai-design 返回已配置上游清单；获取失败则为空，仅显示自适应） */
const siteModels = ref<Array<{ id: string; label: string }>>([])

/** 具名站点模型的显示名（可 i18n 的走 t()，其余用服务端 label） */
function siteModelLabel(m: { id: string; label: string }): string {
  if (m.id === 'eomodels') return t('EO 内置模型')
  return m.label
}

const isSiteServed = computed(
  () => config.value.provider === 'auto' || config.value.provider.startsWith('site:'),
)

/** 当前选中 BYOK 预设的密钥/模型条目（不存在时创建并持久化到 config） */
function byokEntry(id: string) {
  if (!config.value.byok[id]) config.value.byok[id] = { apiKey: '', model: '' }
  return config.value.byok[id]
}

const configValid = computed(() => {
  const p = config.value.provider
  if (p === 'auto' || p.startsWith('site:')) return true
  if (p === 'custom') {
    return !!(config.value.baseUrl.trim() && config.value.apiKey.trim() && config.value.model.trim())
  }
  const preset = aiByokPreset(p)
  return !!preset && !!byokEntry(preset.id).apiKey.trim()
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      aborter?.abort()
      generating.value = false
      return
    }
    errorMsg.value = ''
    width.value = props.labelWidth
    height.value = props.labelHeight
    fetch('/api/ai-design')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        siteModels.value = Array.isArray(d?.models) ? d.models : []
      })
      .catch(() => {
        siteModels.value = []
      })
    if (!fieldsText.value.trim()) {
      fieldsText.value = props.prefill?.trim()
        ? props.prefill
        : t('座位号: 12\n姓名: 张三\n考场: 第1考场\n准考证号: 2026061001')
    }
  },
)

async function generate() {
  if (generating.value) return
  errorMsg.value = ''

  const fields = parseFieldLines(fieldsText.value)
  if (!fields.length) {
    errorMsg.value = t('请至少填写一个字段，每行一条，格式「字段名: 示例值」')
    return
  }
  if (!configValid.value) {
    errorMsg.value =
      config.value.provider === 'custom'
        ? t('请先填写 API 接口地址、密钥与模型名称')
        : t('请先填写所选模型的 API Key（模型名留空时使用默认）')
    return
  }
  saveAiConfig(config.value)

  const w = clamp(Number(width.value) || props.labelWidth, 10, 420)
  const h = clamp(Number(height.value) || props.labelHeight, 10, 420)
  width.value = w
  height.value = h

  generating.value = true
  aborter = new AbortController()
  try {
    const result = await generateLabelDesign(
      config.value,
      {
        fields,
        requirements: requirements.value.trim(),
        labelWidth: w,
        labelHeight: h,
        options: {
          orientation: orientation.value,
          style: style.value,
          background: background.value,
          accentColor: accentColor.value,
          border: decoBorder.value,
          divider: decoDivider.value,
          footerNote: decoFooter.value,
        },
      },
      aborter.signal,
    )
    emit('apply', { width: w, height: h, result })
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      errorMsg.value = err instanceof Error ? err.message : t('AI 生成失败，请稍后重试')
    }
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <ModalDialog :open="open" :title="t('AI 自动设计标签')" size="lg" @close="emit('close')">
    <div class="grid gap-4">
      <p class="text-xs leading-5 text-slate-600" data-testid="ai-design-intro">
        {{ t('填写字段与示例数据，选择合适的尺寸与版式偏好，AI 将完成一版标签排版；生成后可在画布上继续手动微调。') }}
      </p>

      <div>
        <label class="field-label">{{ t('字段与示例数据（每行一条「字段名: 示例值」，多个示例用 | 分隔）') }}</label>
        <textarea
          v-model="fieldsText"
          rows="6"
          class="input-field text-xs leading-5"
          :placeholder="t('座位号: 12 | 8\n姓名: 张三 | 欧阳娜娜\n考场: 第1考场\n准考证号: 2026061001\n照片:')"
        ></textarea>
        <p class="mt-1 text-[11px] text-slate-600">{{ t('字段名含「照片 / 头像」会生成图片占位框') }}</p>
        <p class="mt-0.5 text-[11px] text-slate-500" data-testid="ai-design-privacy-hint">
          {{ t('示例值会发送给 AI 服务，请用虚构内容，不要填真实姓名/证件号') }}
        </p>
      </div>

      <div>
        <label class="field-label">{{ t('标签尺寸') }}</label>
        <div class="mb-2 flex flex-wrap gap-1.5">
          <button
            v-for="p in SIZE_PRESETS"
            :key="p.label"
            type="button"
            class="cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors duration-150"
            :class="
              Number(width) === p.w && Number(height) === p.h
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-700'
            "
            @click="((width = p.w), (height = p.h))"
          >
            {{ t(p.label) }} {{ p.w }}×{{ p.h }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="field-label">{{ t('标签宽 (mm)') }}</label>
            <input v-model.number="width" type="number" min="10" max="420" class="input-field" />
          </div>
          <div>
            <label class="field-label">{{ t('标签高 (mm)') }}</label>
            <input v-model.number="height" type="number" min="10" max="420" class="input-field" />
          </div>
        </div>
      </div>

      <div>
        <label class="field-label">{{ t('版式偏好（均可选，默认由 AI 自适应）') }}</label>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="field-label">{{ t('排列方向') }}</label>
            <select v-model="orientation" class="input-field">
              <option v-for="o in ORIENTATION_OPTIONS" :key="o.value" :value="o.value">
                {{ t(o.label) }}
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">{{ t('整体风格') }}</label>
            <select v-model="style" class="input-field">
              <option v-for="o in STYLE_OPTIONS" :key="o.value" :value="o.value">
                {{ t(o.label) }}
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">{{ t('背景') }}</label>
            <select v-model="background" class="input-field">
              <option v-for="o in BACKGROUND_OPTIONS" :key="o.value" :value="o.value">
                {{ t(o.label) }}
              </option>
            </select>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input v-model="decoBorder" type="checkbox" class="accent-brand-600" />
            {{ t('细边框') }}
          </label>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input v-model="decoDivider" type="checkbox" class="accent-brand-600" />
            {{ t('分隔线') }}
          </label>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input v-model="decoFooter" type="checkbox" class="accent-brand-600" />
            {{ t('底部提示语') }}
          </label>
          <label
            v-if="background === 'tint'"
            class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600"
          >
            {{ t('主色') }}
            <input
              v-model="accentColor"
              type="color"
              class="h-5 w-7 cursor-pointer rounded border border-slate-200 p-0"
            />
          </label>
        </div>
      </div>

      <div>
        <label class="field-label">{{ t('其他要求（可选）') }}</label>
        <textarea
          v-model="requirements"
          rows="2"
          class="input-field text-xs leading-5"
          :placeholder="t('补充字段布局、颜色或文案细节，例如：座位号放最大；底部加一行「请对号入座」。')"
        ></textarea>
      </div>

      <div>
        <label class="field-label">{{ t('生成模型') }}</label>
        <select v-model="config.provider" class="input-field" data-testid="ai-model-select">
          <option value="auto">{{ t('自适应 · 站点推荐（无需配置）') }}</option>
          <optgroup v-if="siteModels.length" :label="t('站点提供（无需配置）')">
            <option v-for="m in siteModels" :key="m.id" :value="`site:${m.id}`">
              {{ siteModelLabel(m) }}
            </option>
          </optgroup>
          <!-- BYOK 组不再对新用户展示；仅当历史配置选中了某预设时渲染该项，保证旧选择可用 -->
          <optgroup v-if="activePreset" :label="t('免费模型（需自己的 API Key）')">
            <option :value="activePreset.id">
              {{ t(activePreset.name) }} · {{ t(activePreset.freeNote) }}
            </option>
          </optgroup>
          <option value="custom">{{ t('自定义 OpenAI 兼容接口…') }}</option>
        </select>

        <p v-if="isSiteServed" class="mt-2 text-[11px] leading-4 text-slate-600">
          {{ t('仅经本站同源代理调用，浏览器不直连第三方；仅发送字段名与示例值，不上传完整名单。繁忙时可能失败，可稍后重试或改选其他模型。') }}
        </p>

        <div
          v-else-if="activePreset"
          class="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
        >
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="field-label">API Key</label>
              <input
                v-model="byokEntry(activePreset.id).apiKey"
                type="password"
                class="input-field"
                placeholder="sk-..."
                autocomplete="off"
              />
            </div>
            <div>
              <label class="field-label">{{ t('模型') }}</label>
              <input
                v-model="byokEntry(activePreset.id).model"
                type="text"
                class="input-field"
                :placeholder="activePreset.defaultModel"
              />
            </div>
          </div>
          <p class="text-[11px] leading-4 text-slate-600">
            {{ t('免费口径以服务商官方为准；密钥仅存本机浏览器，请求由浏览器直连服务商，不经过本站服务器。') }}
            <a
              :href="activePreset.keyHelpUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-brand-600 underline underline-offset-2"
              >{{ t('获取 API Key ↗') }}</a
            >
          </p>
        </div>

        <div v-else class="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <label class="field-label">{{ t('接口地址 Base URL') }}</label>
            <input
              v-model="config.baseUrl"
              type="text"
              class="input-field"
              placeholder="https://open.bigmodel.cn/api/paas/v4"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="field-label">API Key</label>
              <input
                v-model="config.apiKey"
                type="password"
                class="input-field"
                placeholder="sk-..."
                autocomplete="off"
              />
            </div>
            <div>
              <label class="field-label">{{ t('模型') }}</label>
              <input
                v-model="config.model"
                type="text"
                class="input-field"
                placeholder="glm-4-flash"
              />
            </div>
          </div>
          <p class="text-[11px] leading-4 text-slate-600">
            {{ t('兼容所有 OpenAI 格式接口（智谱 / DeepSeek / 通义 / Kimi / OpenRouter 等）；密钥仅存于本机浏览器，不会上传到任何服务器。') }}
          </p>
        </div>
      </div>

      <p
        v-if="errorMsg"
        class="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-5 text-red-700"
      >
        {{ errorMsg }}
      </p>
    </div>

    <template #actions>
      <button type="button" class="btn btn-ghost btn-md" @click="emit('close')">{{ t('取消') }}</button>
      <button type="button" class="btn btn-primary btn-md" :disabled="generating" @click="generate">
        <svg
          v-if="generating"
          class="size-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
        <svg
          v-else
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
          <path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3.9-2.3z" />
        </svg>
        {{ generating ? t('正在生成…') : t('生成设计') }}
      </button>
    </template>
  </ModalDialog>
</template>
