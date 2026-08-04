<script setup lang="ts">
import { ICP_BEIAN, ICP_BEIAN_URL, POLICE_BEIAN, POLICE_BEIAN_CODE } from '@/data/site'

const policeUrl = POLICE_BEIAN_CODE
  ? `https://beian.mps.gov.cn/#/query/webSearch?code=${POLICE_BEIAN_CODE}`
  : 'https://beian.mps.gov.cn'
</script>

<template>
  <span class="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
    <a
      v-if="ICP_BEIAN"
      :href="ICP_BEIAN_URL"
      target="_blank"
      rel="noopener noreferrer"
      class="transition-colors hover:text-slate-600"
    >
      {{ ICP_BEIAN }}
    </a>
    <a
      v-if="POLICE_BEIAN"
      :href="policeUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 transition-colors hover:text-slate-600"
    >
      <svg
        class="size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
        <path d="M12 8v4" />
        <path d="M12 15h.01" />
      </svg>
      {{ POLICE_BEIAN }}
    </a>
  </span>
</template>
