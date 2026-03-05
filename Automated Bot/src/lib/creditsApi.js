export async function fetchElevenLabsCredits(apiKey) {
  const res = await fetch('/api/elevenlabs/user/subscription', {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`ElevenLabs (${res.status}): ${err}`)
  }
  const data = await res.json()
  return {
    used: data.character_count,
    limit: data.character_limit,
    remaining: data.character_limit - data.character_count,
  }
}

export async function fetchNanoBananaCredits(apiKey) {
  const res = await fetch('/api/nanobanana-common/credit', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Nano Banana (${res.status}): ${err}`)
  }
  const data = await res.json()
  if (data.code !== 200) {
    throw new Error(`Nano Banana: ${data.msg || 'Unknown error'}`)
  }
  return { remaining: data.data }
}
