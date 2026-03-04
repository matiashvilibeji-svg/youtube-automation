export default function StatsRow({ total, imagesDone, videosDone, audioStatus }) {
  const audioLabel = {
    pending: '—',
    loading: '...',
    done: 'Done',
    error: 'Error',
  }[audioStatus] || '—'

  const audioColor = {
    done: 'text-green-400',
    loading: 'text-yellow-400',
    error: 'text-red-400',
  }[audioStatus] || 'text-gray-500'

  return (
    <div className="flex gap-4 text-xs text-gray-500">
      <span>Scenes: <span className="text-gray-300">{total}</span></span>
      <span>Images: <span className="text-gray-300">{imagesDone}/{total}</span></span>
      <span>Videos: <span className="text-gray-300">{videosDone}/{total}</span></span>
      <span>Audio: <span className={audioColor}>{audioLabel}</span></span>
    </div>
  )
}
