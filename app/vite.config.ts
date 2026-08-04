/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

import { devApiPlugin } from './scripts/devApi.mjs'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    vue(),
    devApiPlugin(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SeatMark 座签 - 座位标签·考场桌贴·桌牌在线生成',
        short_name: 'SeatMark',
        description: '上传 Excel，批量生成可打印的座位标签、考场桌贴、考号贴、桌牌、学生证 / 工作证等。数据全程本地处理。',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // SSR 预渲染构建中依赖被外部化，不能再手动分块
        manualChunks: isSsrBuild
          ? undefined
          : {
              'vendor-pdf': ['jspdf', 'html2canvas-pro'],
              'vendor-xlsx': ['xlsx'],
            },
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
}))
