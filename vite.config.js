import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig(() => {
    // LifeSync API proxy: set VITE_DEV_PROXY_TARGET=http://localhost:5000 when running server/ locally (default PORT 5000).
    // Without a target, `/api` defaults to a remote host and OAuth callbacks may not hit your local API.
    const proxyTarget = 'https://katpro-workspace.hf.space' || 'http://localhost:5005'

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
