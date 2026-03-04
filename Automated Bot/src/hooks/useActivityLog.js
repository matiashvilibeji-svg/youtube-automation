import { useState, useCallback, useRef } from 'react'

let nextId = 1

export default function useActivityLog() {
  const [entries, setEntries] = useState([])
  const timersRef = useRef(new Map())

  const addEntry = useCallback((type, message, sceneIndex = null) => {
    const id = nextId++
    const timestamp = Date.now()

    // Auto-calculate duration for _done/_error events matching a _loading event
    let duration = null
    if (type.endsWith('_done') || type.endsWith('_error')) {
      const loadingType = type.replace(/_(done|error)$/, '_loading')
      const key = sceneIndex !== null ? `${loadingType}:${sceneIndex}` : loadingType
      const startTime = timersRef.current.get(key)
      if (startTime) {
        duration = ((timestamp - startTime) / 1000).toFixed(1)
        timersRef.current.delete(key)
      }
    }

    // Track start time for _loading events
    if (type.endsWith('_loading')) {
      const key = sceneIndex !== null ? `${type}:${sceneIndex}` : type
      timersRef.current.set(key, timestamp)
    }

    // Also track chat_thinking → chat_responded
    if (type === 'chat_thinking') {
      timersRef.current.set('chat_thinking', timestamp)
    }
    if (type === 'chat_responded') {
      const startTime = timersRef.current.get('chat_thinking')
      if (startTime) {
        duration = ((timestamp - startTime) / 1000).toFixed(1)
        timersRef.current.delete('chat_thinking')
      }
    }

    const entry = { id, timestamp, type, sceneIndex, message, duration }
    setEntries((prev) => [...prev, entry])
    return id
  }, [])

  const clearEntries = useCallback(() => {
    setEntries([])
    timersRef.current.clear()
  }, [])

  return { entries, addEntry, clearEntries }
}
