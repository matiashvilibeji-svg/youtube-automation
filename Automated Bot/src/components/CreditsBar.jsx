import { useState } from 'react'

const PROVIDERS = [
  { key: 'nanoBanana', label: 'Nano Banana' },
  { key: 'kling', label: 'Kling' },
  { key: 'elevenLabs', label: 'ElevenLabs' },
  { key: 'claude', label: 'Claude' },
]

function fmt(provider) {
  const { status, data, error } = provider
  if (status === 'unavailable') return { text: 'N/A', color: 'text-gray-600', tip: 'No balance API — check provider dashboard' }
  if (status === 'idle')        return { text: '—', color: 'text-gray-600', tip: 'No API key configured' }
  if (status === 'loading')     return { text: '...', color: 'text-gray-500', tip: 'Loading' }
  if (status === 'error')       return { text: 'Error', color: 'text-red-400', tip: error }

  // done
  if (data?.limit) {
    const pct = Math.round((data.remaining / data.limit) * 100)
    const color = pct > 50 ? 'text-green-400' : pct > 20 ? 'text-yellow-400' : 'text-red-400'
    return { text: `${data.remaining.toLocaleString()} / ${data.limit.toLocaleString()}`, color, tip: `${pct}% remaining` }
  }
  if (data?.remaining !== undefined) {
    const r = data.remaining
    const color = r > 50 ? 'text-green-400' : r > 10 ? 'text-yellow-400' : 'text-red-400'
    return { text: `${r} credits`, color, tip: 'Remaining credits' }
  }
  return { text: '?', color: 'text-gray-500', tip: 'Unknown' }
}

export default function CreditsBar({ credits, onRefresh }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="px-6 pb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        API Credits
      </button>
      {open && (
        <div className="flex items-center gap-4 mt-1 text-xs flex-wrap">
          {PROVIDERS.map(({ key, label }) => {
            const f = fmt(credits[key])
            return (
              <span key={key} title={f.tip} className="flex items-center gap-1">
                <span className="text-gray-500">{label}:</span>
                <span className={f.color}>{f.text}</span>
              </span>
            )
          })}
          <button
            onClick={onRefresh}
            className="text-gray-600 hover:text-gray-400 transition-colors ml-1"
            title="Refresh credits"
          >
            ↻
          </button>
        </div>
      )}
    </div>
  )
}
