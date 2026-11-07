<script setup lang="ts">
import { CHANGELOG_ENTRY_COUNT, CHANGELOG_GENERATED_AT, changelogDays, type ChangelogKind } from '@/data/changelog'
import { t, useI18n } from '@/i18n'

const { locale } = useI18n()

const KIND_LABEL: Record<ChangelogKind, { zh: string; en: string; cls: string }> = {
  feature: { zh: '新功能', en: 'Feature', cls: 'bg-brand-50 text-brand-700 ring-brand-200' },
  improve: { zh: '改进', en: 'Improved', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  fix: { zh: '修复', en: 'Fix', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

const kindLabel = (kind: ChangelogKind) => (locale.value === 'en' ? KIND_LABEL[kind].en : KIND_LABEL[kind].zh)

const statsLine = () =>
  locale.value === 'en'
    ? `${CHANGELOG_ENTRY_COUNT} entries · generated ${CHANGELOG_GENERATED_AT}`
    : `共 ${CHANGELOG_ENTRY_COUNT} 条记录 · 数据更新于 ${CHANGELOG_GENERATED_AT}`

const dateText = (iso: string) => {
  if (locale.value === 'en') {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
  const [y, m, d] = iso.split('-')
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Changelog</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{{ t('更新记录') }}</h1>
    <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
      {{ t('本页内容直接由仓库提交记录生成：每次代码合入后按 conventional commit 归类为新功能、改进与修复，按日期排列。') }}
    </p>
    <p class="mt-1 text-xs text-slate-400">
      {{ statsLine() }}
    </p>

    <div class="mt-10 space-y-10">
      <section v-for="day in changelogDays" :key="day.date" class="relative pl-6 sm:pl-8">
        <span class="absolute top-1.5 left-0 size-2.5 rounded-full bg-brand-500 ring-4 ring-brand-100" aria-hidden="true" />
        <span
          v-if="day !== changelogDays[changelogDays.length - 1]"
          class="absolute top-4 bottom-[-2.5rem] left-[4.5px] w-px bg-slate-200"
          aria-hidden="true"
        />
        <h2 class="text-base font-bold text-slate-900">{{ dateText(day.date) }}</h2>
        <ul class="mt-3 space-y-2.5">
          <li v-for="entry in day.entries" :key="entry.hash" class="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
            <span
              class="mt-0.5 inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
              :class="KIND_LABEL[entry.kind].cls"
            >{{ kindLabel(entry.kind) }}</span>
            <span class="min-w-0 flex-1">{{ entry.text }}</span>
            <code class="mt-0.5 shrink-0 font-mono text-[11px] text-slate-400">{{ entry.hash }}</code>
          </li>
        </ul>
      </section>
    </div>

    <p class="mt-12 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
      {{ t('提交哈希用于内部溯源；仅统计 feat / fix / perf / refactor 类型的提交，文档、构建与运维类合入不在此列。') }}
    </p>
  </div>
</template>
