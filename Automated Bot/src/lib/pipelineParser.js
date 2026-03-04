import { TRIGGER_WORDS } from './constants'

/**
 * Check if a user message contains a pipeline trigger word.
 */
export function isTrigger(text) {
  const lower = text.toLowerCase().trim()
  return TRIGGER_WORDS.some((word) => lower.includes(word))
}

/**
 * Normalize pipeline data keys — handles snake_case variants Claude sometimes returns.
 */
function normalizePipelineKeys(data) {
  const get = (camel, ...snakes) => {
    // Check camelCase key first, then snake_case variants
    for (const key of [camel, ...snakes]) {
      if (Array.isArray(data[key])) return data[key]
      // Safety net: recover string values that are JSON arrays (edge-case truncation repair)
      if (typeof data[key] === 'string' && data[key].startsWith('[')) {
        try {
          const parsed = JSON.parse(data[key])
          if (Array.isArray(parsed)) return parsed
        } catch { /* not valid JSON — ignore */ }
      }
    }
    return data[camel] // return whatever it is (may be undefined)
  }
  return {
    sentences: get('sentences', 'script', 'script_sentences'),
    imagePrompts: get('imagePrompts', 'image_prompts', 'imageprompts'),
    klingPrompts: get('klingPrompts', 'kling_prompts', 'klingprompts', 'video_prompts', 'videoPrompts'),
  }
}

/**
 * Validate pipeline data has the correct shape and matching array lengths.
 * Returns { sentences, imagePrompts, klingPrompts } or null if invalid.
 */
export function validatePipelineData(data) {
  if (!data || typeof data !== 'object') return null

  const { sentences, imagePrompts, klingPrompts } = normalizePipelineKeys(data)

  if (!Array.isArray(sentences) || !Array.isArray(imagePrompts) || !Array.isArray(klingPrompts)) {
    console.error(
      'Pipeline data missing required arrays. Received keys:', Object.keys(data),
      '| Types — sentences:', typeof sentences, ', imagePrompts:', typeof imagePrompts, ', klingPrompts:', typeof klingPrompts
    )
    return null
  }

  if (sentences.length !== imagePrompts.length || sentences.length !== klingPrompts.length) {
    const minLen = Math.min(sentences.length, imagePrompts.length, klingPrompts.length)
    if (minLen < 1) {
      console.error('Pipeline has empty arrays after mismatch check')
      return null
    }
    console.warn(
      `Pipeline arrays have mismatched lengths (sentences: ${sentences.length}, imagePrompts: ${imagePrompts.length}, klingPrompts: ${klingPrompts.length}). Truncating to ${minLen}.`
    )
    return {
      sentences: sentences.slice(0, minLen),
      imagePrompts: imagePrompts.slice(0, minLen),
      klingPrompts: klingPrompts.slice(0, minLen),
    }
  }

  if (sentences.length < 1) {
    console.error('Pipeline has no sentences')
    return null
  }

  return { sentences, imagePrompts, klingPrompts }
}

/**
 * Parse a ```pipeline JSON block from Claude's response.
 * Returns { sentences, imagePrompts, klingPrompts } or null if not found.
 */
export function parsePipelineResponse(text) {
  const match = text.match(/```pipeline\s*([\s\S]*?)```/)
  if (!match) return null

  let json
  try {
    json = JSON.parse(match[1].trim())
  } catch (e) {
    console.error('Failed to parse pipeline JSON:', e)
    return null
  }

  return validatePipelineData(json)
}
