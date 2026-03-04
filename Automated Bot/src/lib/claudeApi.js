import { CLAUDE_MODEL, buildSystemPrompt, ALL_TOOLS } from './constants'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

/** Promise-based delay that respects AbortSignal */
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

/**
 * Send a message to Claude with tool_use support.
 * Returns { text: string|null, pipelineData: object|null }
 * Retries up to 3 times on network errors and 5xx responses.
 */
export async function sendMessage(apiKey, conversationHistory, signal, {
  projectContext = '',
  ideaInstructions = '', scriptInstructions = '', characterDescription = '',
  imageInstructions = '', videoInstructions = '',
  sampleInput = '', sampleOutput = '',
} = {}) {
  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 128000,
    system: buildSystemPrompt({
      ideaInstructions, scriptInstructions, characterDescription,
      imageInstructions, videoInstructions,
      sampleInput, sampleOutput, projectContext,
    }),
    tools: ALL_TOOLS,
    messages: conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  let lastError

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let res
    try {
      res = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body,
        signal,
      })
    } catch (err) {
      if (err.name === 'AbortError') throw err
      lastError = new Error(
        'Connection to Claude API timed out or was interrupted. Please try again.'
      )
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(`Claude API network error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`, err.message)
        await abortableDelay(delay, signal)
        continue
      }
      throw lastError
    }

    // Don't retry 4xx — auth/rate-limit errors won't resolve on retry
    if (res.status >= 400 && res.status < 500) {
      const err = await res.text().catch(() => 'Unknown error')
      throw new Error(`Claude API error (${res.status}): ${err}`)
    }

    // Retry on 5xx server errors
    if (res.status >= 500) {
      lastError = new Error(`Claude API server error (${res.status})`)
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(`Claude API ${res.status} error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`)
        await abortableDelay(delay, signal)
        continue
      }
      throw lastError
    }

    // Parse JSON — retry on malformed responses
    let data
    try {
      data = await res.json()
    } catch {
      lastError = new Error(
        'Received an empty or malformed response from Claude API. The request may have timed out.'
      )
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(`Claude API malformed JSON (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`)
        await abortableDelay(delay, signal)
        continue
      }
      throw lastError
    }

    // Success — parse response blocks
    let text = null
    let pipelineData = null
    const toolUses = []

    for (const block of data.content || []) {
      if (block.type === 'text') {
        text = text ? text + block.text : block.text
      } else if (block.type === 'tool_use') {
        toolUses.push({ name: block.name, input: block.input })
        if (block.name === 'generate_pipeline') {
          pipelineData = block.input
        }
      }
    }

    if (!text && !pipelineData && toolUses.length === 0) {
      throw new Error('Empty response from Claude')
    }

    // Detect truncation — Claude hit max_tokens before finishing
    const truncated = data.stop_reason === 'max_tokens'
    if (truncated) {
      console.warn('[Claude API] Response truncated (stop_reason: max_tokens). Output may be incomplete.')
    }

    return { text, pipelineData, toolUses, truncated }
  }

  throw lastError || new Error('Claude API request failed after retries')
}
