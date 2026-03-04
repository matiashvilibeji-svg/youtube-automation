export default function StatsRow({ total, imagesDone, videosDone, audioDone }) {
  return (
    <div className="flex gap-4 text-xs text-gray-500">
      <span>Scenes: <span className="text-gray-300">{total}</span></span>
      <span>Images: <span className="text-gray-300">{imagesDone}/{total}</span></span>
      <span>Videos: <span className="text-gray-300">{videosDone}/{total}</span></span>
      {audioDone > 0 && (
        <span>Audio: <span className="text-gray-300">{audioDone}/{total}</span></span>
      )}
    </div>
  )
}
