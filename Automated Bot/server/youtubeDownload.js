import { spawn } from 'child_process'
import { createReadStream, unlinkSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'

/**
 * Check that yt-dlp and ffmpeg are available on the system.
 */
export async function checkDependencies() {
  const check = (cmd) =>
    new Promise((resolve) => {
      const proc = spawn('which', [cmd])
      proc.on('close', (code) => resolve(code === 0))
    })

  const [hasYtDlp, hasFfmpeg] = await Promise.all([check('yt-dlp'), check('ffmpeg')])
  if (!hasYtDlp) throw new Error('yt-dlp is not installed. Run: brew install yt-dlp')
  if (!hasFfmpeg) throw new Error('ffmpeg is not installed. Run: brew install ffmpeg')
}

/**
 * Get video metadata from a YouTube URL.
 */
export function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const args = ['-j', '--no-download', '--no-warnings', url]
    const proc = spawn('yt-dlp', args, { timeout: 30000 })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => { stdout += chunk })
    proc.stderr.on('data', (chunk) => { stderr += chunk })

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
      }
      try {
        const info = JSON.parse(stdout)
        resolve({
          title: info.title || 'Unknown',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || null,
          uploader: info.uploader || info.channel || 'Unknown',
          id: info.id,
        })
      } catch (e) {
        reject(new Error('Failed to parse video info'))
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Download audio as MP3 and stream it to the response.
 */
export async function downloadAudio(url, res) {
  const tmpDir = join('/tmp', `yt-dl-${crypto.randomUUID()}`)
  mkdirSync(tmpDir, { recursive: true })
  const outputPath = join(tmpDir, 'audio.mp3')

  return new Promise((resolve, reject) => {
    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-warnings',
      '--no-playlist',
      '-o', outputPath,
      url,
    ]

    const proc = spawn('yt-dlp', args, { timeout: 300000 })

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk })

    proc.on('close', (code) => {
      if (code !== 0) {
        cleanup(tmpDir)
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
      }

      // Stream the file back
      const stream = createReadStream(outputPath)
      stream.on('end', () => {
        cleanup(tmpDir)
        resolve()
      })
      stream.on('error', (err) => {
        cleanup(tmpDir)
        reject(err)
      })
      stream.pipe(res)
    })

    proc.on('error', (err) => {
      cleanup(tmpDir)
      reject(err)
    })
  })
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Express/Connect-compatible route handlers.
 */
export function registerRoutes(app) {
  // POST /api/youtube/info
  app.post('/api/youtube/info', async (req, res) => {
    try {
      await checkDependencies()
      const { url } = req.body || {}
      if (!url) return res.status(400).json({ error: 'Missing url parameter' })
      const info = await getVideoInfo(url)
      res.json(info)
    } catch (err) {
      console.error('YouTube info error:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/youtube/download?url=...&title=...
  app.get('/api/youtube/download', async (req, res) => {
    try {
      await checkDependencies()
      const { url, title } = req.query
      if (!url) return res.status(400).json({ error: 'Missing url parameter' })

      const filename = (title || 'audio').replace(/[^a-zA-Z0-9_\- ]/g, '') + '.mp3'
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

      await downloadAudio(url, res)
    } catch (err) {
      console.error('YouTube download error:', err.message)
      if (!res.headersSent) {
        res.status(500).json({ error: err.message })
      }
    }
  })
}
