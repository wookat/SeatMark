<script setup lang="ts">
import { computed, ref } from 'vue'

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

// ---------- 登录表单（邮箱 + 密码） ----------
const email = ref('')
const password = ref('')
const mode = ref<'login' | 'register'>('login')
const submitting = ref(false)
const formError = ref('')

async function onSubmit() {
  formError.value = ''
  const emailValue = email.value.trim().toLowerCase()
  if (!isValidEmail(emailValue)) {
    formError.value = '请输入正确的邮箱地址'
    return
  }
  if (password.value.length < 8) {
    formError.value = '密码至少 8 位'
    return
  }
  submitting.value = true
  try {
    if (mode.value === 'register') {
      await auth.register(emailValue, password.value)
      toast.success('注册成功', `已开通专业版 Beta 限时免费试用：每日 ${QUOTA_USER_DAILY} 次无水印导出与云端模板同步已生效`)
    } else {
      await auth.login(emailValue, password.value)
      toast.success('登录成功', `每日 ${QUOTA_USER_DAILY} 次无水印导出与云端模板同步已生效`)
    }
    password.value = ''
  } catch (err) {
    formError.value =
      err instanceof ApiError
        ? err.message
        : mode.value === 'register'
          ? '注册失败，请稍后再试'
          : '登录失败，请稍后再试'
  } finally {
    submitting.value = false
  }
}

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
    toast.success('已同步到云端', `共 ${data.count} 个自定义模板，可在任意设备登录找回`)
  } catch (err) {
    toast.danger('同步失败', err instanceof ApiError ? err.message : '请稍后再试')
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
      toast.success('云端模板已找回', `云端共 ${templates.length} 个模板，新增 ${added} 个到本设备`)
  } catch (err) {
    toast.danger('找回失败', err instanceof ApiError ? err.message : '请稍后再试')
  } finally {
    restoring.value = false
  }
}

// ---------- 账号注销 ----------
const deleting = ref(false)

async function onDeleteAccount() {
  if (!auth.user) return
  const ok = window.confirm(
    '确定注销账号？将删除服务器上与你账号关联的邮箱、云端模板与分享数据，此操作不可恢复。浏览器本地保存的模板不受影响。',
  )
  if (!ok) return
  deleting.value = true
  try {
    await apiFetch('/api/account/delete', { method: 'POST' })
    auth.user = null
    toast.success('账号已注销', '服务器上与你账号关联的个人信息已删除')
  } catch (err) {
    toast.danger('注销失败', err instanceof ApiError ? err.message : '请稍后再试')
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
    toast.success('分享链接已复制', '发给同事或群聊，每被点开 1 次即得 1 次无水印导出')
  } catch {
    toast.warning('复制失败', '请手动复制上方链接')
  }
}

const shareCopyText = computed(
  () =>
    `推荐一个好用的工具：SeatMark 座签，上传 Excel 名单就能批量生成考场座位标签、桌牌、席位卡，排版精确到毫米，数据全程不出浏览器。点我的链接直接用：${shareLink.value}`,
)

