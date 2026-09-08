<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import BrandMark from '@/components/ui/BrandMark.vue'
import { localePath, rememberLocale, stripLocalePrefix, t, useI18n } from '@/i18n'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()

/** 去掉 en- 前缀的路由名，zh/en 镜像路由共用高亮判断 */
const routeName = computed(() => String(route.name ?? '').replace(/^en-/, ''))

/** 语言切换：同一页面的 zh/en 对应路径 */
const switchTarget = computed(() =>
  locale.value === 'en' ? stripLocalePrefix(route.path) : localePath(route.path, 'en'),
)

function onSwitchLocale() {
  rememberLocale(locale.value === 'en' ? 'zh' : 'en')
}

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

/** 「排座」场景下拉：教室座位表 / 宴会排桌 */
const seatingOpen = ref(false)
const seatingRef = ref<HTMLElement | null>(null)
const SEATING_LINKS = computed(() => [
  { to: '/seating', name: 'seating', label: t('教室座位表') },
  { to: '/banquet', name: 'banquet', label: t('宴会排桌') },
])
const seatingActive = computed(() => SEATING_LINKS.value.some((l) => l.name === routeName.value))
/** 悬停展开后的首次点击视为“钉住”而非关闭，避免鼠标用户点击即消失 */
const seatingByHover = ref(false)

function onSeatingEnter() {
  if (!seatingOpen.value) seatingByHover.value = true
  seatingOpen.value = true
}

function onSeatingLeave() {
  seatingOpen.value = false
  seatingByHover.value = false
}

function onSeatingClick() {
  if (seatingOpen.value && seatingByHover.value) {
    seatingByHover.value = false
    return
  }
  seatingOpen.value = !seatingOpen.value
}

const avatarLetter = computed(() => (auth.user ? auth.user.email[0]!.toUpperCase() : ''))

/** <sm 汉堡抽屉：全部一级入口（桌面端内联导航不变） */
const drawerOpen = ref(false)
const drawerRef = ref<HTMLElement | null>(null)
const DRAWER_LINKS = computed(() => [
  { to: '/', name: 'home', label: t('首页') },
  { to: '/templates', name: 'templates', label: t('模板') },
  { to: '/seating', name: 'seating', label: t('教室座位表') },
  { to: '/banquet', name: 'banquet', label: t('宴会排桌') },
  { to: '/guides', name: 'guides', label: t('教程') },
  { to: '/pricing', name: 'pricing', label: t('定价') },
  { to: '/vs', name: 'vs-index', label: t('工具对比选型') },
  { to: '/papers', name: 'papers', label: t('不干胶纸型库') },
])

function onDocClick(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    menuOpen.value = false
  }
  if (seatingRef.value && !seatingRef.value.contains(event.target as Node)) {
    seatingOpen.value = false
  }
  if (drawerRef.value && !drawerRef.value.contains(event.target as Node)) {
    drawerOpen.value = false
  }
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerOpen.value) drawerOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKeydown)
})

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
  if (routeName.value === 'account' || routeName.value === 'admin') {
    await router.push(localePath('/'))
  }
}

/** 落地页锚点导航：仅首页展示 */
const SECTIONS = computed(() => [
  { href: '#templates', label: t('精选模板') },
  { href: '#features', label: t('功能') },
  { href: '#how', label: t('使用流程') },
  { href: '#faq', label: t('常见问题') },
])
</script>

