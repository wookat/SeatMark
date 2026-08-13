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
  storage: 'kv' | 'blob' | 'memory'
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

interface Health {
  kvBound: boolean
  blobAvailable: boolean
  storage: 'kv' | 'blob' | 'memory'
  mailConfigured: boolean
  mailChannel: 'tencent-ses' | 'resend' | 'none'
  authSecretConfigured: boolean
}

interface Reservation {
  email: string
  teamSize: string
  note: string
  createdAt: string
}

interface CodeBatch {
  batch: string
  days: number
  count: number
  note: string
  createdAt: string
  masked: string[]
  /** 历史批次遗留的明文码（新批次服务端只存哈希，无此字段） */
  legacyCodes?: string[]
  used: number
}

const auth = useAuthStore()
const toast = useToastStore()

const loading = ref(true)
const forbidden = ref(false)
const overview = ref<Overview | null>(null)
const health = ref<Health | null>(null)
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
    const [ov, he, us, fb, rs, an] = await Promise.all([
      apiFetch<Overview>('/api/admin/overview'),
      apiFetch<Health>('/api/admin/health'),
      apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
      apiFetch<{ items: FeedbackItem[] }>('/api/admin/feedback'),
      apiFetch<{ items: Reservation[] }>('/api/admin/reservations'),
      apiFetch<{ announcement: { text: string; enabled: boolean } | null }>(
        '/api/admin/announcement',
      ),
    ])
    overview.value = ov
    health.value = he
    users.value = us.users
    feedback.value = fb.items
    reservations.value = rs.items
    if (an.announcement) {
      announcementText.value = an.announcement.text
      announcementEnabled.value = an.announcement.enabled
    }
    void loadCodeBatches()
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

// ---------- 兑换码 ----------
const codeBatches = ref<CodeBatch[]>([])
const codeDays = ref('30')
const codeCount = ref('10')
const codeNote = ref('')
const generatingCodes = ref(false)
// 明文码仅在生成响应中返回一次，刷新即不可再取，展示供管理员导出
const freshCodes = ref<string[]>([])

async function loadCodeBatches() {
  try {
    const data = await apiFetch<{ batches: CodeBatch[] }>('/api/admin/codes')
    codeBatches.value = data.batches
  } catch {
    // 非关键面板，静默失败
  }
}

async function generateCodes() {
  const days = Number(codeDays.value)
  const count = Number(codeCount.value)
  if (!Number.isInteger(days) || days < 1 || !Number.isInteger(count) || count < 1) {
    toast.warning('参数不正确', '天数与数量需为正整数')
    return
  }
  generatingCodes.value = true
  try {
    const data = await apiFetch<{ codes: string[] }>('/api/admin/codes', {
      method: 'POST',
      body: { days, count, note: codeNote.value.trim() },
    })
    freshCodes.value = data.codes
    await navigator.clipboard.writeText(data.codes.join('\n')).catch(() => {})
    toast.success('兑换码已生成', `共 ${data.codes.length} 个，请立即复制保存——服务端只存哈希，离开页面后无法再查看明文`)
    await loadCodeBatches()
  } catch (err) {
    toast.danger('生成失败', err instanceof ApiError ? err.message : '请稍后再试')
  } finally {
    generatingCodes.value = false
  }
}

