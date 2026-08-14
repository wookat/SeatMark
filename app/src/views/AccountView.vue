<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { QUOTA_ANON_DAILY, QUOTA_USER_DAILY, useQuotaStore } from '@/stores/quota'
import { isValidTemplate, useTemplateLibrary } from '@/stores/templateLibrary'
import { useToastStore } from '@/stores/toast'
import { apiFetch, ApiError, isValidEmail } from '@/utils/api'
import type { LabelTemplate } from '@/types/template'

const auth = useAuthStore()
const quota = useQuotaStore()
const library = useTemplateLibrary()
const toast = useToastStore()

// ---------- 登录表单（邮箱 + 密码 + 验证码） ----------
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const mode = ref<'login' | 'register' | 'reset'>('login')
const submitting = ref(false)
const formError = ref('')

// 表单验证码（服务端图片字符，防机器人）
const captchaImage = ref('')
const captchaToken = ref('')
const captchaAnswer = ref('')
const captchaLoading = ref(false)

async function refreshCaptcha() {
  captchaLoading.value = true
  captchaAnswer.value = ''
  try {
    const data = await auth.fetchCaptcha()
    captchaImage.value = data.image
    captchaToken.value = data.token
  } catch {
    captchaImage.value = ''
    captchaToken.value = ''
  } finally {
    captchaLoading.value = false
  }
}

onMounted(() => {
  if (!auth.user) void refreshCaptcha()
})

function switchMode(next: 'login' | 'register' | 'reset') {
  mode.value = next
  formError.value = ''
  password.value = ''
  confirmPassword.value = ''
  resetCodeSent.value = false
  resetCode.value = ''
  void refreshCaptcha()
}

function captchaInput() {
  return { captchaToken: captchaToken.value, captchaAnswer: captchaAnswer.value.trim() }
}

function validateCommon(emailValue: string): boolean {
  if (!isValidEmail(emailValue)) {
    formError.value = t('请输入正确的邮箱地址')
    return false
  }
  if (!captchaAnswer.value.trim()) {
    formError.value = t('请输入图片验证码')
    return false
  }
  return true
}

