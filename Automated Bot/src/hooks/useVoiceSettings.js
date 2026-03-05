import { useState, useCallback } from 'react'
import {
  VOICE_STORAGE_KEY,
  ELEVENLABS_DEFAULT_VOICE_ID,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_VOICES,
} from '../lib/constants'

const DEFAULTS = {
  voiceId: ELEVENLABS_DEFAULT_VOICE_ID,
  voiceName: 'Adam',
  modelId: ELEVENLABS_MODEL_ID,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  useSpeakerBoost: false,
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(VOICE_STORAGE_KEY)
    if (!raw) return DEFAULTS
    const stored = JSON.parse(raw)
    return { ...DEFAULTS, ...stored }
  } catch {
    return DEFAULTS
  }
}

export default function useVoiceSettings() {
  const [voiceSettings, setVoiceSettings] = useState(loadFromStorage)

  const saveSettings = useCallback((next) => {
    setVoiceSettings(next)
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage full — ignore
    }
  }, [])

  return { voiceSettings, saveSettings, voices: ELEVENLABS_VOICES }
}
