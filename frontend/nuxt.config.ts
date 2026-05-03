// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vite-pwa/nuxt',
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  pwa: {
    registerType: 'autoUpdate',

    manifest: {
      name: '認知シャッフル睡眠',
      short_name: 'CSSM',
      description: '認知シャッフル睡眠法アプリ',
      theme_color: '#0d0f12',
      background_color: '#0d0f12',
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
      globPatterns: ['**/*.{js,css,html,json,png,svg,ico}'],

      runtimeCaching: [
        {
          urlPattern: /\/audio_cache\/.*\.wav$/,
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
      ],
    },

    client: {
      installPrompt: false,
    },
  },
})