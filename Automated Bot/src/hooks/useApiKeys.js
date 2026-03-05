import { useState, useCallback } from 'react'
import { STORAGE_KEY } from '../lib/constants'

const envDefaults = {
  nanoBanana: import.meta.env.VITE_NANOBANANA_API_KEY || '',
  klingAccessKey: import.meta.env.VITE_KLING_ACCESS_KEY || '',
  klingSecretKey: import.meta.env.VITE_KLING_SECRET_KEY || '',
  gemini: import.meta.env.VITE_GEMINI_API_KEY || '',
  elevenLabs: import.meta.env.VITE_ELEVENLABS_API_KEY || '',
}

// One-time cleanup: remove stale claude key from localStorage
try {
  const raw = localStorage.getItem('vp-api-keys')
  if (raw) {
    const stored = JSON.parse(raw)
    if ('claude' in stored) {
      delete stored.claude
      localStorage.setItem('vp-api-keys', JSON.stringify(stored))
    }
  }
} catch {}

function loadKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...envDefaults }
    const stored = JSON.parse(raw)
    // localStorage values override env defaults (non-empty only)
    return Object.fromEntries(
      Object.keys(envDefaults).map((k) => [k, (stored[k] || envDefaults[k] || '').trim()])
    )
  } catch {
    return { ...envDefaults }
  }
}

export default function useApiKeys() {
  const [apiKeys, setApiKeys] = useState(loadKeys)

  const saveKeys = useCallback((keys) => {
    setApiKeys(keys)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  }, [])

  const hasAllKeys = Boolean(
    apiKeys.nanoBanana && apiKeys.klingAccessKey && apiKeys.klingSecretKey
  )
  const missingKeys = []
  if (!apiKeys.nanoBanana) missingKeys.push('Nano Banana')
  if (!apiKeys.klingAccessKey || !apiKeys.klingSecretKey) missingKeys.push('Kling')

  return { apiKeys, saveKeys, hasAllKeys, missingKeys, envDefaults }
}
