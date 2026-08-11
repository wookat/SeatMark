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
        lang: 'zh-CN',
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
        // 生僻字扩展字库共 ~11MB，浏览器按 unicode-range 按需下载，不进预缓存
        globIgnores: ['fonts/plangothic/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 新版本立即接管，服务端响应头/资源更新不必等用户关闭全部标签页
        skipWaiting: true,
        clientsClaim: true,
        // 导航请求不吃预缓存的 index.html：否则服务端响应头（安全头等）更新后，
        // 老访客仍被 SW 用旧响应应答，新头长期不生效
        navigateFallback: undefined,
        // 禁用目录索引映射：precache 路由默认把「/」映射到预缓存的 index.html，
        // 会抢在 NetworkFirst 之前应答根路径导航；置空后 index.html 仅作离线壳页
        directoryIndex: '',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
              // 离线且该路由未缓存时回落预缓存壳页，保持任意路由可离线打开
              precacheFallback: { fallbackURL: '/index.html' },
            },
          },
        ],
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
          : (id: string) => {
              // Vite 的 __vitePreload 助手若落入 vendor-pdf，会让入口静态依赖整个 PDF 依赖包
              if (id.includes('vite/preload-helper')) return 'vendor-preload'
              if (/node_modules\/(jspdf|html2canvas-pro)\//.test(id)) return 'vendor-pdf'
              if (/node_modules\/xlsx\//.test(id)) return 'vendor-xlsx'
              return undefined
            },
      },
    },
  },
  test: {
    environment: 'jsdom',
    alias: {
      // SDK 仅存在于 EdgeOne 运行时，测试替换为抛错替身走降级分支
      '@edgeone/pages-blob': fileURLToPath(
        new URL('./src/__tests__/stubs/edgeone-pages-blob.ts', import.meta.url),
      ),
    },
  },
}))
