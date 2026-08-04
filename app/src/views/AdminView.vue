<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { apiFetch, ApiError } from '@/utils/api'

interface Overview {
  totalUsers: number
  growth: { date: string; count: number }[]
  templateSyncUsers: number
  templateTotal: number
  usageToday: number
  trialUsers: number
  activeTrialToday: number
  shareBonusToday: number
  reservationCount: number
  feedbackCount: number
  storage: 'kv' | 'memory'
}

interface AdminUser {
  email: string
  createdAt: string
  lastLoginAt: string
  loginCount: number
  templateCount?: number
}

interface FeedbackItem {
  type: string
  content: string
  contact: string
  page: string
  createdAt: string
}

interface Reservation {
  email: string
  teamSize: string
  note: string
  createdAt: string
}

const auth = useAuthStore()
const toast = useToastStore()

const loading = ref(true)
const forbidden = ref(false)
const overview = ref<Overview | null>(null)
const users = ref<AdminUser[]>([])
const feedback = ref<FeedbackItem[]>([])
const reservations = ref<Reservation[]>([])

const announcementText = ref('')
const announcementEnabled = ref(false)
const savingAnnouncement = ref(false)

const maxGrowth = computed(() =>
  overview.value ? Math.max(1, ...overview.value.growth.map((g) => g.count)) : 1,
)

async function loadAll() {
  loading.value = true
  forbidden.value = false
  try {
    const [ov, us, fb, rs, an] = await Promise.all([
      apiFetch<Overview>('/api/admin/overview'),
      apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
      apiFetch<{ items: FeedbackItem[] }>('/api/admin/feedback'),
      apiFetch<{ items: Reservation[] }>('/api/admin/reservations'),
      apiFetch<{ announcement: { text: string; enabled: boolean } | null }>(
        '/api/admin/announcement',
      ),
    ])
    overview.value = ov
    users.value = us.users
    feedback.value = fb.items
    reservations.value = rs.items
    if (an.announcement) {
      announcementText.value = an.announcement.text
      announcementEnabled.value = an.announcement.enabled
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      forbidden.value = true
    } else {
      toast.danger('加载失败', err instanceof ApiError ? err.message : '请稍后再试')
    }
  } finally {
    loading.value = false
  }
}

