<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { findFontByStack, fontStackOf, WEB_FONTS, type FontLang, type WebFont } from '@/data/fonts'
import { t } from '@/i18n'
import { useFontsStore } from '@/stores/fonts'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** 未选择字体时展示的默认项名称 */
    defaultLabel?: string
    /** 仅展示某一语言的字体（zh 中文 / en 西文）；不传则全部展示 */
    lang?: FontLang
  }>(),
  {
    modelValue: undefined,
    defaultLabel: undefined,
    lang: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const fonts = useFontsStore()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)

const currentFont = computed(() => findFontByStack(props.modelValue))
const defaultLabelText = computed(() => props.defaultLabel ?? t('宋体（系统默认）'))
const currentLabel = computed(() => {
  if (!props.modelValue) return defaultLabelText.value
  return currentFont.value?.name ?? t('自定义字体')
})

function matches(font: WebFont): boolean {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return (
    font.name.toLowerCase().includes(q) ||
    font.family.toLowerCase().includes(q) ||
    font.category.toLowerCase().includes(q)
  )
}

const groups = computed(() => {
  const langs: FontLang[] = props.lang ? [props.lang] : ['zh', 'en']
  const list: Array<{ label: string; fonts: WebFont[] }> = []
  for (const lang of langs) {
    const pick = (local: boolean) =>
      WEB_FONTS.filter((f) => f.lang === lang && !!f.local === local && matches(f))
    list.push(
      {
        label: lang === 'zh' ? t('中文系统字体 · 无需联网') : t('西文系统字体 · 无需联网'),
        fonts: pick(true),
      },
      {
        label: lang === 'zh' ? t('中文开源字体 · 联网加载') : t('英文开源字体 · 联网加载'),
        fonts: pick(false),
      },
    )
  }
  return list.filter((g) => g.fonts.length > 0)
})

function pickDefault() {
  emit('update:modelValue', undefined)
  open.value = false
}

function pickFont(font: WebFont) {
  // 立即应用字体栈（fallback 先顶上），后台加载完成后自动换上真实字形
  emit('update:modelValue', fontStackOf(font))
  void fonts.ensureFont(font.id)
  open.value = false
}

function retryFont(font: WebFont, event: Event) {
  event.stopPropagation()
  void fonts.ensureFont(font.id)
}

function onDocClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="input-field flex items-center justify-between gap-2 text-left"
      @click="open = !open"
    >
      <span class="truncate" :style="modelValue ? { fontFamily: modelValue } : undefined">
        {{ currentLabel }}
      </span>
      <svg
        class="size-3.5 shrink-0 text-slate-600 transition-transform"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="absolute right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop"
      >
        <div class="border-b border-slate-100 p-2">
          <input
            v-model="query"
            type="text"
            class="input-field !py-1.5 text-xs"
            :placeholder="t('搜索字体（如：楷体 / Noto / Serif）')"
          />
        </div>

        <div class="max-h-72 overflow-y-auto p-1.5">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50"
            :class="{ 'bg-brand-50/70 text-brand-700': !modelValue }"
            @click="pickDefault"
          >
            <span class="font-medium">{{ defaultLabelText }}</span>
            <span class="text-[10px] text-slate-600">{{ t('无需联网') }}</span>
          </button>

          <template v-for="group in groups" :key="group.label">
            <p class="px-2.5 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-600">
              {{ group.label }}
            </p>
            <button
              v-for="font in group.fonts"
              :key="font.id"
              type="button"
              class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
              :class="{ 'bg-brand-50/70': currentFont?.id === font.id }"
              @click="pickFont(font)"
            >
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm text-slate-800"
                  :style="{ fontFamily: fontStackOf(font) }"
                >
                  {{ font.name }}
                </span>
                <span class="block truncate text-[10px] text-slate-600">
                  {{ font.lang === 'zh' ? font.family : font.preview }}
                </span>
              </span>
              <span
                class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
              >
                {{ font.category }}
              </span>
              <span v-if="!font.local" class="flex w-4 shrink-0 justify-center">
                <span
                  v-if="fonts.statusOf(font.id) === 'loading'"
                  class="size-3 animate-spin rounded-full border-[1.5px] border-brand-200 border-t-brand-600"
                ></span>
                <svg
                  v-else-if="fonts.statusOf(font.id) === 'ready'"
                  class="size-3.5 text-emerald-500"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
                <svg
                  v-else-if="fonts.statusOf(font.id) === 'error'"
                  class="size-3.5 cursor-pointer text-red-400 hover:text-red-600"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  @click="retryFont(font, $event)"
                >
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6" />
                </svg>
                <svg
                  v-else
                  class="size-3.5 text-slate-300"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M8 2.5v8m0 0 3-3m-3 3-3-3M3 13.5h10" />
                </svg>
              </span>
            </button>
          </template>

          <p v-if="!groups.length" class="px-2.5 py-6 text-center text-xs text-slate-600">
            {{ t('没有匹配「{query}」的字体').replace('{query}', query) }}
          </p>
        </div>

        <p
          class="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] leading-4 text-slate-600"
        >
          {{ t('系统字体本机直接渲染；开源字体来自公共 CDN 按需联网加载，可免费商用') }}
        </p>
      </div>
    </Transition>
  </div>
</template>
