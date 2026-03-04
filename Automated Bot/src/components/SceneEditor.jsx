import { useState, useCallback } from 'react'

function SceneActionButton({ status, type, onGenerate, onCancel, disabled, requiresImage }) {
  if (requiresImage) {
    return <span className="text-[10px] text-gray-600 italic">Image required first</span>
  }
  if (disabled) {
    return <span className="text-[10px] text-gray-600 italic">Pipeline running...</span>
  }

  const label = type === 'img' ? 'Image' : 'Video'

  if (status === 'loading') {
    return (
      <button
        onClick={onCancel}
        className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
      >
        Cancel
      </button>
    )
  }

  if (status === 'done') {
    return (
      <button
        onClick={onGenerate}
        className="text-[10px] px-2 py-1 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors"
      >
        Regen {label}
      </button>
    )
  }

  // pending or error
  return (
    <button
      onClick={onGenerate}
      className="text-[10px] px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
    >
      {status === 'error' ? 'Retry' : 'Generate'} {label}
    </button>
  )
}

function SceneRow({ scene, index, onUpdateScene, onGenerateImage, onGenerateVideo, onCancelImage, onCancelVideo, isRunning }) {
  const [expanded, setExpanded] = useState(false)
  const [localSentence, setLocalSentence] = useState(scene.sentence)
  const [localImagePrompt, setLocalImagePrompt] = useState(scene.imagePrompt)
  const [localKlingPrompt, setLocalKlingPrompt] = useState(scene.klingPrompt)

  const handleBlur = useCallback((field, value) => {
    if (value !== scene[field]) {
      onUpdateScene(index, { [field]: value })
    }
  }, [index, scene, onUpdateScene])

  const imgStatus = scene.imgStatus || 'pending'
  const vidStatus = scene.vidStatus || 'pending'

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-900/80 hover:bg-gray-900 transition-colors text-left"
      >
        <span className={`text-[10px] text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span className="text-xs text-yellow-500/80 font-mono shrink-0">
          #{index + 1}
        </span>
        <span className="text-xs text-gray-400 truncate flex-1">
          {scene.sentence}
        </span>
        <div className="flex gap-1.5 shrink-0 text-[10px]">
          <span className={imgStatus === 'done' ? 'text-green-400' : imgStatus === 'loading' ? 'text-yellow-400' : imgStatus === 'error' ? 'text-red-400' : 'text-gray-600'}>
            IMG {imgStatus === 'done' ? '✓' : imgStatus === 'loading' ? '⟳' : imgStatus === 'error' ? '✗' : '○'}
          </span>
          <span className={vidStatus === 'done' ? 'text-green-400' : vidStatus === 'loading' ? 'text-yellow-400' : vidStatus === 'error' ? 'text-red-400' : 'text-gray-600'}>
            VID {vidStatus === 'done' ? '✓' : vidStatus === 'loading' ? '⟳' : vidStatus === 'error' ? '✗' : '○'}
          </span>
        </div>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 py-2 space-y-2 bg-gray-950/50">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Sentence</label>
            <textarea
              value={localSentence}
              onChange={(e) => setLocalSentence(e.target.value)}
              onBlur={() => handleBlur('sentence', localSentence)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 resize-none focus:outline-none focus:border-yellow-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Image Prompt</label>
            <textarea
              value={localImagePrompt}
              onChange={(e) => setLocalImagePrompt(e.target.value)}
              onBlur={() => handleBlur('imagePrompt', localImagePrompt)}
              rows={4}
              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 resize-none focus:outline-none focus:border-yellow-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Kling Prompt</label>
            <textarea
              value={localKlingPrompt}
              onChange={(e) => setLocalKlingPrompt(e.target.value)}
              onBlur={() => handleBlur('klingPrompt', localKlingPrompt)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 resize-none focus:outline-none focus:border-yellow-500/50"
            />
          </div>

          {/* Generate buttons */}
          <div className="flex gap-2 pt-1 border-t border-gray-800/50">
            <SceneActionButton
              status={imgStatus}
              type="img"
              onGenerate={onGenerateImage}
              onCancel={onCancelImage}
              disabled={isRunning}
            />
            <SceneActionButton
              status={vidStatus}
              type="vid"
              onGenerate={onGenerateVideo}
              onCancel={onCancelVideo}
              disabled={isRunning}
              requiresImage={imgStatus !== 'done'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function SceneEditor({ scenes, onUpdateScene, onGenerateImage, onGenerateVideo, onCancelImage, onCancelVideo, isRunning }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-2 scrollbar-thin space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{scenes.length} scenes</span>
        <span className="text-[10px] text-gray-600">Click to expand and edit</span>
      </div>
      {scenes.map((scene, i) => (
        <SceneRow
          key={i}
          scene={scene}
          index={i}
          onUpdateScene={onUpdateScene}
          onGenerateImage={() => onGenerateImage?.(i)}
          onGenerateVideo={() => onGenerateVideo?.(i)}
          onCancelImage={() => onCancelImage?.('img', i)}
          onCancelVideo={() => onCancelVideo?.('vid', i)}
          isRunning={isRunning}
        />
      ))}
    </div>
  )
}
