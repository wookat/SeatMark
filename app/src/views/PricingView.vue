<script setup lang="ts">
import { computed, ref } from 'vue'

import { defaultTemplates } from '@/data/defaultTemplates'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import { PRICING_FAQS } from '@/data/seo'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { apiFetch, ApiError, isValidEmail } from '@/utils/api'

const auth = useAuthStore()
const toast = useToastStore()

interface Plan {
  name: string
  price: string
  priceUnit: string
  badge: string | null
  tagline: string
  features: string[]
  highlight: boolean
  cta: 'signup' | 'pro-coming' | 'team-reserve'
}

const PLANS = computed<Plan[]>(() => [
  {
    name: '免费版',
    price: '¥0',
    priceUnit: '/月',
    badge: null,
    tagline: '个人日常制签',
    features: [
      `每日 ${QUOTA_ANON_DAILY} 次生成（登录后 ${QUOTA_USER_DAILY} 次）`,
      '分享链接可额外获得当日次数',
      `全部 ${defaultTemplates.length} 款内置模板与设计器`,
      'Excel 名单批量导入与智能映射',
      'A4 / A5 / A3 排版、PDF 导出与打印',
      '数据全程浏览器本地处理',
    ],
    highlight: false,
    cta: 'signup',
  },
  {
    name: '专业版',
    price: '¥29',
    priceUnit: '/月',
    badge: '即将推出',
    tagline: '考务与会务重度用户',
    features: [
      '含免费版全部功能',
      '更高每日生成配额',
      '照片批量核验与覆盖率统计',
      '自定义模板云端同步不限量',
      '在线开源字体库与 AI 设计辅助',
    ],
    highlight: false,
    cta: 'pro-coming',
  },
  {
    name: '团队版',
    price: '¥99',
    priceUnit: '/月',
    badge: '可预订',
    tagline: '学校 / 机构多人协作',
    features: [
      '含专业版全部功能',
      '团队成员共享配额与模板',
      '模板分享链接团队分发',
      '机构商用授权',
      '优先反馈响应',
    ],
    highlight: true,
    cta: 'team-reserve',
  },
])

// ---------- 团队版预订 ----------
const reserveOpen = ref(false)
const reserveEmail = ref('')
const reserveTeamSize = ref('')
const reserveNote = ref('')
const reserving = ref(false)
const reserveError = ref('')
const reserved = ref(false)

function openReserve() {
  reserveEmail.value = auth.user?.email ?? ''
  reserveError.value = ''
  reserveOpen.value = true
}

