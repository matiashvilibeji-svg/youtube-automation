/**
 * Image generation via Google Gemini Imagen API.
 * Returns base64 data URLs (synchronous — no polling needed).
 */

const IMAGEN_MODEL = 'imagen-4.0-generate-001'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Generate an image from a prompt using Gemini Imagen.
 * Returns { imageUrl } where imageUrl is a base64 data URL.
 */
export async function generateAndPollImage(apiKey, prompt, signal) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error(`Invalid image prompt: expected non-empty string, got ${typeof prompt}`)
  }

  const url = `${API_BASE}/${IMAGEN_MODEL}:predict`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '9:16',
        personGeneration: 'allow_all',
      },
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Gemini Imagen error (${res.status}): ${err}`)
  }

  const data = await res.json()
  const prediction = data?.predictions?.[0]

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No image returned from Gemini Imagen')
  }

  const mimeType = prediction.mimeType || 'image/png'
  const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`

  return { imageUrl }
}