async function copyShareText() {
  try {
    await navigator.clipboard.writeText(shareCopyText.value)
    toast.success('推荐文案已复制', '含你的专属链接，直接粘贴到群聊或朋友圈即可')
  } catch {
    toast.warning('复制失败', '请手动复制分享链接')
  }
}

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
            {{ mode === 'register' ? '注册 SeatMark' : '登录 SeatMark' }}
          </h1>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            邮箱 + 密码登录。登录即开通专业版 Beta 限时免费试用：每日
            {{ QUOTA_USER_DAILY }} 次无水印导出（未登录 {{ QUOTA_ANON_DAILY }} 次）、自定义模板云端同步与跨设备找回；带水印导出/打印始终不限次数。
          </p>
        </div>

        <form class="mt-8 grid gap-4" @submit.prevent="onSubmit">
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">邮箱</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">密码</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              maxlength="72"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              :placeholder="mode === 'register' ? '至少 8 位' : '请输入密码'"
              class="h-10 rounded border border-slate-300 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <p v-if="formError" class="text-sm font-medium text-red-600">{{ formError }}</p>

          <button type="submit" class="btn btn-primary btn-md w-full" :disabled="submitting">
            {{
              mode === 'register'
                ? submitting
                  ? '注册中...'
                  : '注册并登录'
                : submitting
                  ? '登录中...'
                  : '登录'
            }}
          </button>

          <p class="text-center text-sm text-slate-600">
            {{ mode === 'register' ? '已有账号？' : '还没有账号？' }}
            <button
              type="button"
              class="font-semibold text-brand-600 hover:text-brand-700"
              @click="mode = mode === 'register' ? 'login' : 'register'; formError = ''"
            >
              {{ mode === 'register' ? '去登录' : '免费注册' }}
            </button>
          </p>
        </form>

        <p class="mt-6 text-center text-xs leading-5 text-slate-600">
          登录只用于配额与模板同步。名单、照片与排版数据始终只在你的浏览器本地处理，不会上传服务器。
        </p>
      </div>
    </template>

    <!-- 已登录：个人中心 -->
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">个人中心</h1>
          <p class="mt-1 text-sm text-slate-600">{{ auth.user.email }}</p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 2 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 15.4 6.8 18.2l1-5.9L3.5 8.2l5.9-.9L12 2z" />
          </svg>
          Beta 会员 · 专业版限时免费试用中
        </span>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-2">
        <!-- 今日配额 -->
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">今日无水印导出配额</h2>
          <div class="mt-3 flex items-end gap-2">
            <span class="text-3xl font-bold tracking-tight text-slate-900">
              {{ auth.user.quota.remaining }}
            </span>
            <span class="pb-1 text-sm text-slate-600">/ {{ auth.user.quota.limit }} 次剩余</span>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-brand-600 transition-all" :style="{ width: `${quotaPercent}%` }" />
          </div>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            仅无水印导出/打印计次，带水印不限次数；每日 0 点恢复为 {{ QUOTA_USER_DAILY }} 次，分享被点开额外赠送（今日已 +{{ auth.user.quota.bonus }}）。
          </p>
        </section>

        <!-- 分享送次数 -->
        <section id="share" class="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">分享送次数</h2>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            把专属链接发给同事或群聊，每被点开 1 次即得 {{ auth.user.share.bonusPerVisit }} 次无水印导出（服务端去重防刷，每日上限
            {{ auth.user.share.bonusDailyCap }} 次）。
          </p>
          <div class="mt-3 flex gap-2">
            <input
              :value="shareLink"
              readonly
              class="h-9 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button type="button" class="btn btn-primary btn-sm h-9 shrink-0" @click="copyShareLink">
              复制链接
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
            一键复制推荐文案（含链接）
          </button>
          <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded bg-slate-50 py-2">
              <dt class="text-[11px] text-slate-600">累计访问</dt>
              <dd class="text-sm font-bold text-slate-900">{{ auth.user.share.totalVisits }}</dd>
            </div>
            <div class="rounded bg-slate-50 py-2">
              <dt class="text-[11px] text-slate-600">累计获赠</dt>
              <dd class="text-sm font-bold text-slate-900">{{ auth.user.share.totalBonus }} 次</dd>
            </div>
            <div class="rounded bg-slate-50 py-2">
              <dt class="text-[11px] text-slate-600">今日获赠</dt>
              <dd class="text-sm font-bold text-slate-900">
                {{ auth.user.share.bonusToday }}/{{ auth.user.share.bonusDailyCap }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- 云端模板 -->
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">我的云端模板</h2>
          <p class="mt-2 text-xs leading-5 text-slate-600">
            本设备现有 {{ library.customTemplates.length }} 个自定义模板；云端已存
            {{ auth.user.templateCount }} 个（{{ formatDate(auth.user.templateUpdatedAt) }} 更新）。
            仅同步模板版式结构，不含任何名单数据。
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="syncing || !library.customTemplates.length"
              @click="onSyncToCloud"
            >
              {{ syncing ? '同步中...' : '同步到云端' }}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="restoring || !auth.user.templateCount"
              @click="onRestoreFromCloud"
            >
              {{ restoring ? '找回中...' : '从云端找回' }}
            </button>
          </div>
        </section>

        <!-- 使用统计 -->
        <section class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
          <h2 class="text-sm font-bold text-slate-900">使用统计</h2>
          <dl class="mt-3 grid gap-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-slate-600">注册时间</dt>
              <dd class="font-medium text-slate-900">{{ formatDate(auth.user.createdAt) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">最近登录</dt>
              <dd class="font-medium text-slate-900">{{ formatDate(auth.user.lastLoginAt) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">累计登录</dt>
              <dd class="font-medium text-slate-900">{{ auth.user.loginCount }} 次</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-600">今日无水印导出</dt>
              <dd class="font-medium text-slate-900">{{ auth.user.quota.used }} 次</dd>
            </div>
          </dl>
        </section>
      </div>

      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p class="text-xs leading-5 text-slate-600">
          名单与照片数据从不上云。退出登录后本设备的模板与配额计数仍保留在浏览器本地。
        </p>
        <div class="flex items-center gap-2">
          <RouterLink v-if="auth.user.isAdmin" to="/admin" class="btn btn-secondary btn-sm">
            进入管理后台
          </RouterLink>
          <button
            type="button"
            class="btn btn-sm border border-red-200 bg-white text-red-600 hover:bg-red-50"
            :disabled="deleting"
            @click="onDeleteAccount"
          >
            {{ deleting ? '注销中...' : '注销账号' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 未登录时也提示当前本地剩余次数 -->
    <p v-if="!auth.user && auth.ready" class="mt-8 text-center text-xs text-slate-600">
      当前未登录：今日本设备剩余 {{ quota.anonRemaining }}/{{ QUOTA_ANON_DAILY }} 次无水印导出（带水印不限次）
    </p>
  </div>
</template>
