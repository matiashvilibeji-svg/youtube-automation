import { IMAGE_POLL_INTERVAL, IMAGE_POLL_MAX_ATTEMPTS } from './constants'

async function fetchGenerate(apiKey, prompt, signal) {
  const res = await fetch('/api/nanobanana/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: '9:16',
      size: '2K',
      format: 'png',
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    console.error('[NanoBanana] Generate failed:', { status: res.status, body: err, prompt: prompt.substring(0, 100) })
    throw new Error(`Nano Banana generate error (${res.status}): ${err}`)
  }

  return res
}

export async function generateImage(apiKey, prompt, signal) {
  let res
  try {
    res = await fetchGenerate(apiKey, prompt, signal)
  } catch (err) {
    // Retry once on 5xx errors after 2s delay
    if (err.message.includes('(5') && !signal?.aborted) {
      console.warn('[NanoBanana] Retrying after 5xx error...')
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 2000)
        signal?.addEventListener('abort', () => {
          clearTimeout(timeout)
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
      res = await fetchGenerate(apiKey, prompt, signal)
    } else {
      throw err
    }
  }

  const data = await res.json()
  const taskId = data?.data?.task_id
  if (!taskId) throw new Error('No task_id returned from Nano Banana')
  return taskId
}

export async function pollImageStatus(apiKey, taskId, signal) {
  for (let attempt = 0; attempt < IMAGE_POLL_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const res = await fetch(`/api/nanobanana/status/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'Unknown error')
      throw new Error(`Nano Banana status error (${res.status}): ${err}`)
    }

    const data = await res.json()
    const status = data?.data?.status

    if (status === 'completed') {
      const url = data.data.output_url
      if (!url) throw new Error('Completed but no output_url')
      return url
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(`Image generation failed: ${data.data?.error || 'unknown'}`)
    }

    // Wait before next poll
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, IMAGE_POLL_INTERVAL)
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    })
  }

  throw new Error('Image generation timed out')
}

export async function generateAndPollImage(apiKey, prompt, signal) {
  const taskId = await generateImage(apiKey, prompt, signal)
  const imageUrl = await pollImageStatus(apiKey, taskId, signal)
  return { taskId, imageUrl }
}
