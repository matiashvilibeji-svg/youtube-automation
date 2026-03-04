import { ELEVENLABS_DEFAULT_VOICE_ID, ELEVENLABS_MODEL_ID } from './constants'

/**
 * Generate speech audio from text using the ElevenLabs TTS API.
 * Returns a blob URL suitable for <audio src>.
 */
export async function generateSpeech(apiKey, text, voiceId = ELEVENLABS_DEFAULT_VOICE_ID, signal) {
  const res = await fetch(`/api/elevenlabs/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
    signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error')
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`)
  }

  const blob = await res.blob()
  const audioUrl = URL.createObjectURL(blob)
  return { audioUrl }
}
