<template>
  <footer class="no-print border-t border-slate-200 bg-white">
    <div
      class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row"
    >
      <div class="flex items-center gap-2">
        <span class="font-semibold text-slate-700">SeatMark 座签</span>
        <span class="hidden text-slate-300 sm:inline">·</span>
        <span>座位标签 · 考场桌贴 · 桌牌在线生成工具</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <svg
            class="size-3.5 text-emerald-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
          </svg>
          <span>所有数据仅在浏览器本地处理，不会上传服务器</span>
        </div>
        <span class="hidden text-slate-300 sm:inline">·</span>
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-slate-600"
        >
          湘ICP备2026009844号
        </a>
        <span class="hidden text-slate-300 sm:inline">·</span>
        <span>© 2026 SeatMark. All rights reserved.</span>
      </div>
    </div>
  </footer>
</template>
