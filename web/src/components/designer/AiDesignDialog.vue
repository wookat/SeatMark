<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import type { AiDesignResult } from '@/utils/aiDesign'
import { generateLabelDesign, loadAiConfig, parseFieldLines, saveAiConfig } from '@/utils/aiDesign'
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

const DEFAULT_FIELDS_TEXT = '座位号: 12\n姓名: 张三\n考场: 第1考场\n准考证号: 2026061001'

const config = ref(loadAiConfig())
const hasCustomConfig = computed(
  () => !!(config.value.baseUrl.trim() && config.value.apiKey.trim() && config.value.model.trim()),
)

const fieldsText = ref('')
const requirements = ref('')
const width = ref(props.labelWidth)
const height = ref(props.labelHeight)

const generating = ref(false)
const errorMsg = ref('')
let aborter: AbortController | null = null

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
    if (!fieldsText.value.trim()) {
      fieldsText.value = props.prefill?.trim() ? props.prefill : DEFAULT_FIELDS_TEXT
    }
  },
)

async function generate() {
  if (generating.value) return
  errorMsg.value = ''

  const fields = parseFieldLines(fieldsText.value)
  if (!fields.length) {
    errorMsg.value = '请至少填写一个字段，每行一条，格式「字段名: 示例值」'
    return
  }
  if (config.value.provider === 'custom' && !hasCustomConfig.value) {
    errorMsg.value = '请先填写 API 接口地址、密钥与模型名称，或切换回「免费通道」'
    return
  }
  saveAiConfig({
    provider: config.value.provider,
    baseUrl: config.value.baseUrl.trim(),
    apiKey: config.value.apiKey.trim(),
    model: config.value.model.trim(),
  })

  const w = clamp(Number(width.value) || props.labelWidth, 10, 420)
  const h = clamp(Number(height.value) || props.labelHeight, 10, 420)
  width.value = w
  height.value = h

  generating.value = true
  aborter = new AbortController()
  try {
    const result = await generateLabelDesign(
      config.value,
      { fields, requirements: requirements.value.trim(), labelWidth: w, labelHeight: h },
      aborter.signal,
    )
    emit('apply', { width: w, height: h, result })
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      errorMsg.value = err instanceof Error ? err.message : 'AI 生成失败，请稍后重试'
    }
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <ModalDialog :open="open" title="AI 自动设计标签" size="lg" @close="emit('close')">
    <div class="grid gap-4">
      <p class="text-xs leading-5 text-slate-500">
        填写字段与示例数据，AI 将在指定尺寸内完成一版标签排版，生成后可在画布上继续手动微调。
        默认免费通道开箱即用，无需注册或配置任何密钥。
      </p>

      <div>
        <label class="field-label">字段与示例数据（每行一条「字段名: 示例值」，多个示例用 | 分隔）</label>
        <textarea
          v-model="fieldsText"
          rows="6"
          class="input-field text-xs leading-5"
          placeholder="座位号: 12 | 8
姓名: 张三 | 欧阳娜娜
考场: 第1考场
准考证号: 2026061001
照片:"
        ></textarea>
        <p class="mt-1 text-[11px] text-slate-400">字段名含「照片 / 头像」会生成图片占位框</p>
      </div>

      <div>
        <label class="field-label">设计要求（可选）</label>
        <textarea
          v-model="requirements"
          rows="3"
          class="input-field text-xs leading-5"
          placeholder="例如：正式考务风格，重点突出座位号；底部加一行「请对号入座」提示语；主色用深蓝。"
        ></textarea>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="field-label">标签宽 (mm)</label>
          <input v-model.number="width" type="number" min="10" max="420" class="input-field" />
        </div>
        <div>
          <label class="field-label">标签高 (mm)</label>
          <input v-model.number="height" type="number" min="10" max="420" class="input-field" />
        </div>
      </div>

      <div>
        <label class="field-label">生成通道</label>
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            class="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold transition-colors duration-150"
            :class="
              config.provider === 'free'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="config.provider = 'free'"
          >
            免费通道 · 无需配置
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold transition-colors duration-150"
            :class="
              config.provider === 'custom'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="config.provider = 'custom'"
          >
            自定义 API
          </button>
        </div>

        <p v-if="config.provider === 'free'" class="mt-2 text-[11px] leading-4 text-slate-400">
          使用公共免费模型服务（站点内置通道 / Pollinations 匿名接口）自动生成，
          仅发送字段名与示例值，不上传完整名单；高峰期偶尔繁忙，失败可重试或切换「自定义 API」。
        </p>

        <div v-else class="mt-2 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <label class="field-label">接口地址 Base URL</label>
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
              <label class="field-label">模型</label>
              <input
                v-model="config.model"
                type="text"
                class="input-field"
                placeholder="glm-4-flash"
              />
            </div>
          </div>
          <p class="text-[11px] leading-4 text-slate-400">
            兼容所有 OpenAI 格式接口（智谱 / DeepSeek / 通义 / Kimi / OpenRouter 等）；
            密钥仅存于本机浏览器，不会上传到任何服务器。
          </p>
          <p class="text-[11px] leading-4 text-slate-400">
            免费接口推荐：智谱
            <code class="rounded bg-slate-100 px-1 text-slate-600">open.bigmodel.cn/api/paas/v4</code>
            的 glm-4-flash 永久免费；硅基流动
            <code class="rounded bg-slate-100 px-1 text-slate-600">api.siliconflow.cn/v1</code>；
            OpenRouter
            <code class="rounded bg-slate-100 px-1 text-slate-600">openrouter.ai/api/v1</code>
            （模型名带 :free，每天 50 次）。
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
      <button type="button" class="btn btn-ghost btn-md" @click="emit('close')">取消</button>
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
          <path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
        </svg>
        {{ generating ? '正在生成…' : '生成设计' }}
      </button>
    </template>
  </ModalDialog>
</template>
