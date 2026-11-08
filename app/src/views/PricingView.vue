<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { TEMPLATE_COUNT } from '@/data/templateMeta'
import { labelPapers } from '@/data/labelPapers'

import { currentLocale, localePath, t } from '@/i18n'
import { PRICING_FAQS, faqMentionsAccountBonus } from '@/data/seo'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY } from '@/stores/quota'
import { useToastStore } from '@/stores/toast'
import { trackEvent } from '@/utils/analytics'
import { apiFetch, ApiError } from '@/utils/api'
import { AUTH_MAINTENANCE_HINT } from '@/utils/maintenanceCopy'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
/** 英文行内链接前后需要空格分词，中文不加 */
const wordGap = computed(() => (currentLocale() === 'en' ? ' ' : ''))
/** FAQ 区是否有条目提到账号权益（注册送天数等）：维护态下在区块标题下只渲染一次提示 */
const faqSectionMentionsAccountBonus = PRICING_FAQS.some((f) => faqMentionsAccountBonus(f.a))

// 定价页展示「注册送 7 天」利益点前，探测一次账号服务是否可用（生产 AUTH_SECRET 缺失期间为 503）。
// 直接落地 /pricing 时本组件的 mounted 先于 App 的 bootstrap，ready 尚为 false，需等 ready 后再探
watch(
  () => auth.ready,
  (ready) => {
    if (ready) void auth.probeServiceOnce()
  },
  { immediate: true },
)

interface Plan {
  name: string
  price: string
  priceUnit: string
  originalPrice?: string
  badge: string | null
  tagline: string
  features: string[]
  highlight: boolean
  cta: 'signup' | 'pay'
  /** 付费套餐对应后端 PAY_PLANS 键；免费版为空 */
  payPlan?: string
  /** 已登录时的支付按钮文案（含金额，避免文案与价格漂移） */
  payLabel?: string
}

const PLANS = computed<Plan[]>(() => [
  {
    name: t('免费版'),
    price: t('¥0'),
    priceUnit: t('/月'),
    badge: null,
    tagline: t('个人日常制签'),
    features: [
      t('带水印导出 / 打印不限次数（每张标签底边细线 + seatmark.cn 小字，不遮挡内容）'),
      `${t('无水印导出每日')} ${QUOTA_ANON_DAILY} ${t('次（免费登录即升为每日')} ${QUOTA_USER_DAILY} ${t('次）')}`,
      `${t('分享链接每被点开 1 次即得 1 次无水印导出')}${auth.serviceUnavailable ? t('（服务维护中暂不可用）') : ''}`,
      `${t('全部')} ${TEMPLATE_COUNT} ${t('款内置模板与设计器')}`,
      t('Excel 名单批量导入、A4 / A5 / A3 排版'),
      t('名单不会上传，数据只留在这台设备的浏览器里'),
    ],
    highlight: false,
    cta: 'signup',
  },
  {
    name: t('专业版'),
    price: t('¥5.9'),
    priceUnit: t('/30 天'),
    originalPrice: t('¥19'),
    badge: auth.serviceUnavailable ? t('限时特惠') : t('限时特惠 · 注册送 7 天'),
    tagline: t('考务与会务重度用户'),
    features: [
      ...(auth.serviceUnavailable
        ? []
        : [
            t('新用户注册即送 7 天专业版试用'),
            t('邀请好友注册，双方各送 7 天，可累计叠加'),
          ]),
      t('无水印导出 / 打印不限次数'),
      t('照片批量核验与覆盖率统计'),
      t('自定义模板云端同步与跨设备找回'),
      t('支持兑换码开通，天数可叠加'),
    ],
    highlight: true,
    cta: 'pay',
    payPlan: 'pro-30',
    payLabel: t('在线支付开通 · ¥5.9/30 天'),
  },
  {
    name: t('团队版'),
    price: t('¥19.9'),
    priceUnit: t('/30 天'),
    originalPrice: t('¥49'),
    badge: t('限时特惠'),
    tagline: t('学校 / 机构多人协作'),
    features: [
      t('含专业版全部功能'),
      t('团队成员共享配额与模板'),
      t('模板分享链接团队分发'),
      t('机构商用授权'),
      t('优先反馈响应'),
    ],
    highlight: false,
    cta: 'pay',
    payPlan: 'team-30',
    payLabel: t('在线支付开通 · ¥19.9/30 天'),
  },
])

