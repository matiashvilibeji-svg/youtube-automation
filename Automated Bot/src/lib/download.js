import JSZip from 'jszip'

/**
 * Bundle all generated assets into a ZIP and trigger browser download.
 * @param {{ scenes: Array, transcriptAudioUrl?: string, onProgress?: (current: number, total: number) => void }} opts
 */
export async function downloadAllAsZip({ scenes, transcriptAudioUrl, onProgress }) {
  const zip = new JSZip()

  // Build script.txt from sentences
  const scriptText = scenes
    .map((s, i) => `${i + 1}. ${s.sentence}`)
    .join('\n')
  zip.file('project/script.txt', scriptText)

  // Count total fetchable assets for progress
  const imageUrls = scenes.map((s, i) => s.imageUrl ? { url: s.imageUrl, index: i } : null).filter(Boolean)
  const videoUrls = scenes.map((s, i) => s.videoUrl ? { url: s.videoUrl, index: i } : null).filter(Boolean)
  const total = imageUrls.length + videoUrls.length + (transcriptAudioUrl ? 1 : 0)
  let current = 0

  const report = () => onProgress?.(++current, total)

  // Fetch a single asset as ArrayBuffer
  const fetchAsset = async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
    return await res.arrayBuffer()
  }

  // Download images
  for (const { url, index } of imageUrls) {
    try {
      const data = await fetchAsset(url)
      const pad = String(index + 1).padStart(2, '0')
      zip.file(`project/images/scene-${pad}.png`, data)
    } catch (e) {
      console.warn(`Skipping image ${index + 1}:`, e)
    }
    report()
  }

  // Download videos
  for (const { url, index } of videoUrls) {
    try {
      const data = await fetchAsset(url)
      const pad = String(index + 1).padStart(2, '0')
      zip.file(`project/videos/scene-${pad}.mp4`, data)
    } catch (e) {
      console.warn(`Skipping video ${index + 1}:`, e)
    }
    report()
  }

  // Download voiceover audio
  if (transcriptAudioUrl) {
    try {
      const data = await fetchAsset(transcriptAudioUrl)
      zip.file('project/audio/voiceover.mp3', data)
    } catch (e) {
      console.warn('Skipping voiceover audio:', e)
    }
    report()
  }

  // Generate and trigger download
  const blob = await zip.generateAsync({ type: 'blob' })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = 'project-assets.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

export async function downloadFile(url, filename) {
  const res = await fetch(url)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

export function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