// 找回密码：发码状态与 60s 重发倒计时
const resetCode = ref('')
const resetCodeSent = ref(false)
const resetSending = ref(false)
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown(seconds = 60) {
  resendCooldown.value = seconds
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function onSendResetCode() {
  formError.value = ''
  const emailValue = email.value.trim().toLowerCase()
  if (!validateCommon(emailValue)) return
  resetSending.value = true
  try {
    const data = await auth.sendResetCode(emailValue, captchaInput())
    resetCodeSent.value = true
    startCooldown()
    if (data.devCode) resetCode.value = data.devCode
    toast.success(t('验证码已发送'), t('若该邮箱已注册，重置验证码将在几分钟内送达，请同时检查垃圾邮件'))
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : t('发送失败，请稍后再试')
    if (err instanceof ApiError && err.status === 400) void refreshCaptcha()
  } finally {
    resetSending.value = false
  }
}

async function onSubmit() {
  formError.value = ''
  const emailValue = email.value.trim().toLowerCase()
  if (mode.value === 'reset' && !resetCodeSent.value) {
    await onSendResetCode()
    return
  }
  // 重置第二步只验重置码（验证问题已在发码时校验过）
  if (mode.value !== 'reset' && !validateCommon(emailValue)) return
  if (!isValidEmail(emailValue)) {
    formError.value = t('请输入正确的邮箱地址')
    return
  }
  if (password.value.length < 8) {
    formError.value = t('密码至少 8 位')
    return
  }
  if (
    (mode.value === 'register' || mode.value === 'reset') &&
    password.value !== confirmPassword.value
  ) {
    formError.value = t('两次输入的密码不一致')
    return
  }
  if (mode.value === 'reset' && !/^\d{6}$/.test(resetCode.value.trim())) {
    formError.value = t('请输入邮件中的 6 位验证码')
    return
  }
  submitting.value = true
  try {
    if (mode.value === 'register') {
      await auth.register(emailValue, password.value, captchaInput())
      toast.success(t('注册成功'), t('已赠送 7 天专业版试用：无水印导出不限次与云端模板同步已生效'))
    } else if (mode.value === 'reset') {
      await auth.resetPassword(emailValue, resetCode.value.trim(), password.value)
      toast.success(t('密码已重置'), t('新密码已生效，已为你自动登录'))
    } else {
      await auth.login(emailValue, password.value, captchaInput())
      toast.success(t('登录成功'), t('无水印导出额度与云端模板同步已生效'))
    }
    password.value = ''
    confirmPassword.value = ''
  } catch (err) {
    formError.value =
      err instanceof ApiError
        ? err.message
        : mode.value === 'register'
          ? t('注册失败，请稍后再试')
          : mode.value === 'reset'
            ? t('重置失败，请稍后再试')
            : t('登录失败，请稍后再试')
    // 验证码错误或已过期：换一题重试
    if (err instanceof ApiError && err.status === 400) void refreshCaptcha()
  } finally {
    submitting.value = false
  }
}

// 登出后回到登录表单时验证码已过期，重新取题
watch(
  () => auth.user,
  (user, prev) => {
    if (!user && prev) void refreshCaptcha()
  },
)

// ---------- 云端模板 ----------
const syncing = ref(false)
const restoring = ref(false)

async function onSyncToCloud() {
  if (!auth.user) return
  syncing.value = true
  try {
    const data = await apiFetch<{ count: number; updatedAt: string }>('/api/account/templates', {
      method: 'PUT',
      body: { templates: library.customTemplates },
    })
    auth.user.templateCount = data.count
    auth.user.templateUpdatedAt = data.updatedAt
    toast.success(t('已同步到云端'), `${data.count} ${t('个自定义模板，可在任意设备登录找回')}`)
  } catch (err) {
    toast.danger(t('同步失败'), err instanceof ApiError ? err.message : t('请稍后再试'))
  } finally {
    syncing.value = false
  }
}

async function onRestoreFromCloud() {
  if (!auth.user) return
  restoring.value = true
  try {
    const data = await apiFetch<{ templates: unknown[] }>('/api/account/templates')
    const templates = data.templates.filter(isValidTemplate) as LabelTemplate[]
    const added = library.importTemplates(templates)
    if (library.lastPersistOk)
      toast.success(t('云端模板已找回'), `${templates.length} ${t('个云端模板，新增')} ${added}`)
  } catch (err) {
    toast.danger(t('找回失败'), err instanceof ApiError ? err.message : t('请稍后再试'))
  } finally {
    restoring.value = false
  }
}

// ---------- 账号注销 ----------
const deleting = ref(false)

async function onDeleteAccount() {
  if (!auth.user) return
  const ok = window.confirm(
    t('确定注销账号？将删除服务器上与你账号关联的邮箱、云端模板与分享数据，此操作不可恢复。浏览器本地保存的模板不受影响。'),
  )
  if (!ok) return
  deleting.value = true
  try {
    await apiFetch('/api/account/delete', { method: 'POST' })
    auth.user = null
    toast.success(t('账号已注销'), t('服务器上与你账号关联的个人信息已删除'))
  } catch (err) {
    toast.danger(t('注销失败'), err instanceof ApiError ? err.message : t('请稍后再试'))
  } finally {
    deleting.value = false
  }
}

// ---------- 分享 ----------
const shareLink = computed(() =>
  auth.user ? `https://www.seatmark.cn/?ref=${auth.user.share.code}` : '',
)

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    toast.success(t('分享链接已复制'), t('发给同事或群聊，每被点开 1 次即得 1 次无水印导出'))
  } catch {
    toast.warning(t('复制失败'), t('请手动复制上方链接'))
  }
}

const shareCopyText = computed(
  () =>
    `${t('推荐一个好用的工具：SeatMark 座签，上传 Excel 名单就能批量生成考场座位标签、桌牌、席位卡，排版精确到毫米，数据全程不出浏览器。点我的链接直接用：')}${shareLink.value}`,
)

async function copyShareText() {
  try {
    await navigator.clipboard.writeText(shareCopyText.value)
    toast.success(t('推荐文案已复制'), t('含你的专属链接，直接粘贴到群聊或朋友圈即可'))
  } catch {
    toast.warning(t('复制失败'), t('请手动复制分享链接'))
  }
}

// ---------- 兑换码 ----------
const redeemCode = ref('')
const redeeming = ref(false)
const redeemError = ref('')

async function onRedeem() {
  redeemError.value = ''
  const code = redeemCode.value.trim()
  if (!code) {
    redeemError.value = t('请输入兑换码')
    return
  }
  redeeming.value = true
  try {
    const result = await auth.redeem(code)
    redeemCode.value = ''
    if (result.already) {
      toast.success(t('兑换码已生效'), t('该兑换码此前已兑换到你的账号'))
    } else {
      toast.success(t('兑换成功'), `${t('专业版已延长')} ${result.days} ${t('天')}`)
    }
  } catch (err) {
    redeemError.value = err instanceof ApiError ? err.message : t('兑换失败，请稍后再试')
  } finally {
    redeeming.value = false
  }
}