async function copyCodes(codes: string[]) {
  try {
    await navigator.clipboard.writeText(codes.join('\n'))
    toast.success('已复制', `${codes.length} 个兑换码已复制，可直接粘贴到卡网库存`)
  } catch {
    toast.warning('复制失败', '请手动复制')
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

const MAIL_CHANNEL_TEXT: Record<Health['mailChannel'], string> = {
  'tencent-ses': '当前通道：腾讯云 SES（TENCENT_SES_*），验证码正常发送',
  resend: '当前通道：Resend（RESEND_API_KEY），验证码正常发送',
  none: '未配置邮件通道（TENCENT_SES_* 或 RESEND_API_KEY），线上无法发送登录验证码',
}

const HEALTH_ITEMS = computed<
  {
    key: Exclude<keyof Health, 'storage' | 'mailChannel'>
    name: string
    okText: string
    badText: string
  }[]
>(() => [
  {
    key: 'kvBound',
    name: 'KV 存储',
    okText: '已绑定 EdgeOne KV，数据持久化',
    badText: '未绑定 KV，数据仅存内存不持久（控制台 → KV 存储 → 绑定变量名 seatmark_kv）',
  },
  {
    key: 'blobAvailable',
    name: 'Blob 存储',
    okText: 'EdgeOne Pages Blob 可用（KV 未绑定时作为持久化后备，云端模板优先存储）',
    badText: 'Blob 不可用（未安装 @edgeone/pages-blob 依赖或探测失败）；KV 未绑定时将降级内存存储',
  },
  {
    key: 'mailConfigured',
    name: '邮件服务',
    okText: MAIL_CHANNEL_TEXT[health.value?.mailChannel ?? 'none'],
    badText: MAIL_CHANNEL_TEXT.none,
  },
  {
    key: 'authSecretConfigured',
    name: '会话密钥',
    okText: 'AUTH_SECRET 已配置',
    badText: '未配置 AUTH_SECRET，正在使用开发默认密钥（不安全，请尽快配置）',
  },
])

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
        :class="overview.storage === 'memory' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'"
      >
        存储：{{ overview.storage === 'kv' ? 'EdgeOne KV（持久化）' : overview.storage === 'blob' ? 'EdgeOne Blob（持久化后备）' : '内存（KV/Blob 均不可用，数据不持久）' }}
      </span>
    </div>

    <div v-if="loading" class="mt-10 text-center text-sm text-slate-600">加载中...</div>

    <div v-else-if="forbidden" class="mt-10 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p class="text-sm font-semibold text-slate-900">需要管理员权限</p>
      <p class="mt-2 text-sm text-slate-600">
        请使用管理员白名单邮箱登录后访问（白名单由 ADMIN_EMAILS 环境变量配置）。
      </p>
      <RouterLink to="/account" class="btn btn-primary btn-sm mt-4">去登录</RouterLink>
    </div>

    <template v-else-if="overview">
      <!-- 指标卡片 -->
      <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-600">注册用户（Beta 试用）</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.totalUsers }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-600">今日无水印导出（登录用户）</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.usageToday }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-600">今日活跃试用用户</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.activeTrialToday }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-600">云端模板（用户 / 总数）</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">
            {{ overview.templateSyncUsers }} / {{ overview.templateTotal }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <p class="text-xs text-slate-600">今日分享送无水印次数</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ overview.shareBonusToday }}</p>
        </div>
      </div>

      <!-- 环境健康检查 -->
      <section v-if="health" class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">环境健康检查</h2>
        <p class="mt-1 text-xs text-slate-600">在 EdgeOne Pages 控制台完成配置后刷新本页自检。</p>
        <ul class="mt-3 grid gap-2 sm:grid-cols-2">
          <li
            v-for="item in HEALTH_ITEMS"
            :key="item.key"
            class="flex items-start gap-2.5 rounded-lg border p-3"
            :class="health[item.key] ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'"
          >
            <span
              class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white"
              :class="health[item.key] ? 'bg-emerald-500' : 'bg-amber-500'"
            >
              <svg v-if="health[item.key]" class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
              <svg v-else class="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <path d="M8 3.5v6m0 2.5v.5" />
              </svg>
            </span>
            <span>
              <span class="block text-xs font-bold text-slate-900">{{ item.name }}</span>
              <span class="mt-0.5 block text-[11px] leading-4 text-slate-600">
                {{ health[item.key] ? item.okText : item.badText }}
              </span>
            </span>
          </li>
        </ul>
      </section>

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
        <div class="mt-1 flex justify-between text-[10px] text-slate-600">
          <span>{{ overview.growth[0]?.date }}</span>
          <span>{{ overview.growth[overview.growth.length - 1]?.date }}</span>
        </div>
      </section>

      <!-- 兑换码管理 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">兑换码管理</h2>
        <p class="mt-1 text-xs text-slate-600">
          批量生成专业版兑换码（可导出到卡网售卖）；用户在个人中心输入兑换码即开通/延长，天数可叠加。服务端只存哈希：明文码仅在生成时展示一次，请及时导出保存。
        </p>
        <div class="mt-3 flex flex-wrap items-end gap-3">
          <label class="grid gap-1">
            <span class="text-xs font-semibold text-slate-700">天数</span>
            <input v-model="codeDays" type="number" min="1" max="3660" class="h-9 w-24 rounded border border-slate-300 px-2.5 text-sm" />
          </label>
          <label class="grid gap-1">
            <span class="text-xs font-semibold text-slate-700">数量</span>
            <input v-model="codeCount" type="number" min="1" max="200" class="h-9 w-24 rounded border border-slate-300 px-2.5 text-sm" />
          </label>
          <label class="grid min-w-[160px] flex-1 gap-1">
            <span class="text-xs font-semibold text-slate-700">备注（选填）</span>
            <input v-model="codeNote" type="text" maxlength="100" placeholder="如：卡网月卡第一批" class="h-9 rounded border border-slate-300 px-2.5 text-sm" />
          </label>
          <button type="button" class="btn btn-primary btn-sm h-9" :disabled="generatingCodes" @click="generateCodes">
            {{ generatingCodes ? '生成中...' : '生成兑换码' }}
          </button>
        </div>
        <div v-if="freshCodes.length" class="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-bold text-amber-800">本次生成的 {{ freshCodes.length }} 个兑换码（仅展示一次，离开页面后不可再查）</p>
            <button type="button" class="btn btn-secondary btn-sm" @click="copyCodes(freshCodes)">复制全部码</button>
          </div>
          <textarea
            readonly
            :value="freshCodes.join('\n')"
            :rows="Math.min(8, freshCodes.length)"
            class="mt-2 w-full rounded border border-amber-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-800"
            aria-label="本次生成的兑换码列表"
          />
        </div>
        <div v-if="codeBatches.length" class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs text-slate-600">
                <th class="py-2 pr-3 font-semibold">生成时间</th>
                <th class="py-2 pr-3 font-semibold">天数</th>
                <th class="py-2 pr-3 font-semibold">数量</th>
                <th class="py-2 pr-3 font-semibold">已兑换</th>
                <th class="py-2 pr-3 font-semibold">备注</th>
                <th class="py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in codeBatches" :key="b.batch" class="border-b border-slate-100">
                <td class="py-2 pr-3 text-slate-600">{{ formatDate(b.createdAt) }}</td>
                <td class="py-2 pr-3 font-medium text-slate-900">{{ b.days }} 天</td>
                <td class="py-2 pr-3 text-slate-600">{{ b.count }}</td>
                <td class="py-2 pr-3 text-slate-600">{{ b.used }}/{{ b.count }}</td>
                <td class="max-w-[180px] truncate py-2 pr-3 text-slate-600" :title="b.note">{{ b.note || '—' }}</td>
                <td class="py-2">
                  <button v-if="b.legacyCodes?.length" type="button" class="btn btn-secondary btn-sm" @click="copyCodes(b.legacyCodes!)">复制全部码</button>
                  <span v-else class="text-xs text-slate-500" :title="(b.masked || []).join('\n')">末4位：{{ (b.masked || []).slice(0, 3).map((m) => m.slice(-4)).join(' / ') }}{{ (b.masked || []).length > 3 ? ' …' : '' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mt-3 text-center text-xs text-slate-600">暂无兑换码批次</p>
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
              <tr class="border-b border-slate-200 text-xs text-slate-600">
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
                <td class="py-2 pr-3 text-slate-600">{{ formatDate(u.createdAt) }}</td>
                <td class="py-2 pr-3 text-slate-600">{{ formatDate(u.lastLoginAt) }}</td>
                <td class="py-2 pr-3 text-slate-600">{{ u.loginCount }}</td>
                <td class="py-2 text-slate-600">{{ u.templateCount || 0 }}</td>
              </tr>
              <tr v-if="!users.length">
                <td colspan="5" class="py-6 text-center text-slate-600">暂无注册用户</td>
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
              <tr class="border-b border-slate-200 text-xs text-slate-600">
                <th class="py-2 pr-3 font-semibold">邮箱</th>
                <th class="py-2 pr-3 font-semibold">团队规模</th>
                <th class="py-2 pr-3 font-semibold">备注</th>
                <th class="py-2 font-semibold">登记时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reservations" :key="r.email + r.createdAt" class="border-b border-slate-100">
                <td class="py-2 pr-3 font-medium text-slate-900">{{ r.email }}</td>
                <td class="py-2 pr-3 text-slate-600">{{ r.teamSize || '—' }}</td>
                <td class="max-w-[240px] truncate py-2 pr-3 text-slate-600" :title="r.note">{{ r.note || '—' }}</td>
                <td class="py-2 text-slate-600">{{ formatDate(r.createdAt) }}</td>
              </tr>
              <tr v-if="!reservations.length">
                <td colspan="4" class="py-6 text-center text-slate-600">暂无预订登记</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 反馈 -->
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <h2 class="text-sm font-bold text-slate-900">用户反馈（{{ feedback.length }}）</h2>
        <p class="mt-1 text-xs text-slate-600">
          KV 存档的反馈列表；同时仍会实时推送到企业微信群（见 /api/feedback）。
        </p>
        <ul class="mt-3 grid gap-3">
          <li v-for="(f, i) in feedback" :key="i" class="rounded border border-slate-100 bg-slate-50 p-3">
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span class="rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-700">
                {{ FEEDBACK_LABEL[f.type] || f.type }}
              </span>
              <span>{{ formatDate(f.createdAt) }}</span>
              <span v-if="f.page" class="truncate">页面：{{ f.page }}</span>
              <span v-if="f.contact">联系：{{ f.contact }}</span>
            </div>
            <p class="mt-1.5 text-sm leading-6 text-slate-700">{{ f.content }}</p>
          </li>
          <li v-if="!feedback.length" class="py-6 text-center text-sm text-slate-600">
            暂无 KV 存档反馈（未绑定 KV 时反馈仅推送企业微信）
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