async function saveAnnouncement() {
  savingAnnouncement.value = true
  try {
    await apiFetch('/api/admin/announcement', {
      method: 'PUT',
      body: { text: announcementText.value, enabled: announcementEnabled.value },
    })
    toast.success('公告已保存', announcementEnabled.value ? '全站顶部横幅已启用' : '公告已停用')
  } catch (err) {
    toast.danger('保存失败', err instanceof ApiError ? err.message : '请稍后再试')
  } finally {
    savingAnnouncement.value = false
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

const FEEDBACK_LABEL: Record<string, string> = {
  bug: 'Bug',
  suggestion: '建议',
  other: '其他',
}

onMounted(() => {
  if (auth.ready) void loadAll()
})

watch(
  () => auth.ready,
  (ready) => {
    if (ready) void loadAll()
  },
)
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">管理后台</h1>
      <span
        v-if="overview"
        class="rounded px-2.5 py-1 text-[11px] font-semibold"
        :class="overview.storage === 'kv' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'"
      >
        存储：{{ overview.storage === 'kv' ? 'EdgeOne KV（持久化）' : '内存（未绑定 KV，数据不持久）' }}
      </span>
    </div>

    <div v-if="loading" class="mt-10 text-center text-sm text-slate-500">加载中...</div>

    <div v-else-if="forbidden" class="mt-10 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p class="text-sm font-semibold text-slate-900">需要管理员权限</p>
      <p class="mt-2 text-sm text-slate-500">
        请使用管理员白名单邮箱登录后访问（白名单由 ADMIN_EMAILS 环境变量配置）。
      </p>
      <RouterLink to="/account" class="btn btn-primary btn-sm mt-4">去登录</RouterLink>
    </div>

    <template v-else-if="overview">
      <!-- 指标卡片 -->
      <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-500">注册用户（Beta 试用）</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.totalUsers }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-500">今日无水印导出（登录用户）</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.usageToday }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-500">今日活跃试用用户</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.activeTrialToday }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-500">云端模板（用户 / 总数）</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">
            {{ overview.templateSyncUsers }} / {{ overview.templateTotal }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-500">今日分享送无水印次数</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.shareBonusToday }}</p>
        </div>
      </div>

      <!-- 增长曲线 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">近 14 天注册增长</h2>
        <div class="mt-4 flex h-32 items-end gap-1.5">
          <div
            v-for="g in overview.growth"
            :key="g.date"
            class="group relative flex-1 rounded-t bg-brand-200 transition-colors hover:bg-brand-400"
            :style="{ height: `${Math.max(4, (g.count / maxGrowth) * 100)}%` }"
          >
            <span
              class="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block"
            >
              {{ g.date.slice(5) }}：{{ g.count }}
            </span>
          </div>
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{{ overview.growth[0]?.date }}</span>
          <span>{{ overview.growth[overview.growth.length - 1]?.date }}</span>
        </div>
      </section>

      <!-- 公告配置 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">公告配置</h2>
        <div class="mt-3 grid gap-3">
          <textarea
            v-model="announcementText"
            rows="2"
            maxlength="500"
            placeholder="公告内容（全站顶部横幅展示）"
            class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input v-model="announcementEnabled" type="checkbox" class="size-4 accent-brand-600" />
              启用公告横幅
            </label>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="savingAnnouncement"
              @click="saveAnnouncement"
            >
              {{ savingAnnouncement ? '保存中...' : '保存公告' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 用户列表 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">用户列表（{{ users.length }}）</h2>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs text-slate-500">
                <th class="py-2 pr-3 font-semibold">邮箱</th>
                <th class="py-2 pr-3 font-semibold">注册时间</th>
                <th class="py-2 pr-3 font-semibold">最近登录</th>
                <th class="py-2 pr-3 font-semibold">登录次数</th>
                <th class="py-2 font-semibold">云端模板</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.email" class="border-b border-slate-100">
                <td class="py-2 pr-3 font-medium text-slate-900">{{ u.email }}</td>
                <td class="py-2 pr-3 text-slate-500">{{ formatDate(u.createdAt) }}</td>
                <td class="py-2 pr-3 text-slate-500">{{ formatDate(u.lastLoginAt) }}</td>
                <td class="py-2 pr-3 text-slate-500">{{ u.loginCount }}</td>
                <td class="py-2 text-slate-500">{{ u.templateCount || 0 }}</td>
              </tr>
              <tr v-if="!users.length">
                <td colspan="5" class="py-6 text-center text-slate-400">暂无注册用户</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 团队版意向名单 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">团队版预订意向（{{ reservations.length }}）</h2>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs text-slate-500">
                <th class="py-2 pr-3 font-semibold">邮箱</th>
                <th class="py-2 pr-3 font-semibold">团队规模</th>
                <th class="py-2 pr-3 font-semibold">备注</th>
                <th class="py-2 font-semibold">登记时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reservations" :key="r.email + r.createdAt" class="border-b border-slate-100">
                <td class="py-2 pr-3 font-medium text-slate-900">{{ r.email }}</td>
                <td class="py-2 pr-3 text-slate-500">{{ r.teamSize || '—' }}</td>
                <td class="max-w-[240px] truncate py-2 pr-3 text-slate-500" :title="r.note">{{ r.note || '—' }}</td>
                <td class="py-2 text-slate-500">{{ formatDate(r.createdAt) }}</td>
              </tr>
              <tr v-if="!reservations.length">
                <td colspan="4" class="py-6 text-center text-slate-400">暂无预订登记</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 反馈 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">用户反馈（{{ feedback.length }}）</h2>
        <p class="mt-1 text-xs text-slate-400">
          KV 存档的反馈列表；同时仍会实时推送到企业微信群（见 /api/feedback）。
        </p>
        <ul class="mt-3 grid gap-3">
          <li v-for="(f, i) in feedback" :key="i" class="rounded border border-slate-100 bg-slate-50 p-3">
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span class="rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-700">
                {{ FEEDBACK_LABEL[f.type] || f.type }}
              </span>
              <span>{{ formatDate(f.createdAt) }}</span>
              <span v-if="f.page" class="truncate">页面：{{ f.page }}</span>
              <span v-if="f.contact">联系：{{ f.contact }}</span>
            </div>
            <p class="mt-1.5 text-sm leading-6 text-slate-700">{{ f.content }}</p>
          </li>
          <li v-if="!feedback.length" class="py-6 text-center text-sm text-slate-400">
            暂无 KV 存档反馈（未绑定 KV 时反馈仅推送企业微信）
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
