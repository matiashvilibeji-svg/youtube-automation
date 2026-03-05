import dotenv from 'dotenv'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { registerRoutes } from './youtubeDownload.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })
const app = express()
const PORT = process.env.PORT || 3000

// Body parsing for YouTube API routes
app.use(express.json())

// Serve static build
app.use(express.static(join(__dirname, '..', 'dist')))

// YouTube download API
registerRoutes(app)

function onProxyError(err, req, res) {
  console.error(`Proxy error for ${req.url}:`, err.message)
  if (!res.headersSent) {
    res.status(502).json({ error: `Proxy error: ${err.message}` })
  }
}

// Image proxy to bypass CORS when converting external CDN images to base64
app.get('/api/fetch-image', async (req, res) => {
  const imageUrl = req.query.url
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    return res.status(400).json({ error: 'Missing or invalid url parameter' })
  }
  try {
    const upstream = await fetch(imageUrl)
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` })
    }
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.end(buffer)
  } catch (err) {
    console.error('Image proxy error:', err.message)
    res.status(502).json({ error: `Image proxy error: ${err.message}` })
  }
})

// Claude API proxy
app.use('/api/claude', createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  pathRewrite: { '^/api/claude': '/v1/messages' },
  timeout: 180000,
  proxyTimeout: 180000,
  onError: onProxyError,
  onProxyReq: (proxyReq) => {
    const claudeKey = process.env.VITE_CLAUDE_API_KEY
    if (claudeKey) proxyReq.setHeader('x-api-key', claudeKey.trim())
    proxyReq.removeHeader('anthropic-dangerous-direct-browser-access')
  },
}))

// Nano Banana 2 API proxy
app.use('/api/nanobanana', createProxyMiddleware({
  target: 'https://api.nanobananaapi.ai',
  changeOrigin: true,
  pathRewrite: { '^/api/nanobanana': '/api/v1/nanobanana' },
  timeout: 120000,
  proxyTimeout: 120000,
  onError: onProxyError,
}))

// Kling API proxy
app.use('/api/kling', createProxyMiddleware({
  target: 'https://api.klingai.com',
  changeOrigin: true,
  pathRewrite: { '^/api/kling': '/v1' },
  timeout: 120000,
  proxyTimeout: 120000,
  onError: onProxyError,
}))

// ElevenLabs TTS API proxy
app.use('/api/elevenlabs', createProxyMiddleware({
  target: 'https://api.elevenlabs.io',
  changeOrigin: true,
  pathRewrite: { '^/api/elevenlabs': '/v1' },
  timeout: 60000,
  proxyTimeout: 60000,
  onError: onProxyError,
}))

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Video Pipeline server running on http://localhost:${PORT}`)
})