const proUntilText = computed(() => {
  const until = auth.user?.pro?.until
  if (!until) return ''
  return new Date(until).toLocaleDateString('zh-CN')
})

const quotaPercent = computed(() => {
  if (!auth.user) return 0
  const { used, limit } = auth.user.quota
  return limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
})

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
    <!-- 未登录：登录表单 -->
    <template v-if="!auth.user">
      <div class="mx-auto max-w-md">
        <div class="text-center">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {{ mode === 'register' ? t('注册 SeatMark') : mode === 'reset' ? t('找回密码') : t('登录 SeatMark') }}
          </h1>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            <template v-if="mode === 'reset'">
              {{ t('输入注册邮箱获取重置验证码，验证后设置新密码即可重新登录。') }}
            </template>
            <template v-else>
              {{ t('邮箱 + 密码登录。新用户注册即送 7 天专业版试用（无水印导出不限次）；免费版每日') }}
              {{ QUOTA_USER_DAILY }} {{ t('次无水印导出（未登录') }} {{ QUOTA_ANON_DAILY }} {{ t('次）；自定义模板云端同步与跨设备找回；带水印导出/打印始终不限次数。') }}
            </template>
          </p>
        </div>

        <form class="mt-8 grid gap-4" @submit.prevent="onSubmit">
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">{{ t('邮箱') }}</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <!-- 找回密码：重置验证码（发码后展示） -->
          <label v-if="mode === 'reset' && resetCodeSent" class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">{{ t('邮件验证码') }}</span>
            <div class="flex gap-2">
              <input
                v-model="resetCode"
                type="text"
                inputmode="numeric"
                maxlength="6"
                required
                autocomplete="one-time-code"
                :placeholder="t('邮件中的 6 位验证码')"
                class="h-10 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm tracking-widest text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                class="btn btn-secondary btn-sm h-10 shrink-0"
                :disabled="resetSending || resendCooldown > 0"
                @click="onSendResetCode"
              >
                {{ resendCooldown > 0 ? `${resendCooldown}s` : t('重新发送') }}
              </button>
            </div>
          </label>

          <label v-if="mode !== 'reset' || resetCodeSent" class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">{{ mode === 'reset' ? t('新密码') : t('密码') }}</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              maxlength="72"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              :placeholder="mode === 'login' ? t('请输入密码') : t('至少 8 位')"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <!-- 注册/重置：确认密码，避免手滑设错 -->
          <label
            v-if="mode === 'register' || (mode === 'reset' && resetCodeSent)"
            class="grid gap-1.5"
          >
            <span class="text-sm font-semibold text-slate-700">{{ t('确认密码') }}</span>
            <input
              v-model="confirmPassword"
              type="password"
              required
              minlength="8"
              maxlength="72"
              autocomplete="new-password"
              :placeholder="t('再次输入密码')"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <p
              v-if="confirmPassword && confirmPassword !== password"
              class="text-xs font-medium text-red-600"
            >
              {{ t('两次输入的密码不一致') }}
            </p>
          </label>

          <!-- 防机器人图片验证码（重置第二步不需要） -->
          <label v-if="mode !== 'reset' || !resetCodeSent" class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">{{ t('图片验证码') }}</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex h-10 w-[132px] shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50"
                :disabled="captchaLoading"
                aria-label="点击更换验证码图片"
                title="看不清？点击换一张"
                @click="refreshCaptcha"
              >
                <img
                  v-if="captchaImage && !captchaLoading"
                  :src="captchaImage"
                  alt="验证码图片"
                  class="h-full w-full object-contain"
                />
                <span v-else class="text-xs text-slate-500">{{
                  captchaLoading ? t('加载中...') : t('加载失败')
                }}</span>
              </button>
              <input
                v-model="captchaAnswer"
                type="text"
                maxlength="6"
                required
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                :placeholder="t('图中字符，不分大小写')"
                aria-label="图片验证码"
                class="h-10 w-full min-w-0 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                class="btn btn-secondary btn-sm h-10 shrink-0"
                :disabled="captchaLoading"
                aria-label="换一张"
                @click="refreshCaptcha"
              >
                {{ t('换一张') }}
              </button>
            </div>
          </label>

          <p v-if="formError" class="text-sm font-medium text-red-600">{{ formError }}</p>

          <button
            type="submit"
            class="btn btn-primary btn-md w-full"
            :disabled="submitting || resetSending"
          >
            {{
              mode === 'register'
                ? submitting
                  ? t('注册中...')
                  : t('注册并登录')
                : mode === 'reset'
                  ? resetCodeSent
                    ? submitting
                      ? t('重置中...')
                      : t('重置密码并登录')
                    : resetSending
                      ? t('发送中...')
                      : t('发送重置验证码')
                  : submitting
                    ? t('登录中...')
                    : t('登录')
            }}
          </button>

          <p class="text-center text-sm text-slate-600">
            <template v-if="mode === 'login'">
              {{ t('还没有账号？') }}
              <button
                type="button"
                class="font-semibold text-brand-600 hover:text-brand-700"
                @click="switchMode('register')"
              >
                {{ t('免费注册') }}
              </button>
              <span class="mx-1.5 text-slate-300">|</span>
              <button
                type="button"
                class="font-semibold text-brand-600 hover:text-brand-700"
                @click="switchMode('reset')"
              >
                {{ t('忘记密码？') }}
              </button>
            </template>
            <template v-else>
              {{ mode === 'register' ? t('已有账号？') : t('想起密码了？') }}
              <button
                type="button"
                class="font-semibold text-brand-600 hover:text-brand-700"
                @click="switchMode('login')"
              >
                {{ t('去登录') }}
              </button>
            </template>
          </p>
        </form>

        <p class="mt-6 text-center text-xs leading-5 text-slate-600">
          {{ t('登录只用于配额与模板同步。名单、照片与排版数据始终只在你的浏览器本地处理，不会上传服务器。') }}
        </p>
      </div>
    </template>

    <!-- 已登录：个人中心 -->
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{{ t('个人中心') }}</h1>
          <p class="mt-1 text-sm text-slate-600">{{ auth.user.email }}</p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 2 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 15.4 6.8 18.2l1-5.9L3.5 8.2l5.9-.9L12 2z" />
          </svg>
          {{ auth.user.pro?.active ? `${t('专业版会员')} · ${proUntilText}` : t('免费版 · 邀请好友或兑换码可开通专业版') }}
        </span>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-2">
        <!-- 今日配额 -->
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">{{ t('今日无水印导出配额') }}</h2>
          <template v-if="auth.user.quota.pro">
            <div class="mt-3 flex items-end gap-2">
              <span class="text-3xl font-bold tracking-tight text-slate-900">{{ t('不限') }}</span>
            </div>
            <p class="mt-2 text-xs leading-5 text-slate-600">
              {{ t('专业版有效期内无水印导出/打印不限次数') }}（{{ proUntilText }}）。
            </p>
          </template>
          <template v-else>
            <div class="mt-3 flex items-end gap-2">
              <span class="text-3xl font-bold tracking-tight text-slate-900">
                {{ auth.user.quota.remaining }}
              </span>
              <span class="pb-1 text-sm text-slate-600">/ {{ auth.user.quota.limit }} {{ t('次剩余') }}</span>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-brand-600 transition-all" :style="{ width: `${quotaPercent}%` }" />
            </div>
            <p class="mt-2 text-xs leading-5 text-slate-600">
              {{ t('仅无水印导出/打印计次，带水印不限次数；每日 0 点恢复为') }} {{ QUOTA_USER_DAILY }} {{ t('次，分享被点开额外赠送（今日已') }} +{{ auth.user.quota.bonus }}）。
            </p>
          </template>
        </section>

        <!-- 分享送次数 -->
        <section id="share" class="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">{{ t('邀请好友 · 双方各送 7 天专业版') }}</h2>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ t('好友通过你的专属链接注册，你和好友各得 7 天专业版，可累计叠加；链接每被点开 1 次还得') }}
            {{ auth.user.share.bonusPerVisit }} {{ t('次无水印导出（服务端去重防刷，每日上限') }}
            {{ auth.user.share.bonusDailyCap }} {{ t('次）。') }}
          </p>
          <div class="mt-3 flex gap-2">
            <input
              :value="shareLink"
              readonly
              class="h-9 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button type="button" class="btn btn-primary btn-sm h-9 shrink-0" @click="copyShareLink">
              {{ t('复制链接') }}
            </button>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-sm mt-2 w-full"
            @click="copyShareText"
          >
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {{ t('一键复制推荐文案（含链接）') }}
          </button>
          <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded bg-slate-50 py-2">
              <dt class="text-[11px] text-slate-600">{{ t('累计访问') }}</dt>
              <dd class="text-sm font-bold text-slate-900">{{ auth.user.share.totalVisits }}</dd>
            </div>
            <div class="rounded bg-slate-50 py-2">
              <dt class="text-[11px] text-slate-600">{{ t('累计获赠') }}</dt>
              <dd class="text-sm font-bold text-slate-900">{{ auth.user.share.totalBonus }}</dd>
            </div>
            <div class="rounded bg-slate-50 py-2">
              <dt class="text-[11px] text-slate-600">{{ t('今日获赠') }}</dt>
              <dd class="text-sm font-bold text-slate-900">
                {{ auth.user.share.bonusToday }}/{{ auth.user.share.bonusDailyCap }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- 兑换码 -->
        <section id="redeem" class="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">{{ t('兑换码开通专业版') }}</h2>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ t('输入兑换码即可开通或延长专业版，天数可累计叠加。兑换码可在官方渠道购买获取。') }}
          </p>
          <form class="mt-3 flex gap-2" @submit.prevent="onRedeem">
            <input
              v-model="redeemCode"
              type="text"
              maxlength="24"
              placeholder="SM-XXXX-XXXX-XXXX"
              class="h-9 min-w-0 flex-1 rounded border border-slate-300 px-2.5 font-mono text-xs tracking-wider text-slate-900 uppercase outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <button type="submit" class="btn btn-primary btn-sm h-9 shrink-0" :disabled="redeeming">
              {{ redeeming ? t('兑换中...') : t('兑换') }}
            </button>
          </form>
          <p v-if="redeemError" class="mt-2 text-xs font-medium text-red-600">{{ redeemError }}</p>
        </section>

        <!-- 云端模板 -->
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">{{ t('我的云端模板') }}</h2>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            {{ t('本设备现有') }} {{ library.customTemplates.length }} {{ t('个自定义模板；云端已存') }}
            {{ auth.user.templateCount }}（{{ formatDate(auth.user.templateUpdatedAt) }}）。
            {{ t('仅同步模板版式结构，不含任何名单数据。') }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="syncing || !library.customTemplates.length"
              @click="onSyncToCloud"
            >
              {{ syncing ? t('同步中...') : t('同步到云端') }}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="restoring || !auth.user.templateCount"
              @click="onRestoreFromCloud"
            >
              {{ restoring ? t('找回中...') : t('从云端找回') }}
            </button>
          </div>
        </section>

        <!-- 使用统计 -->
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">{{ t('使用统计') }}</h2>
          <dl class="mt-3 grid gap-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-slate-600">{{ t('注册时间') }}</dt>
              <dd class="font-medium text-slate-900">{{ formatDate(auth.user.createdAt) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">{{ t('最近登录') }}</dt>
              <dd class="font-medium text-slate-900">{{ formatDate(auth.user.lastLoginAt) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">{{ t('累计登录') }}</dt>
              <dd class="font-medium text-slate-900">{{ auth.user.loginCount }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">{{ t('今日无水印导出') }}</dt>
              <dd class="font-medium text-slate-900">{{ auth.user.quota.used }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p class="text-xs leading-5 text-slate-600">
          {{ t('名单与照片数据从不上云。退出登录后本设备的模板与配额计数仍保留在浏览器本地。') }}
        </p>
        <div class="flex items-center gap-2">
          <RouterLink v-if="auth.user.isAdmin" to="/admin" class="btn btn-secondary btn-sm">
            {{ t('进入管理后台') }}
          </RouterLink>
          <button
            type="button"
            class="btn btn-sm border border-red-200 bg-white text-red-600 hover:bg-red-50"
            :disabled="deleting"
            @click="onDeleteAccount"
          >
            {{ deleting ? t('注销中...') : t('注销账号') }}
          </button>
        </div>
      </div>
    </template>

    <!-- 未登录时也提示当前本地剩余次数 -->
    <p
      v-if="!auth.user && auth.ready"
      class="mx-auto mt-6 max-w-md rounded-lg bg-slate-100 px-4 py-2.5 text-center text-xs text-slate-600"
    >
      {{ t('当前未登录：今日本设备剩余') }} {{ quota.anonRemaining }}/{{ QUOTA_ANON_DAILY }} {{ t('次无水印导出（带水印不限次）') }}
    </p>
  </div>
</template>
