import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const CONTENT_SECURITY_POLICY = `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; media-src 'none'; worker-src 'self'`;

const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), publickey-credentials-get=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const;

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1024,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env['npm_package_version'] ?? '0.2.0'),
  },
  plugins: [
    react(),
    VitePWA({
      devOptions: { enabled: false },
      injectRegister: 'script-defer',
      manifest: {
        background_color: '#fbf8f7',
        display: 'standalone',
        icons: [
          {
            src: '/icons/app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        id: '/',
        lang: 'und',
        name: 'My Perfect Days',
        scope: '/',
        short_name: 'My Perfect Days',
        start_url: '/',
        theme_color: '#87365a',
      },
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{css,html,js,svg}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [],
        skipWaiting: true,
      },
    }),
  ],
  preview: {
    headers: SECURITY_HEADERS,
  },
});
