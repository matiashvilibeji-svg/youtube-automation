import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchElevenLabsCredits, fetchNanoBananaCredits } from '../lib/creditsApi'

// status: 'idle' | 'loading' | 'done' | 'error' | 'unavailable'
const entry = (status = 'idle') => ({ status, data: null, error: null })

const INITIAL = {
  nanoBanana:  entry(),
  elevenLabs:  entry(),
  kling:       entry('unavailable'),
  claude:      entry('unavailable'),
}

export default function useApiCredits(apiKeys) {
  const [credits, setCredits] = useState(INITIAL)
  const busyRef = useRef(false)

  const fetchAll = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true

    const jobs = []

    if (apiKeys.nanoBanana) {
      setCredits((p) => ({ ...p, nanoBanana: { ...p.nanoBanana, status: 'loading' } }))
      jobs.push(
        fetchNanoBananaCredits(apiKeys.nanoBanana)
          .then((data) => setCredits((p) => ({ ...p, nanoBanana: { status: 'done', data, error: null } })))
          .catch((err) => setCredits((p) => ({ ...p, nanoBanana: { status: 'error', data: null, error: err.message } })))
      )
    }

    if (apiKeys.elevenLabs) {
      setCredits((p) => ({ ...p, elevenLabs: { ...p.elevenLabs, status: 'loading' } }))
      jobs.push(
        fetchElevenLabsCredits(apiKeys.elevenLabs)
          .then((data) => setCredits((p) => ({ ...p, elevenLabs: { status: 'done', data, error: null } })))
          .catch((err) => setCredits((p) => ({ ...p, elevenLabs: { status: 'error', data: null, error: err.message } })))
      )
    }

    await Promise.allSettled(jobs)
    busyRef.current = false
  }, [apiKeys.nanoBanana, apiKeys.elevenLabs])

  // Fetch on mount / when keys change
  useEffect(() => { fetchAll() }, [fetchAll])

  return { credits, refreshCredits: fetchAll }
}
