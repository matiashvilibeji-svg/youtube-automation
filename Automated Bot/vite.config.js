import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local for server-side proxy use (not client-side)
try {
  const envPath = resolve(import.meta.dirname, '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch {}

// Lazy-load youtubeDownload.js once — avoids Vite re-tracking the dynamic import
// on every request, which was causing full server restarts when the file changed.
let _ytMod = null
async function getYtModule() {
  if (!_ytMod) _ytMod = await import('./server/youtubeDownload.js')
  return _ytMod
}

function youtubeApiPlugin() {
  return {
    name: 'youtube-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/youtube/info' && req.method === 'POST') {
          const timeout = setTimeout(() => {
            if (!res.headersSent) {
              res.writeHead(504, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Request timed out' }))
            }
          }, 300000) // 5 min

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
            if (!res.json) {
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              }
              res.status = (code) => { res.statusCode = code; return res }
            }

            try {
              const { checkDependencies, getVideoInfo } = await getYtModule()
              await checkDependencies()
              const { url } = req.body || {}
              if (!url) { res.statusCode = 400; return res.json({ error: 'Missing url parameter' }) }
              const info = await getVideoInfo(url)
              res.json(info)
            } catch (err) {
              console.error('YouTube info error:', err.message)
              if (!res.headersSent) {
                res.statusCode = 500
                res.json({ error: err.message })
              }
            } finally {
              clearTimeout(timeout)
            }
          })
          return
        }

        if (req.url?.startsWith('/api/youtube/download') && req.method === 'GET') {
          const timeout = setTimeout(() => {
            if (!res.headersSent) {
              res.writeHead(504, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Request timed out' }))
            }
          }, 300000) // 5 min

          const urlObj = new URL(req.url, 'http://localhost')
          const videoUrl = urlObj.searchParams.get('url')
          const title = urlObj.searchParams.get('title')

          if (!videoUrl) {
            clearTimeout(timeout)
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing url parameter' }))
            return
          }

          try {
            const { checkDependencies, downloadAudio } = await getYtModule()
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
          } finally {
            clearTimeout(timeout)
          }
          return
        }

        // Image proxy to bypass CORS when converting external CDN images to base64
        if (req.url?.startsWith('/api/fetch-image') && req.method === 'GET') {
          const urlObj = new URL(req.url, 'http://localhost')
          const imageUrl = urlObj.searchParams.get('url')

          if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing or invalid url parameter' }))
            return
          }

          try {
            const upstream = await fetch(imageUrl)
            if (!upstream.ok) {
              res.statusCode = upstream.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `Upstream returned ${upstream.status}` }))
              return
            }
            const contentType = upstream.headers.get('content-type')
            if (contentType) res.setHeader('Content-Type', contentType)
            const buffer = Buffer.from(await upstream.arrayBuffer())
            res.end(buffer)
          } catch (err) {
            console.error('Image proxy error:', err.message)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Image proxy error: ${err.message}` }))
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
        '**/node_modules_old*/**',
        '**/server/**',
        '**/.git/**',
        '**/.env*',
        '**/dist/**',
        '**/.DS_Store',
        '**/.claude/**',
        '**/CLAUDE.md',
        '**/*.jsonl',
        '**/package-lock.json',
      ],
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
      usePolling: false,
    },
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
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
            const claudeKey = process.env.VITE_CLAUDE_API_KEY
            if (claudeKey) proxyReq.setHeader('x-api-key', claudeKey.trim())
            // Strip browser headers so Anthropic doesn't treat this as a direct browser request
            proxyReq.removeHeader('anthropic-dangerous-direct-browser-access')
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
      '/api/nanobanana': {
        target: 'https://api.nanobananaapi.ai',
        changeOrigin: true,
        timeout: 120000,
        rewrite: (path) => path.replace(/^\/api\/nanobanana/, '/api/v1/nanobanana'),
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
