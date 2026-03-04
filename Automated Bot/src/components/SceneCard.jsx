import { downloadFile } from '../lib/download'

const statusIcon = {
  pending: <span className="text-gray-600">&#9675;</span>,
  loading: <span className="text-yellow-400 animate-spin-slow inline-block">&#10227;</span>,
  done: <span className="text-green-400">&#10003;</span>,
  error: <span className="text-red-400">&#10007;</span>,
}

function ActionButton({ status, type, onGenerate, onCancel, disabled, requiresImage }) {
  if (requiresImage) {
    return <span className="text-[9px] text-gray-600 italic">Image required first</span>
  }
  if (disabled) {
    return <span className="text-[9px] text-gray-600 italic">Pipeline running...</span>
  }

  const label = type === 'img' ? 'Image' : type === 'aud' ? 'Audio' : 'Video'

  if (status === 'loading') {
    return (
      <button
        onClick={onCancel}
        className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
      >
        Cancel
      </button>
    )
  }

  if (status === 'done') {
    return (
      <button
        onClick={onGenerate}
        className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors"
      >
        Regen {label}
      </button>
    )
  }

  // pending or error
  return (
    <button
      onClick={onGenerate}
      className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
    >
      {status === 'error' ? 'Retry' : 'Generate'} {label}
    </button>
  )
}

export default function SceneCard({
  scene,
  index,
  onOpenImage,
  onOpenVideo,
  onGenerateImage,
  onGenerateVideo,
  onCancelImage,
  onCancelVideo,
  showImageActions,
  showVideoActions,
  isRunning,
}) {
  const { sentence, imgStatus, vidStatus, imageUrl, videoUrl, imgError, vidError } = scene

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col">
      {/* Image area */}
      <div className="relative aspect-[9/16] bg-gray-800">
        {/* Scene number badge */}
        <div className="absolute top-1 left-1 z-10 bg-black/60 text-[10px] text-gray-300 px-1.5 py-0.5 rounded">
          {index + 1}
        </div>

        {/* Image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Scene ${index + 1}`}
            className="w-full h-full object-cover cursor-pointer"
            onClick={onOpenImage}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {imgStatus === 'loading' ? (
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            ) : imgStatus === 'error' ? (
              <span className="text-red-400 text-lg" title={imgError || 'Generation failed'}>&#10007;</span>
            ) : (
              <span className="text-gray-700 text-lg">&#9675;</span>
            )}
          </div>
        )}

        {/* Video overlay: spinner while generating, play button when done */}
        {imageUrl && vidStatus === 'loading' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {videoUrl && (
          <button
            onClick={onOpenVideo}
            className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="w-10 h-10 bg-yellow-500/90 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}

        {/* Download icon overlay */}
        {imgStatus === 'done' && imageUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              downloadFile(videoUrl || imageUrl, videoUrl ? `scene-${index + 1}-video.mp4` : `scene-${index + 1}-image.png`)
            }}
            className="absolute top-1 right-1 z-10 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
            title={videoUrl ? 'Download video' : 'Download image'}
          >
            <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
            </svg>
          </button>
        )}

      </div>

      {/* Info area */}
      <div className="px-2 py-1.5">
        <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">{sentence}</p>
        <div className="flex gap-2 mt-1 text-[10px]">
          <span title={imgStatus === 'error' ? (imgError || 'Generation failed') : undefined}>IMG {statusIcon[imgStatus]}</span>
          <span title={vidStatus === 'error' ? (vidError || 'Generation failed') : undefined}>VID {statusIcon[vidStatus]}</span>
        </div>

        {/* Per-scene action buttons */}
        {(showImageActions || showVideoActions) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {showImageActions && (
              <ActionButton
                status={imgStatus}
                type="img"
                onGenerate={onGenerateImage}
                onCancel={onCancelImage}
                disabled={isRunning}
              />
            )}
            {showVideoActions && (
              <ActionButton
                status={vidStatus}
                type="vid"
                onGenerate={onGenerateVideo}
                onCancel={onCancelVideo}
                disabled={isRunning}
                requiresImage={imgStatus !== 'done'}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
