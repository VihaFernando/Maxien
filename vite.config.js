import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const configDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, configDir, '')
    // Match `client/vite.config.js`: without a target, `/api` OAuth callbacks never reach the LifeSync server.
    const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:5005'

    return {
        plugins: [react(), tailwindcss()],
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