<template>
  <header
    class="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3">
      <RouterLink
        :to="localePath('/')"
        class="group flex shrink-0 items-center gap-2.5 max-md:min-h-11 max-md:min-w-11"
        :aria-label="t('返回首页')"
        data-testid="brand-link"
      >
        <BrandMark class="size-8 shrink-0 text-brand-600" />
        <span class="text-base font-bold tracking-tight whitespace-nowrap text-slate-900">
          <template v-if="locale === 'en'"><span class="hidden lg:inline">Seat<span class="text-brand-600">Mark</span></span></template>
          <template v-else><span class="hidden md:inline">SeatMark </span><span class="text-brand-600">座签</span></template>
        </span>
      </RouterLink>

      <nav
        v-if="routeName === 'home' && locale !== 'en'"
        class="ml-4 hidden items-center gap-1 lg:flex"
        :aria-label="t('页面导航')"
      >
        <a
          v-for="section in SECTIONS"
          :key="section.href"
          :href="section.href"
          class="rounded-lg px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {{ section.label }}
        </a>
      </nav>

      <nav class="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <span
          v-if="routeName !== 'home'"
          class="hidden items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
          :class="locale === 'en' ? 'xl:inline-flex' : 'lg:inline-flex'"
        >
          <svg
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
          </svg>
          {{ t('数据不出浏览器') }}
        </span>
        <RouterLink
          :to="localePath('/')"
          class="btn btn-ghost btn-sm hidden sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': routeName === 'home' }"
        >
          {{ t('首页') }}
        </RouterLink>
        <RouterLink
          :to="localePath('/templates')"
          class="btn btn-ghost btn-sm max-md:min-h-11 max-md:min-w-11 max-sm:px-1.5"
          :class="{
            'bg-slate-100 text-brand-600':
              routeName === 'templates' || routeName === 'template-detail',
          }"
        >
          {{ t('模板') }}
        </RouterLink>
        <div
          ref="seatingRef"
          class="relative hidden sm:block"
          data-testid="nav-seating"
          @mouseenter="onSeatingEnter"
          @mouseleave="onSeatingLeave"
        >
          <button
            type="button"
            class="btn btn-ghost btn-sm whitespace-nowrap"
            :class="{ 'bg-slate-100 text-brand-600': seatingActive || seatingOpen }"
            :aria-expanded="seatingOpen"
            aria-haspopup="true"
            @click.stop="onSeatingClick"
          >
            {{ t('排座') }}
            <svg class="size-3 transition-transform" :class="{ 'rotate-180': seatingOpen }" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
          <div
            v-if="seatingOpen"
            class="absolute left-0 top-9 z-50 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-pop"
            role="menu"
          >
            <RouterLink
              v-for="link in SEATING_LINKS"
              :key="link.to"
              :to="localePath(link.to)"
              class="block rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              :class="{ 'text-brand-600': routeName === link.name }"
              role="menuitem"
              @click="seatingOpen = false"
            >
              {{ link.label }}
            </RouterLink>
          </div>
        </div>
        <RouterLink
          :to="localePath('/guides')"
          class="btn btn-ghost btn-sm hidden max-md:min-h-11 max-md:min-w-11 sm:inline-flex"
          :class="{
            'bg-slate-100 text-brand-600':
              routeName === 'guides' || routeName === 'guide-article',
          }"
        >
          {{ t('教程') }}
        </RouterLink>
        <RouterLink
          :to="localePath('/pricing')"
          class="btn btn-ghost btn-sm hidden sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': routeName === 'pricing' }"
        >
          {{ t('定价') }}
        </RouterLink>
        <!-- 工坊页内：CTA 变为当前页标识（非链接，aria-current=page），避免自链自己 -->
        <span
          v-if="routeName === 'studio'"
          class="btn btn-sm btn-secondary pointer-events-none text-brand-600 max-sm:px-2"
          aria-current="page"
          data-testid="header-studio-current"
        >
          {{ locale === 'en' ? 'Studio' : t('标签工坊') }}
        </span>
        <RouterLink
          v-else
          :to="localePath('/studio')"
          class="btn btn-sm btn-primary max-md:min-h-11 max-sm:px-2"
        >
          <template v-if="locale === 'en'">
            <span class="sm:hidden">Start</span>
            <span class="hidden sm:inline">{{ t('开始制作') }}</span>
          </template>
          <template v-else>{{ t('开始制作') }}</template>
        </RouterLink>

        <RouterLink
          :to="switchTarget"
          class="btn btn-ghost btn-sm hidden max-md:min-h-11 max-md:min-w-11 sm:inline-flex"
          :aria-label="locale === 'en' ? t('切换到中文') : 'Switch to English'"
          :title="locale === 'en' ? '中文' : 'English'"
          @click="onSwitchLocale"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span class="hidden md:inline" :lang="locale === 'en' ? 'zh' : undefined">{{ locale === 'en' ? '中文' : 'EN' }}</span>
        </RouterLink>

        <RouterLink
          v-if="!auth.user"
          :to="localePath('/account')"
          class="btn btn-ghost btn-sm hidden max-md:min-h-11 max-md:min-w-11 sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': routeName === 'account' }"
        >
          {{ t('登录') }}
        </RouterLink>
        <div v-else ref="menuRef" class="relative">
          <button
            type="button"
            class="group/avatar flex cursor-pointer items-center justify-center max-md:min-h-11 max-md:min-w-11"
            :aria-expanded="menuOpen"
            :aria-label="t('账号菜单')"
            @click.stop="menuOpen = !menuOpen"
          >
            <span
              class="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white transition-colors group-hover/avatar:bg-brand-700"
            >
              {{ avatarLetter }}
            </span>
          </button>
          <Transition
            enter-active-class="transition duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition duration-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="menuOpen"
              class="absolute right-0 top-10 z-50 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-pop"
            >
              <div class="border-b border-slate-100 px-3 py-2">
                <p class="truncate text-sm font-semibold text-slate-900">{{ auth.user.email }}</p>
                <p class="mt-0.5 inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                  <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m12 2 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 15.4 6.8 18.2l1-5.9L3.5 8.2l5.9-.9L12 2z" />
                  </svg>
                  {{ auth.user.pro?.active ? t('专业版会员') : t('免费版') }}
                </p>
              </div>
              <RouterLink
                :to="localePath('/account')"
                class="mt-1 block rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                @click="menuOpen = false"
              >
                {{ t('个人中心') }}
              </RouterLink>
              <RouterLink
                v-if="auth.user.isAdmin"
                to="/admin"
                class="block rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                @click="menuOpen = false"
              >
                {{ t('管理后台') }}
              </RouterLink>
              <button
                type="button"
                class="block w-full cursor-pointer rounded px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                @click="onLogout"
              >
                {{ t('退出登录') }}
              </button>
            </div>
          </Transition>
        </div>

        <div ref="drawerRef" class="sm:hidden" data-testid="nav-drawer">
          <button
            type="button"
            class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
            :class="{ 'bg-slate-100 text-brand-600': drawerOpen }"
            :aria-label="drawerOpen ? t('关闭菜单') : t('打开菜单')"
            :aria-expanded="drawerOpen"
            aria-controls="mobile-nav-drawer"
            data-testid="nav-drawer-toggle"
            @click.stop="drawerOpen = !drawerOpen"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <template v-if="drawerOpen"><path d="m6 6 12 12M18 6 6 18" /></template>
              <template v-else><path d="M4 7h16M4 12h16M4 17h16" /></template>
            </svg>
          </button>
          <Transition
            enter-active-class="transition duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition duration-100"
            leave-to-class="opacity-0"
          >
            <nav
              v-if="drawerOpen"
              id="mobile-nav-drawer"
              class="absolute inset-x-0 top-14 z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-slate-200 bg-white px-3 py-2 shadow-pop"
              :aria-label="t('站点导航')"
            >
              <RouterLink
                v-for="link in DRAWER_LINKS"
                :key="link.to"
                :to="localePath(link.to)"
                class="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                :class="{ 'bg-slate-50 text-brand-600': routeName === link.name }"
                @click="drawerOpen = false"
              >
                {{ link.label }}
              </RouterLink>
              <div class="my-1.5 border-t border-slate-100" />
              <RouterLink
                :to="localePath('/account')"
                class="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                :class="{ 'bg-slate-50 text-brand-600': routeName === 'account' }"
                data-testid="nav-drawer-account"
                @click="drawerOpen = false"
              >
                {{ auth.user ? t('个人中心') : t('登录') }}
              </RouterLink>
              <RouterLink
                :to="switchTarget"
                class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                data-testid="nav-drawer-locale"
                @click="onSwitchLocale(); drawerOpen = false"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span :lang="locale === 'en' ? 'zh' : undefined">{{ locale === 'en' ? '中文' : 'English' }}</span>
              </RouterLink>
            </nav>
          </Transition>
        </div>
      </nav>
    </div>
  </header>
</template>
