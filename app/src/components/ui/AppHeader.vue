<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const avatarLetter = computed(() => (auth.user ? auth.user.email[0]!.toUpperCase() : ''))

function onDocClick(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
  if (route.name === 'account' || route.name === 'admin') {
    await router.push('/')
  }
}

/** 落地页锚点导航：仅首页展示 */
const SECTIONS = [
  { href: '#templates', label: '模板' },
  { href: '#features', label: '功能' },
  { href: '#how', label: '使用流程' },
  { href: '#faq', label: '常见问题' },
]
</script>

<template>
  <header
    class="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
      <RouterLink to="/" class="group flex min-w-0 items-center gap-2.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white"
        >
          <svg class="size-4.5" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="7" height="7" rx="1.2" fill="currentColor" />
            <rect
              x="13.5"
              y="4"
              width="6.5"
              height="7"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <rect
              x="4"
              y="13.5"
              width="7"
              height="6.5"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <rect
              x="13.5"
              y="13.5"
              width="6.5"
              height="6.5"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.6"
            />
          </svg>
        </span>
        <span class="truncate text-base font-bold tracking-tight text-slate-900">
          SeatMark <span class="text-brand-600">座签</span>
        </span>
      </RouterLink>

      <nav
        v-if="route.name === 'home'"
        class="ml-4 hidden items-center gap-1 lg:flex"
        aria-label="页面导航"
      >
        <a
          v-for="section in SECTIONS"
          :key="section.href"
          :href="section.href"
          class="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {{ section.label }}
        </a>
      </nav>

      <nav class="ml-auto flex shrink-0 items-center gap-1.5">
        <span
          class="hidden items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 md:inline-flex"
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
          数据不出浏览器
        </span>
        <RouterLink
          to="/"
          class="btn btn-ghost btn-sm hidden sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': route.name === 'home' }"
        >
          首页
        </RouterLink>
        <RouterLink
          to="/templates"
          class="btn btn-ghost btn-sm"
          :class="{
            'bg-slate-100 text-brand-600':
              route.name === 'templates' || route.name === 'template-detail',
          }"
        >
          模板
        </RouterLink>
        <RouterLink
          to="/guides"
          class="btn btn-ghost btn-sm"
          :class="{
            'bg-slate-100 text-brand-600':
              route.name === 'guides' || route.name === 'guide-article',
          }"
        >
          教程
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="btn btn-ghost btn-sm hidden sm:inline-flex"
          :class="{ 'bg-slate-100 text-brand-600': route.name === 'pricing' }"
        >
          定价
        </RouterLink>
        <RouterLink
          to="/studio"
          class="btn btn-sm"
          :class="route.name === 'studio' ? 'btn-secondary text-brand-600' : 'btn-primary'"
        >
          {{ route.name === 'studio' ? '正在制作中' : '开始制作' }}
        </RouterLink>

        <RouterLink
          v-if="!auth.user"
          to="/account"
          class="btn btn-ghost btn-sm"
          :class="{ 'bg-slate-100 text-brand-600': route.name === 'account' }"
        >
          登录
        </RouterLink>
        <div v-else ref="menuRef" class="relative">
          <button
            type="button"
            class="flex size-8 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white transition-colors hover:bg-brand-700"
            :aria-expanded="menuOpen"
            aria-label="账号菜单"
            @click.stop="menuOpen = !menuOpen"
          >
            {{ avatarLetter }}
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
                  Beta 会员
                </p>
              </div>
              <RouterLink
                to="/account"
                class="mt-1 block rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                @click="menuOpen = false"
              >
                个人中心
              </RouterLink>
              <RouterLink
                v-if="auth.user.isAdmin"
                to="/admin"
                class="block rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                @click="menuOpen = false"
              >
                管理后台
              </RouterLink>
              <button
                type="button"
                class="block w-full cursor-pointer rounded px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                @click="onLogout"
              >
                退出登录
              </button>
            </div>
          </Transition>
        </div>
      </nav>
    </div>
  </header>
</template>
