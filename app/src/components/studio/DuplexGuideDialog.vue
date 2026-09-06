<script setup lang="ts">
import ModalDialog from '@/components/ui/ModalDialog.vue'
import { t } from '@/i18n'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <ModalDialog :open="open" :title="t('双面 / 对折打印引导')" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <p class="leading-6">
        {{ t('当前模板为') }}<strong class="text-slate-900">{{ t('对折双联（镜像）桌牌') }}</strong>{{ t('：一张纸上下两半内容互为 180° 镜像，') }}
        <strong class="text-slate-900">{{ t('单面打印后沿中线对折') }}</strong>{{ t('即可立于桌面，两面都能正读，无需双面打印。') }}
      </p>
      <p class="text-xs leading-5 text-slate-600">
        {{ t('如果你要打印的是正反两面独立内容（如证卡正反面），在打印对话框勾选「双面打印」时请注意翻转方式的区别：') }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <svg class="mx-auto h-24 w-full" viewBox="0 0 160 96" fill="none" aria-hidden="true">
            <rect x="18" y="14" width="52" height="68" rx="3" fill="#ffffff" stroke="#334155" stroke-width="1.5" />
            <text x="44" y="52" text-anchor="middle" font-size="14" fill="#334155" font-weight="bold">A</text>
            <path d="M78 48h18m0 0-5-5m5 5-5 5" stroke="#4f46e5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <rect x="102" y="14" width="52" height="68" rx="3" fill="#eef2ff" stroke="#4f46e5" stroke-width="1.5" />
            <text x="128" y="52" text-anchor="middle" font-size="14" fill="#4f46e5" font-weight="bold">B</text>
            <path d="M96 8v80" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3" />
          </svg>
          <h4 class="mt-2 text-center text-sm font-bold text-slate-900">{{ t('长边翻转') }}</h4>
          <p class="mt-1 text-center text-xs leading-5 text-slate-600">
            {{ t('像翻书一样沿长边翻页。') }}<strong>{{ t('纵向纸张的双面内容') }}</strong>{{ t('（证卡、讲义）用这个，背面不会倒置。') }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <svg class="mx-auto h-24 w-full" viewBox="0 0 160 96" fill="none" aria-hidden="true">
            <rect x="18" y="14" width="52" height="68" rx="3" fill="#ffffff" stroke="#334155" stroke-width="1.5" />
            <text x="44" y="52" text-anchor="middle" font-size="14" fill="#334155" font-weight="bold">A</text>
            <path d="M78 48h18m0 0-5-5m5 5-5 5" stroke="#4f46e5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <rect x="102" y="14" width="52" height="68" rx="3" fill="#eef2ff" stroke="#4f46e5" stroke-width="1.5" />
            <text x="128" y="58" text-anchor="middle" font-size="14" fill="#4f46e5" font-weight="bold" transform="rotate(180 128 52)">B</text>
            <path d="M102 48h52" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3" />
          </svg>
          <h4 class="mt-2 text-center text-sm font-bold text-slate-900">{{ t('短边翻转') }}</h4>
          <p class="mt-1 text-center text-xs leading-5 text-slate-600">
            {{ t('像翻日历一样沿短边翻页，背面相对正面上下颠倒。') }}<strong>{{ t('横向纸张的双面桌牌') }}</strong>{{ t('常用这个。') }}
          </p>
        </div>
      </div>

      <div class="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">
        {{ t('选错翻转方式的表现：背面内容上下颠倒。对折双联（镜像）模板请直接') }}<strong>{{ t('单面打印') }}</strong>{{ t('， 不要勾选双面打印；打印缩放选「实际大小 / 100%」。') }}
      </div>
    </div>

    <template #actions>
      <button type="button" class="btn btn-ghost btn-md" @click="emit('close')">{{ t('取消') }}</button>
      <button type="button" class="btn btn-primary btn-md" @click="emit('confirm')">
        {{ t('我已了解，继续打印') }}
      </button>
    </template>
  </ModalDialog>
</template>
