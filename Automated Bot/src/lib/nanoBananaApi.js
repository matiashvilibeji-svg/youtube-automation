import { IMAGE_POLL_INTERVAL, IMAGE_POLL_MAX_ATTEMPTS } from './constants'

// Nano Banana 2 API
// Docs: https://docs.nanobananaapi.ai/quickstart

async function fetchGenerate(apiKey, prompt, signal) {
  const res = await fetch('/api/nanobanana/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      type: 'TEXTTOIAMGE',
      callBackUrl: 'https://example.com/webhook',
      numImages: 1,
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
  console.log('[NanoBanana] Generate response:', JSON.stringify(data))
  const taskId = data?.data?.taskId || data?.taskId || data?.data?.task_id || data?.task_id
  if (!taskId) throw new Error('No taskId returned from Nano Banana: ' + JSON.stringify(data).substring(0, 500))
  return taskId
}

export async function pollImageStatus(apiKey, taskId, signal) {
  for (let attempt = 0; attempt < IMAGE_POLL_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const res = await fetch(`/api/nanobanana/record-info?taskId=${taskId}`, {
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
    const flag = data?.data?.successFlag
    console.log(`[NanoBanana] Poll #${attempt + 1} successFlag=${flag}`, JSON.stringify(data).substring(0, 500))

    // 2 = CREATE_TASK_FAILED, 3 = GENERATE_FAILED
    if (flag === 2 || flag === 3) {
      throw new Error(`Image generation failed: ${data.data?.errorMessage || 'unknown'}`)
    }

    // 1 = SUCCESS
    if (flag === 1) {
      const d = data.data
      let url = null

      // Primary location per docs
      if (d.response) {
        if (typeof d.response === 'object') {
          url = d.response.resultImageUrl
        } else if (typeof d.response === 'string') {
          try {
            const parsed = JSON.parse(d.response)
            url = parsed.resultImageUrl || parsed.url || parsed.image_url
          } catch {
            if (d.response.startsWith('http')) url = d.response
          }
        }
      }
      // Fallbacks
      if (!url) url = d.resultImageUrl || d.output_url || d.image_url || d.url

      console.log('[NanoBanana] Completed! Extracted URL:', url)
      if (!url) {
        console.error('[NanoBanana] Full completed response:', JSON.stringify(data))
        throw new Error('Image completed but could not find URL in response')
      }
      if (typeof url === 'string') return url
      throw new Error('Image completed but URL is not a string: ' + JSON.stringify(url))
    }

    // 0 = GENERATING — wait before next poll
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
  console.log('[NanoBanana] Starting generate...')
  const taskId = await generateImage(apiKey, prompt, signal)
  console.log('[NanoBanana] Got taskId:', taskId, '— starting poll...')
  const imageUrl = await pollImageStatus(apiKey, taskId, signal)
  console.log('[NanoBanana] Poll complete, imageUrl:', imageUrl)
  return { taskId, imageUrl }
}
