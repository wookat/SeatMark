<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { localePath, t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { apiFetch, ApiError } from '@/utils/api'

const route = useRoute()
const auth = useAuthStore()

interface OrderInfo {
  no: string
  plan: string
  amount: string
  days: number
  status: string
  tradeNo: string | null
  paidAt: string | null
}

const order = ref<OrderInfo | null>(null)
const proUntil = ref<string | null>(null)
const error = ref('')
const loading = ref(true)
const refreshing = ref(false)
const pollCount = ref(0)
let timer: number | undefined

const orderNo = computed(() => String(route.query.no || route.query.out_trade_no || ''))
const paid = computed(() => order.value?.status === 'paid')
const ended = computed(() => ['closed', 'refunded', 'partial_refund'].includes(order.value?.status || ''))

const proUntilText = computed(() => {
  if (!proUntil.value) return ''
  const d = new Date(proUntil.value)
  return Number.isNaN(d.getTime()) ? proUntil.value : d.toLocaleDateString()
})

async function refresh(manual = false) {
  if (!orderNo.value) {
    error.value = t('缺少订单号')
    loading.value = false
    return
  }
  if (!auth.user) {
    loading.value = false
    return
  }
  if (manual) refreshing.value = true
  try {
    const data = await apiFetch<{ order: OrderInfo; pro: { active: boolean; until: string | null } }>(
      `/api/pay/order?no=${encodeURIComponent(orderNo.value)}&refresh=1`,
    )
    order.value = data.order
    proUntil.value = data.pro?.until || null
    error.value = ''
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('查询失败，请稍后再试')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => {
  void refresh()
  // 异步通知通常滞后回跳数秒：未确认时每 3s 复查一次本地状态，最多 10 次后停轮询
  timer = window.setInterval(() => {
    if (paid.value || ended.value || error.value || pollCount.value >= 10) {
      window.clearInterval(timer)
      return
    }
    pollCount.value += 1
    void refresh()
  }, 3000)
})

// 会话可能晚于组件挂载完成（直接由支付宝回跳落地本页）：auth ready 后补一次查询
watch(
  () => auth.ready,
  (ready) => {
    if (ready && auth.user && !order.value && !error.value) void refresh()
  },
)

onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-16 sm:px-6">
    <h1 class="text-center text-2xl font-bold tracking-tight text-slate-900">{{ t('支付结果') }}</h1>

    <div class="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p v-if="loading" class="text-center text-sm text-slate-500">{{ t('正在确认订单状态…') }}</p>

      <template v-else-if="!auth.user">
        <p class="text-center text-sm text-slate-600">{{ t('请先登录查看订单') }}</p>
        <RouterLink :to="localePath('/account')" class="btn btn-primary btn-md mt-4 w-full">
          {{ t('去登录') }}
        </RouterLink>
      </template>

      <template v-else-if="error && !order">
        <p class="text-center text-sm text-red-600">{{ error }}</p>
        <button type="button" class="btn btn-secondary btn-md mt-4 w-full" :disabled="refreshing" @click="refresh(true)">
          {{ refreshing ? t('查询中…') : t('重试') }}
        </button>
      </template>

      <template v-else-if="order">
        <div class="text-center">
          <span
            v-if="paid"
            class="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
          >
            <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 13 4 4 10-11" />
            </svg>
          </span>
          <span
            v-else-if="ended"
            class="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
          <span
            v-else
            class="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600"
          >
            <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </span>

          <p class="mt-4 text-lg font-bold text-slate-900">
            {{ paid ? t('支付成功') : ended ? t('订单已关闭或已退款') : t('等待支付确认') }}
          </p>
          <p v-if="paid" class="mt-1 text-sm text-slate-600">
            {{ t('专业版天数已到账') }}<template v-if="proUntilText">，{{ t('有效期至') }} {{ proUntilText }}</template>
          </p>
          <p v-else-if="!ended" class="mt-1 text-sm leading-6 text-slate-600">
            {{ t('若已在支付宝完成付款，订单将在数秒内自动更新；也可手动刷新状态。') }}
          </p>

          <dl class="mt-4 space-y-1 text-xs text-slate-500">
            <div class="flex justify-center gap-2">
              <dt>{{ t('订单号') }}</dt>
              <dd class="font-mono">{{ order.no }}</dd>
            </div>
            <div class="flex justify-center gap-2">
              <dt>{{ t('金额') }}</dt>
              <dd>¥{{ order.amount }} · {{ order.days }} {{ t('天') }}</dd>
            </div>
            <div v-if="order.tradeNo" class="flex justify-center gap-2">
              <dt>{{ t('支付宝交易号') }}</dt>
              <dd class="font-mono">{{ order.tradeNo }}</dd>
            </div>
          </dl>

          <button
            v-if="!paid && !ended"
            type="button"
            class="btn btn-secondary btn-md mt-5 w-full"
            :disabled="refreshing"
            @click="refresh(true)"
          >
            {{ refreshing ? t('查询中…') : t('刷新支付状态') }}
          </button>
        </div>
      </template>
    </div>

    <div class="mt-6 flex justify-center gap-3">
      <RouterLink :to="localePath('/pricing')" class="btn btn-secondary btn-md">{{ t('返回定价页') }}</RouterLink>
      <RouterLink v-if="paid" :to="localePath('/studio')" class="btn btn-primary btn-md">{{ t('进入标签工坊') }}</RouterLink>
    </div>
  </div>
</template>