async function submitReserve() {
  reserveError.value = ''
  if (!isValidEmail(reserveEmail.value.trim())) {
    reserveError.value = '请输入正确的邮箱地址'
    return
  }
  reserving.value = true
  try {
    await apiFetch('/api/team/reserve', {
      method: 'POST',
      body: {
        email: reserveEmail.value.trim(),
        teamSize: reserveTeamSize.value.trim(),
        note: reserveNote.value.trim(),
      },
    })
    reserved.value = true
    toast.success('预订登记成功', '团队版支付开通后我们会第一时间邮件通知你')
  } catch (err) {
    reserveError.value = err instanceof ApiError ? err.message : '提交失败，请稍后再试'
  } finally {
    reserving.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Pricing</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        定价方案
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500">
        免费版每天可生成 {{ QUOTA_ANON_DAILY }} 次（登录后
        {{ QUOTA_USER_DAILY }} 次），预览与排版不限次数。
        专业版即将推出；团队版现已标价，支付开通前可预订登记。
      </p>
    </div>

    <div class="mt-10 grid gap-5 md:grid-cols-3">
      <div
        v-for="plan in PLANS"
        :key="plan.name"
        class="relative flex flex-col rounded-lg border bg-white p-6 shadow-card"
        :class="plan.highlight ? 'border-brand-400 ring-2 ring-brand-500/20' : 'border-slate-200'"
      >
        <span
          v-if="plan.badge"
          class="absolute -top-3 left-1/2 -translate-x-1/2 rounded px-3 py-0.5 text-[11px] font-semibold"
          :class="plan.highlight ? 'bg-brand-600 text-white' : 'bg-slate-700 text-white'"
        >
          {{ plan.badge }}
        </span>
        <h2 class="text-base font-bold text-slate-900">{{ plan.name }}</h2>
        <p class="mt-0.5 text-xs text-slate-500">{{ plan.tagline }}</p>

        <div class="mt-4 flex items-end gap-2">
          <span class="text-4xl font-bold tracking-tight text-slate-900">{{ plan.price }}</span>
          <span class="pb-1 text-sm font-semibold text-slate-400">{{ plan.priceUnit }}</span>
        </div>

        <ul class="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-slate-600">
          <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
            <svg
              class="mt-0.5 size-4 shrink-0 text-emerald-500"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
            {{ feature }}
          </li>
        </ul>

        <RouterLink
          v-if="plan.cta === 'signup'"
          :to="auth.user ? '/studio' : '/account'"
          class="btn btn-secondary btn-md mt-6 w-full"
        >
          {{ auth.user ? '免费开始使用' : '免费领取 Beta 会员' }}
        </RouterLink>
        <button
          v-else-if="plan.cta === 'pro-coming'"
          type="button"
          class="btn btn-secondary btn-md mt-6 w-full cursor-default opacity-70"
          disabled
        >
          即将推出
        </button>
        <button
          v-else
          type="button"
          class="btn btn-primary btn-md mt-6 w-full"
          @click="openReserve"
        >
          立即预订
        </button>
      </div>
    </div>

    <p class="mt-6 text-center text-xs text-slate-400">
      团队版支付通道即将开通，预订登记不收取任何费用；所有名单数据仅在浏览器本地处理，不会上传服务器。
    </p>

    <!-- FAQ -->
    <section class="mx-auto mt-14 max-w-3xl">
      <h2 class="text-center text-2xl font-bold tracking-tight text-slate-900">定价常见问题</h2>
      <div class="mt-6 grid gap-4">
        <div
          v-for="faq in PRICING_FAQS"
          :key="faq.q"
          class="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ faq.q }}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ faq.a }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <div class="mt-12 text-center">
      <RouterLink :to="auth.user ? '/studio' : '/account'" class="btn btn-primary btn-lg">
        {{ auth.user ? '进入标签工坊' : '免费领取 Beta 会员' }}
        <svg
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </RouterLink>
      <p class="mt-3 text-xs text-slate-400">
        还不确定？先看看<RouterLink to="/guides" class="font-semibold text-brand-600 hover:underline">教程中心</RouterLink>或<RouterLink to="/templates" class="font-semibold text-brand-600 hover:underline">模板库</RouterLink>
      </p>
    </div>

    <!-- 团队版预订弹窗 -->
    <ModalDialog :open="reserveOpen" title="预订团队版" size="md" @close="reserveOpen = false">
      <template v-if="!reserved">
        <p class="leading-6">
          团队版 ¥99/月，支付通道即将开通。留下邮箱与团队规模，开通后我们第一时间通知你，预订用户享首批优惠。
        </p>
        <form class="mt-4 grid gap-3" @submit.prevent="submitReserve">
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">联系邮箱</span>
            <input
              v-model="reserveEmail"
              type="email"
              required
              placeholder="you@example.com"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">团队规模（选填）</span>
            <input
              v-model="reserveTeamSize"
              type="text"
              maxlength="50"
              placeholder="如：5-10 人 / 一所学校"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">备注（选填）</span>
            <textarea
              v-model="reserveNote"
              rows="2"
              maxlength="500"
              placeholder="使用场景或其他需求"
              class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <p v-if="reserveError" class="text-sm font-medium text-red-600">{{ reserveError }}</p>
          <button type="submit" class="btn btn-primary btn-md w-full" :disabled="reserving">
            {{ reserving ? '提交中...' : '提交预订登记' }}
          </button>
        </form>
      </template>
      <template v-else>
        <div class="py-4 text-center">
          <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 13 4 4 10-11" />
            </svg>
          </span>
          <p class="mt-3 text-sm font-bold text-slate-900">预订登记成功</p>
          <p class="mt-1 text-sm leading-6 text-slate-500">
            团队版支付开通后我们会邮件通知 {{ reserveEmail }}，感谢支持。
          </p>
          <button type="button" class="btn btn-secondary btn-sm mt-4" @click="reserveOpen = false">
            关闭
          </button>
        </div>
      </template>
    </ModalDialog>
  </div>
</template>
