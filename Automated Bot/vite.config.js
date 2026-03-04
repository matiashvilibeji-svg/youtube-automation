import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function proxyErrorHandler(err, req, res) {
  console.error(`Proxy error for ${req.url}:`, err.message)
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }))
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.env*',
        '**/dist/**',
        '**/.DS_Store',
        '**/.claude/**',
        '**/CLAUDE.md',
        '**/*.jsonl',
      ],
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
      usePolling: false,
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    proxy: {
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        timeout: 180000,
        rewrite: (path) => path.replace(/^\/api\/claude/, '/v1/messages'),
        configure: (proxy) => {
          proxy.on('error', proxyErrorHandler)
          proxy.on('proxyReq', (proxyReq, req, res) => {
            req.socket.setTimeout(180000)
          })
        },
      },
      '/api/nanobanana/generate': {
        target: 'https://nanobnana.com',
        changeOrigin: true,
        timeout: 120000,
        rewrite: (path) => path.replace(/^\/api\/nanobanana\/generate/, '/api/v2/generate'),
        configure: (proxy) => {
          proxy.on('error', proxyErrorHandler)
        },
      },
      '/api/nanobanana/status': {
        target: 'https://nanobnana.com',
        changeOrigin: true,
        timeout: 120000,
        rewrite: (path) => path.replace(/^\/api\/nanobanana\/status/, '/api/v2/status'),
        configure: (proxy) => {
          proxy.on('error', proxyErrorHandler)
        },
      },
      '/api/kling': {
        target: 'https://api.klingai.com',
        changeOrigin: true,
        timeout: 120000,
        rewrite: (path) => path.replace(/^\/api\/kling/, '/v1'),
        configure: (proxy) => {
          proxy.on('error', proxyErrorHandler)
        },
      },
      '/api/elevenlabs': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        timeout: 60000,
        rewrite: (path) => path.replace(/^\/api\/elevenlabs/, '/v1'),
        configure: (proxy) => {
          proxy.on('error', proxyErrorHandler)
        },
      },
    },
  },
})
