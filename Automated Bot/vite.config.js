import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function youtubeApiPlugin() {
  return {
    name: 'youtube-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/youtube/info' && req.method === 'POST') {
          const { registerRoutes } = await import('./server/youtubeDownload.js')
          // Collect body
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            try {
              req.body = JSON.parse(body)
            } catch {
              req.body = {}
            }
            // Mini express-like response helpers
            const origJson = res.json
            if (!res.json) {
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              }
              res.status = (code) => { res.statusCode = code; return res }
            }

            const { checkDependencies, getVideoInfo } = await import('./server/youtubeDownload.js')
            try {
              await checkDependencies()
              const { url } = req.body || {}
              if (!url) { res.statusCode = 400; return res.json({ error: 'Missing url parameter' }) }
              const info = await getVideoInfo(url)
              res.json(info)
            } catch (err) {
              console.error('YouTube info error:', err.message)
              res.statusCode = 500
              res.json({ error: err.message })
            }
          })
          return
        }

        if (req.url?.startsWith('/api/youtube/download') && req.method === 'GET') {
          const { checkDependencies, downloadAudio } = await import('./server/youtubeDownload.js')
          const urlObj = new URL(req.url, 'http://localhost')
          const videoUrl = urlObj.searchParams.get('url')
          const title = urlObj.searchParams.get('title')

          if (!videoUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing url parameter' }))
            return
          }

          try {
            await checkDependencies()
            const filename = (title || 'audio').replace(/[^a-zA-Z0-9_\- ]/g, '') + '.mp3'
            res.setHeader('Content-Type', 'audio/mpeg')
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
            await downloadAudio(videoUrl, res)
          } catch (err) {
            console.error('YouTube download error:', err.message)
            if (!res.headersSent) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          }
          return
        }

        next()
      })
    },
  }
}

function proxyErrorHandler(err, req, res) {
  console.error(`Proxy error for ${req.url}:`, err.message)
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }))
  }
}

export default defineConfig({
  plugins: [react(), youtubeApiPlugin()],
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
