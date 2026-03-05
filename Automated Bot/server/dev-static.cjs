/**
 * Lightweight CJS dev server — serves dist/ with API proxies.
 * Use when Vite is broken (e.g. zombie esbuild processes).
 *
 *   node server/dev-static.cjs
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') }) } catch {}

// Prevent stray errors from crashing the dev-static server
process.on('uncaughtException', (err) => {
  console.error('[dev-static] Uncaught exception (server kept alive):', err.message)
})
process.on('unhandledRejection', (reason) => {
  console.error('[dev-static] Unhandled rejection (server kept alive):', reason)
})

const PORT = process.env.PORT || 3000
const DIST = path.join(__dirname, '..', 'dist')

// MIME types for static files
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

// ── Proxy helpers ──────────────────────────────────────────────────
const PROXIES = [
  { prefix: '/api/claude',      target: 'https://api.anthropic.com',  rewrite: '/v1/messages', timeout: 180000 },
  { prefix: '/api/nanobanana',   target: 'https://nanobnana.com',      rewrite: '/api/v2',      timeout: 120000 },
  { prefix: '/api/kling',        target: 'https://api.klingai.com',    rewrite: '/v1',          timeout: 120000 },
  { prefix: '/api/elevenlabs',   target: 'https://api.elevenlabs.io',  rewrite: '/v1',          timeout: 60000  },
]

function proxyRequest(req, res, { target, rewrite, prefix, timeout }) {
  const targetUrl = new URL(target)
  const upstreamPath = req.url.replace(prefix, rewrite)

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: upstreamPath,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.hostname },
    timeout,
  }
  // Remove headers that break upstream
  delete options.headers['connection']

  // Inject Claude API key server-side
  if (prefix === '/api/claude') {
    const claudeKey = process.env.VITE_CLAUDE_API_KEY
    if (claudeKey) options.headers['x-api-key'] = claudeKey.trim()
    delete options.headers['anthropic-dangerous-direct-browser-access']
  }

  const https = require('https')
  const proxyReq = https.request(options, (proxyRes) => {
    proxyRes.on('error', (err) => {
      console.error(`Upstream response error ${prefix}:`, err.message)
    })
    try {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
    } catch (err) {
      console.error(`Failed to write proxy response headers ${prefix}:`, err.message)
      return
    }
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error(`Proxy error ${prefix}:`, err.message)
    try {
      if (!res.headersSent && res.socket && !res.socket.destroyed) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }))
      }
    } catch (writeErr) {
      console.error('Failed to send proxy error response:', writeErr.message)
    }
  })

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Proxy timeout'))
  })

  req.pipe(proxyReq)
}

// ── Image proxy (bypass CORS for external CDN images) ─────────────
function handleImageProxy(req, res) {
  const urlObj = new URL(req.url, 'http://localhost')
  const imageUrl = urlObj.searchParams.get('url')

  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Missing or invalid url parameter' }))
  }

  const proto = imageUrl.startsWith('https') ? require('https') : require('http')
  proto.get(imageUrl, (upstream) => {
    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      res.writeHead(upstream.statusCode, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Upstream returned ${upstream.statusCode}` }))
    }
    const ct = upstream.headers['content-type']
    const headers = {}
    if (ct) headers['Content-Type'] = ct
    res.writeHead(200, headers)
    upstream.pipe(res)
  }).on('error', (err) => {
    console.error('Image proxy error:', err.message)
    try {
      if (!res.headersSent && res.socket && !res.socket.destroyed) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Image proxy error: ${err.message}` }))
      }
    } catch (writeErr) {
      console.error('Failed to send image proxy error response:', writeErr.message)
    }
  })
}

// ── Static file server ────────────────────────────────────────────
function serveStatic(req, res) {
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url.split('?')[0])

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback — serve index.html for unknown routes
      filePath = path.join(DIST, 'index.html')
    }

    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(500)
        return res.end('Internal Server Error')
      }
      const ext = path.extname(filePath)
      const mime = MIME[ext] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': mime })
      res.end(data)
    })
  })
}

// ── Server ────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Image proxy
  if (req.url.startsWith('/api/fetch-image')) {
    return handleImageProxy(req, res)
  }

  // API proxies
  for (const proxy of PROXIES) {
    if (req.url.startsWith(proxy.prefix)) {
      return proxyRequest(req, res, proxy)
    }
  }

  // Static files
  serveStatic(req, res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Static dev server running at http://127.0.0.1:${PORT}/\n`)
  console.log('  Serving dist/ with API proxies (CJS, no esbuild dependency)')
  console.log('  To rebuild: vite build (after reboot clears zombie processes)\n')
})