// ---------- 在线支付（支付宝网页支付） ----------
const paying = ref(false)

async function startPay(plan: string) {
  if (paying.value) return
  paying.value = true
  // 点击事件同步打开窗口避免浏览器弹窗拦截；拿到收银台表单后再写入
  const w = window.open('', '_blank')
  try {
    const data = await apiFetch<{ orderNo: string; paymentHtml: string }>('/api/pay/order', {
      method: 'POST',
      body: { plan },
    })
    trackEvent({ event: 'begin_checkout', category: 'pay', label: plan, params: { currency: 'CNY' } })
    if (w) {
      w.document.write(data.paymentHtml)
      w.document.close()
      // 收银台在新标签页，本页跳转订单结果页轮询到账状态
      void router.push(localePath(`/pay/result?no=${encodeURIComponent(data.orderNo)}`))
    } else {
      // 弹窗被拦截：当前页直接渲染收银台表单，付完由 return_url 回跳结果页
      document.open()
      document.write(data.paymentHtml)
      document.close()
      return
    }
  } catch (err) {
    w?.close()
    toast.danger(t('下单失败'), err instanceof ApiError ? err.message : t('请稍后再试'))
  } finally {
    paying.value = false
  }
}

</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Pricing</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {{ t('定价方案') }}
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">
        {{ t('带水印导出与打印完全不限次数；无水印导出每天') }} {{ QUOTA_ANON_DAILY }} {{ t('次（登录后') }}
        {{ QUOTA_USER_DAILY }} {{ t('次），分享可再送次数。') }}
      </p>
      <p
        class="mx-auto mt-1.5 max-w-xl text-sm leading-7 text-slate-600"
        data-testid="pricing-signup-benefit"
      >
        <template v-if="auth.serviceUnavailable">
          {{ t(AUTH_MAINTENANCE_HINT) }}
        </template>
        <template v-else>
          {{ t('注册即送 7 天专业版；邀请好友注册，双方各送 7 天，可累计叠加；专业版可用兑换码开通。') }}
        </template>
      </p>
    </div>

    <div class="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(plan, planIndex) in PLANS"
        :key="plan.name"
        data-testid="pricing-plan-card"
        class="relative flex flex-col rounded-lg border bg-white p-6 pt-7 shadow-card"
        :class="[
          plan.highlight ? 'border-brand-400 ring-2 ring-brand-500/20' : 'border-slate-200',
          planIndex === 2 ? 'md:col-span-2 md:mx-auto md:w-[calc(50%-0.625rem)] lg:col-span-1 lg:mx-0 lg:w-auto' : '',
        ]"
      >
        <span
          v-if="plan.badge"
          class="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-semibold whitespace-nowrap shadow-sm ring-4 ring-white"
          :class="plan.highlight ? 'bg-brand-600 text-white' : 'bg-slate-700 text-white'"
        >
          {{ plan.badge }}
        </span>
        <h2 class="text-base font-bold text-slate-900">{{ plan.name }}</h2>
        <p class="mt-0.5 text-xs leading-4 text-slate-600 md:min-h-8">{{ plan.tagline }}</p>

        <div class="mt-4 flex items-end gap-2" data-testid="plan-price">
          <span class="text-4xl font-bold tracking-tight text-slate-900">{{ plan.price }}</span>
          <span class="pb-1 text-sm font-semibold text-slate-600">{{ plan.priceUnit }}</span>
          <span
            v-if="plan.payPlan === 'pro-30' && !auth.serviceUnavailable"
            class="mb-1 ml-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
          >
            {{ t('注册送 7 天') }}
          </span>
        </div>
        <!-- 原价独立一行；免费版无原价时保留同高占位，三卡价格区对齐 -->
        <p
          class="mt-1 min-h-4 text-xs leading-4 text-slate-500"
          data-testid="plan-original-price"
          :aria-hidden="plan.originalPrice ? undefined : 'true'"
        >
          <template v-if="plan.originalPrice">
            {{ t('原价') }}
            <s>{{ plan.originalPrice }}</s>{{ plan.priceUnit }}
            · {{ t('限时特惠') }}
          </template>
        </p>

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
            <span class="min-w-0 break-keep [overflow-wrap:anywhere]">{{ feature }}</span>
          </li>
        </ul>
        <p
          v-if="plan.payPlan === 'pro-30' && auth.serviceUnavailable"
          class="mt-3 text-xs leading-5 text-slate-500"
          data-testid="pricing-maintenance-hint"
        >
          {{ t('注册领取试用暂不可用，见页顶说明') }}
        </p>

        <RouterLink
          v-if="plan.cta === 'signup'"
          :to="localePath(auth.user || auth.serviceUnavailable ? '/studio' : '/account')"
          class="btn btn-secondary btn-md mt-6 w-full"
        >
          {{ t('免费开始使用') }}
        </RouterLink>
        <template v-else-if="plan.cta === 'pay' && !auth.serviceUnavailable && auth.user">
          <button
            type="button"
            class="btn btn-primary btn-md mt-6 w-full"
            :data-testid="plan.payPlan === 'pro-30' ? 'pricing-pro-cta' : 'pricing-team-cta'"
            :disabled="paying"
            @click="startPay(plan.payPlan!)"
          >
            {{ paying ? t('正在创建订单…') : plan.payLabel }}
          </button>
          <RouterLink
            v-if="plan.payPlan === 'pro-30'"
            :to="localePath('/account#redeem')"
            class="mt-2 block text-center text-xs text-slate-500 underline-offset-2 hover:text-brand-600 hover:underline"
          >
            {{ t('使用兑换码开通 / 延长') }}
          </RouterLink>
        </template>
        <RouterLink
          v-else-if="plan.cta === 'pay' && !auth.serviceUnavailable"
          :to="localePath('/account')"
          class="btn btn-primary btn-md mt-6 w-full"
          :data-testid="plan.payPlan === 'pro-30' ? 'pricing-pro-cta' : 'pricing-team-cta'"
        >
          {{ plan.payPlan === 'pro-30' ? t('注册领 7 天试用') : t('登录后开通') }}
        </RouterLink>
        <RouterLink
          v-else-if="plan.cta === 'pay'"
          :to="localePath('/studio')"
          class="btn btn-primary btn-md mt-6 w-full"
          :data-testid="plan.payPlan === 'pro-30' ? 'pricing-pro-cta-degraded' : 'pricing-team-cta-degraded'"
        >
          {{ t('先用带水印导出') }}
        </RouterLink>
      </div>
    </div>

    <p class="mt-6 text-center text-xs text-slate-600">
      {{ t('专业版与团队版均支持支付宝在线支付，会员天数发放到当前登录账号；专业版还可用兑换码开通，天数可叠加。') }}
    </p>

    <!-- 纸型售卖 / 定制服务 / 年度会员套餐 -->
    <section class="mt-12">
      <h2 class="text-center text-2xl font-bold tracking-tight text-slate-900">
        {{ t('纸型与定制服务') }}
      </h2>
      <p class="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-slate-600">
        {{ t('除模板工具外，我们还提供不干胶纸型售卖与按纸型定制模板的人工服务。') }}
      </p>
      <div class="mt-8 grid gap-5 md:grid-cols-3">
        <div class="flex flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          <h3 class="text-base font-bold text-slate-900">{{ t('同款纸型售卖') }}</h3>
          <p class="mt-2 flex-1 text-sm leading-6 text-slate-600">
            {{
              t('{n} 种模切规格，铜版纸 / 牛皮纸 / 防水 PET 多材质可选，满 5 包起享团购价；在纸型详情页提交购买意向，客服报价确认后发货。').replace(
                '{n}',
                String(labelPapers.length),
              )
            }}
          </p>
          <RouterLink :to="localePath('/papers')" class="btn btn-secondary btn-md mt-5 w-full">
            {{ t('浏览纸型库选购') }}
          </RouterLink>
        </div>
        <div class="flex flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          <h3 class="text-base font-bold text-slate-900">{{ t('按纸型定制模板') }}</h3>
          <p class="mt-2 flex-1 text-sm leading-6 text-slate-600">
            {{ t('设计师按你手上的纸型模切格 1:1 出稿：字段对应 Excel 表头，上传名单即批量出图。3 个工作日交付初稿，在各纸型详情页提交定制需求。') }}
          </p>
          <RouterLink :to="localePath('/papers')" class="btn btn-secondary btn-md mt-5 w-full">
            {{ t('选纸型提需求') }}
          </RouterLink>
        </div>
        <div class="flex flex-col rounded-lg border border-brand-300 bg-brand-50/40 p-6 shadow-card">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-base font-bold text-slate-900">{{ t('年度会员 · 含定制') }}</h3>
            <span class="text-2xl font-bold tracking-tight text-slate-900">{{ t('¥199') }}</span>
          </div>
          <ul class="mt-3 flex-1 space-y-2 text-sm text-slate-600">
            <li class="flex items-start gap-2">
              <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"></span>
              {{ t('含专业版全部功能（365 天）') }}
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"></span>
              {{ t('纸型专属模板定制 ×1（人工服务，3 个工作日交付）') }}
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"></span>
              {{ t('纸型与耗材团购会员价') }}
            </li>
          </ul>
          <button
            v-if="!auth.serviceUnavailable && auth.user"
            type="button"
            class="btn btn-primary btn-md mt-5 w-full"
            data-testid="pricing-annual-cta"
            :disabled="paying"
            @click="startPay('pro-365')"
          >
            {{ paying ? t('正在创建订单…') : t('在线支付开通 · ¥199/365 天') }}
          </button>
          <RouterLink
            v-else-if="!auth.serviceUnavailable"
            :to="localePath('/account')"
            class="btn btn-primary btn-md mt-5 w-full"
            data-testid="pricing-annual-cta"
          >
            {{ t('登录后开通') }}
          </RouterLink>
          <RouterLink
            v-else
            :to="localePath('/studio')"
            class="btn btn-primary btn-md mt-5 w-full"
            data-testid="pricing-annual-cta-degraded"
          >
            {{ t('先用带水印导出') }}
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mx-auto mt-14 max-w-3xl">
      <h2 class="text-center text-2xl font-bold tracking-tight text-slate-900">{{ t('定价常见问题') }}</h2>
      <p
        v-if="auth.serviceUnavailable && faqSectionMentionsAccountBonus"
        class="mx-auto mt-3 max-w-xl text-center text-xs leading-5 text-slate-500"
        data-testid="pricing-maintenance-hint"
      >
        {{ t(AUTH_MAINTENANCE_HINT) }}
      </p>
      <div class="mt-6 grid gap-4">
        <div
          v-for="faq in PRICING_FAQS"
          :key="faq.q"
          class="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h3 class="text-sm font-bold text-slate-900">{{ t(faq.q) }}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ t(faq.a) }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <div class="mt-12 text-center">
      <RouterLink
        :to="localePath(auth.user || auth.serviceUnavailable ? '/studio' : '/account')"
        class="btn btn-primary btn-lg"
      >
        {{ auth.user || auth.serviceUnavailable ? t('进入标签工坊') : t('开始免费试用') }}
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
      <p class="mt-3 text-xs text-slate-600">
        {{ t('还不确定？先看看') }}{{ wordGap }}<RouterLink :to="localePath('/guides')" class="font-semibold text-brand-600 hover:underline">{{ t('教程中心') }}</RouterLink>{{ wordGap }}{{ t('或') }}{{ wordGap }}<RouterLink :to="localePath('/templates')" class="font-semibold text-brand-600 hover:underline">{{ t('模板库') }}</RouterLink>
      </p>
    </div>
  </div>
</template>
