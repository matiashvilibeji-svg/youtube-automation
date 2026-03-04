import { useState, useCallback } from 'react'

export default function useYoutubeDownload() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [status, setStatus] = useState('idle') // idle | fetching | ready | downloading | done | error
  const [error, setError] = useState(null)

  const fetchInfo = useCallback(async (inputUrl) => {
    const trimmed = (inputUrl || url).trim()
    if (!trimmed) return

    setStatus('fetching')
    setError(null)
    setVideoInfo(null)

    try {
      const res = await fetch('/api/youtube/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch video info')

      setVideoInfo(data)
      setStatus('ready')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [url])

  const downloadMp3 = useCallback(() => {
    if (!videoInfo || !url.trim()) return

    setStatus('downloading')
    setError(null)

    const params = new URLSearchParams({
      url: url.trim(),
      title: videoInfo.title || 'audio',
    })

    // Use a hidden link to trigger browser download
    const link = document.createElement('a')
    link.href = `/api/youtube/download?${params.toString()}`
    link.download = `${videoInfo.title || 'audio'}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Since we can't track the actual download progress via <a> click,
    // set a timeout to reset status
    setTimeout(() => setStatus('done'), 2000)
  }, [url, videoInfo])

  const reset = useCallback(() => {
    setUrl('')
    setVideoInfo(null)
    setStatus('idle')
    setError(null)
  }, [])

  return { url, setUrl, videoInfo, status, error, fetchInfo, downloadMp3, reset }
}
