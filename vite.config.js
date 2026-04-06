import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'


// https://vite.dev/config/
export default defineConfig(() => {
    // LifeSync API proxy: set VITE_DEV_PROXY_TARGET=http://localhost:5000 when running server/ locally (default PORT 5000).
    // Without a target, `/api` defaults to a remote host and OAuth callbacks may not hit your local API.
    const proxyTarget = 'https://katpro-workspace.hf.space'

    return {
        plugins: [
            react(),
            tailwindcss(),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['logo.svg'],
                workbox: {
                    // Default is 2 MiB; this app’s main bundle can exceed that.
                    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                },
                manifest: {
                    name: 'Maxien',
                    short_name: 'Maxien',
                    description: 'Maxien PWA',
                    start_url: '/',
                    scope: '/',
                    display: 'standalone',
                    background_color: '#f5f5f7',
                    theme_color: '#C6FF00',
                    icons: [
                        {
                            src: '/logo.svg',
                            sizes: 'any',
                            type: 'image/svg+xml',
                            purpose: 'any maskable',
                        },
                    ],
                },
            }),
        ],
        server: {
            allowedHosts: true,
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                    secure: false,
                    configure(proxy) {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            const host = req.headers.host
                            if (host) proxyReq.setHeader('X-Forwarded-Host', host)
                            const proto =
                                req.headers['x-forwarded-proto'] ||
                                (req.socket?.encrypted ? 'https' : 'http')
                            proxyReq.setHeader('X-Forwarded-Proto', proto)
                        })
                    },
                },
            },
        },
    }
})
