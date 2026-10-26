// https://nuxt.com/docs/api/configuration/nuxt-config
import { AMBIENT_SOUNDS } from './app/lib/ambient/sounds.js'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vite-pwa/nuxt',
  ],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap',
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  // フォントは上の Google Fonts で読み込む（@nuxt/fonts による自前ホストは使わない）
  ui: {
    fonts: false,
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'only-multiline',
        braceStyle: '1tbs'
      }
    }
  },

  // アイコンをクライアントの JS に同梱する（静的配信・オフラインでも API なしで表示できるように）
  icon: {
    clientBundle: {
      scan: true,
      // 環境音のアイコンは lib（.js）にあり走査されないので、音の一覧から作って明示する
      // （'i-lucide-cloud-rain' → 'lucide:cloud-rain'）
      icons: AMBIENT_SOUNDS.map(s => s.icon.replace('i-lucide-', 'lucide:')),
    },
  },

  pwa: {
    registerType: 'autoUpdate',

    manifest: {
      name: '認知シャッフル睡眠',
      short_name: 'CSSM',
      description: '認知シャッフル睡眠法アプリ',
      theme_color: '#17191c',
      background_color: '#17191c',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'ja',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },

    workbox: {
      globPatterns: ['**/*.{js,css,html,json,png,svg,ico}', 'keepalive.mp3', 'ambient/*.mp3', 'characters/*.webp'],

      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,

      runtimeCaching: [
        // 音声ファイル
        {
          urlPattern: ({ url }) => url.pathname.endsWith('.wav'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'audio-cache',
            expiration: {
              maxEntries: 1000,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        // vocab.json
        {
          urlPattern: /\/vocab\.json$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'vocab-cache',
            expiration: {
              maxAgeSeconds: 60 * 60 * 24 * 7,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        // phrases.json
        {
          urlPattern: /\/phrases\.json$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'phrases-cache',
            expiration: {
              maxAgeSeconds: 60 * 60 * 24 * 7,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        // Google Fonts の CSS（更新は裏で取り直す）
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-fonts-stylesheets',
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        // Google Fonts のフォント本体（URL ごとに不変なので長く持つ）
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            expiration: {
              maxAgeSeconds: 60 * 60 * 24 * 365, // 1年
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    },

    client: {
      installPrompt: false,
    },
  },
})
