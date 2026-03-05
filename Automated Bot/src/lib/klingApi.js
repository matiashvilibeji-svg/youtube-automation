import { VIDEO_POLL_INTERVAL, VIDEO_POLL_MAX_ATTEMPTS } from './constants'
import { generateKlingJwt } from './klingJwt'

async function imageUrlToBase64(url, signal) {
  // Data URLs: extract base64 directly — no fetch, no blob, no btoa
  if (url.startsWith('data:')) {
    const commaIndex = url.indexOf(',')
    if (commaIndex === -1) throw new Error('Malformed data URL: no comma found')
    return url.substring(commaIndex + 1)
  }

  // HTTP URLs: fetch via server-side proxy to avoid CORS restrictions from CDN origins
  const proxyUrl = `/api/fetch-image?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl, { signal })
  if (!res.ok) throw new Error(`Failed to fetch image for base64 conversion (${res.status})`)
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const CHUNK_SIZE = 8192
  const chunks = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length))
    chunks.push(String.fromCharCode(...slice))
  }
  return btoa(chunks.join(''))
}

export async function createVideoTask(token, imageUrl, prompt, signal) {
  const imageBase64 = await imageUrlToBase64(imageUrl, signal)

  const res = await fetch('/api/kling/videos/image2video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model_name: 'kling-v3',
      image: imageBase64,
      prompt,
      mode: 'pro',
      duration: '5',
      aspect_ratio: '9:16',
      cfg_scale: 0.5,
      enable_audio: true,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Kling create task error (${res.status}): ${err}`)
  }

  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`Kling API error (code ${data.code}): ${data.message || 'unknown'}`)
  }
  const jobId = data?.data?.task_id
  if (!jobId) throw new Error('No task_id returned from Kling')
  return jobId
}

export async function pollVideoStatus(token, jobId, signal) {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const res = await fetch(`/api/kling/videos/image2video/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'Unknown error')
      throw new Error(`Kling status error (${res.status}): ${err}`)
    }

    const data = await res.json()
    const status = data?.data?.task_status

    if (status === 'succeed') {
      const url = data.data.task_result?.videos?.[0]?.url
      if (!url) throw new Error('Video completed but no video URL in response')
      return url
    }

    if (status === 'failed') {
      throw new Error(`Video generation failed: ${data.data?.task_status_msg || 'unknown'}`)
    }

    // 'submitted' and 'processing' — keep polling
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, VIDEO_POLL_INTERVAL)
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    })
  }

  throw new Error('Video generation timed out')
}

export async function generateAndPollVideo(accessKey, secretKey, imageUrl, prompt, signal) {
  // Generate JWT once per job — valid for 30 min, well within max poll time
  const token = await generateKlingJwt(accessKey, secretKey)
  const jobId = await createVideoTask(token, imageUrl, prompt, signal)
  const videoUrl = await pollVideoStatus(token, jobId, signal)
  return { jobId, videoUrl }
}
