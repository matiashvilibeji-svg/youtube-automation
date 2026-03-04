import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// Serve static build
app.use(express.static(join(__dirname, '..', 'dist')))

function onProxyError(err, req, res) {
  console.error(`Proxy error for ${req.url}:`, err.message)
  if (!res.headersSent) {
    res.status(502).json({ error: `Proxy error: ${err.message}` })
  }
}

// Claude API proxy
app.use('/api/claude', createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  pathRewrite: { '^/api/claude': '/v1/messages' },
  timeout: 180000,
  proxyTimeout: 180000,
  onError: onProxyError,
}))

// Nano Banana API proxy
app.use('/api/nanobanana', createProxyMiddleware({
  target: 'https://nanobnana.com',
  changeOrigin: true,
  pathRewrite: { '^/api/nanobanana': '/api/v2' },
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
