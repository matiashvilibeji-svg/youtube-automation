import { ELEVENLABS_DEFAULT_VOICE_ID, ELEVENLABS_MODEL_ID } from './constants'

/**
 * Generate speech audio from text using the ElevenLabs TTS API.
 * Returns a blob URL suitable for <audio src>.
 *
 * @param {string} apiKey
 * @param {string} text
 * @param {object} options - Voice settings (voiceId, modelId, stability, similarityBoost, style, useSpeakerBoost)
 * @param {AbortSignal} signal
 */
export async function generateSpeech(apiKey, text, options = {}, signal) {
  const {
    voiceId = ELEVENLABS_DEFAULT_VOICE_ID,
    modelId = ELEVENLABS_MODEL_ID,
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = false,
  } = options || {}

  const res = await fetch(`/api/elevenlabs/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: useSpeakerBoost,
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
