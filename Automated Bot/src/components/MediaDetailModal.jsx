import { useState, useEffect, useCallback } from 'react'

export default function MediaDetailModal({
  scene,
  sceneIndex,
  mode,
  onClose,
  onUpdateScene,
  onGenerateImage,
  onGenerateVideo,
  onGenerateAudio,
  onCancelImage,
  onCancelVideo,
  onCancelAudio,
  totalScenes,
  onNavigate,
}) {
  const [viewMode, setViewMode] = useState(mode) // 'image' | 'video'
  const [localImagePrompt, setLocalImagePrompt] = useState(scene.imagePrompt || '')
  const [localKlingPrompt, setLocalKlingPrompt] = useState(scene.klingPrompt || '')
  const [textareaFocused, setTextareaFocused] = useState(false)

  // Reset local state when scene changes
  useEffect(() => {
    setLocalImagePrompt(scene.imagePrompt || '')
    setLocalKlingPrompt(scene.klingPrompt || '')
  }, [sceneIndex, scene.imagePrompt, scene.klingPrompt])

  // Reset view mode when navigating or when mode prop changes
  useEffect(() => {
    setViewMode(mode)
  }, [sceneIndex, mode])

  // Auto-switch to video view when video completes
  useEffect(() => {
    if (scene.vidStatus === 'done' && scene.videoUrl) {
      setViewMode('video')
    }
  }, [scene.vidStatus, scene.videoUrl])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (!textareaFocused) {
        if (e.key === 'ArrowLeft' && sceneIndex > 0) {
          onNavigate(sceneIndex - 1)
        } else if (e.key === 'ArrowRight' && sceneIndex < totalScenes - 1) {
          onNavigate(sceneIndex + 1)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNavigate, sceneIndex, totalScenes, textareaFocused])

  const handleRegenImage = useCallback(() => {
    onUpdateScene(sceneIndex, { imagePrompt: localImagePrompt })
    setTimeout(() => onGenerateImage(sceneIndex), 50)
  }, [sceneIndex, localImagePrompt, onUpdateScene, onGenerateImage])

  const handleGenVideo = useCallback(() => {
    onUpdateScene(sceneIndex, { klingPrompt: localKlingPrompt })
    setTimeout(() => onGenerateVideo(sceneIndex), 50)
  }, [sceneIndex, localKlingPrompt, onUpdateScene, onGenerateVideo])

  const imagePromptDirty = localImagePrompt !== (scene.imagePrompt || '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <button
            onClick={() => sceneIndex > 0 && onNavigate(sceneIndex - 1)}
            disabled={sceneIndex === 0}
            className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400">
            Scene {sceneIndex + 1} of {totalScenes}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sceneIndex < totalScenes - 1 && onNavigate(sceneIndex + 1)}
              disabled={sceneIndex === totalScenes - 1}
              className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white ml-2 text-lg leading-none"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Media Preview */}
          <div className="w-1/2 flex flex-col items-center justify-center p-4 bg-black/30">
            <div className="relative w-full max-w-[280px] aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden">
              {viewMode === 'video' && scene.videoUrl ? (
                <video
                  src={scene.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : scene.imageUrl ? (
                <img
                  src={scene.imageUrl}
                  alt={`Scene ${sceneIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {scene.imgStatus === 'loading' ? (
                    <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-gray-600 text-2xl">No image</span>
                  )}
                </div>
              )}

              {/* Loading overlay for image generation */}
              {scene.imgStatus === 'loading' && scene.imageUrl && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Loading overlay for video generation */}
              {viewMode === 'image' && scene.vidStatus === 'loading' && scene.imageUrl && (
                <div className="absolute bottom-2 right-2 bg-black/70 rounded-full p-1.5">
                  <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Toggle between image and video */}
            {scene.imageUrl && scene.videoUrl && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setViewMode('image')}
                  className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                    viewMode === 'image'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Image
                </button>
                <button
                  onClick={() => setViewMode('video')}
                  className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                    viewMode === 'video'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Video
                </button>
              </div>
            )}
          </div>

          {/* Right: Prompts & Actions */}
          <div className="w-1/2 flex flex-col overflow-y-auto p-4 gap-4 border-l border-gray-800">
            {/* Sentence (read-only) */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Sentence
              </label>
              <p className="mt-1 text-sm text-gray-300 leading-relaxed">
                {scene.sentence}
              </p>
            </div>

            {/* Image Prompt */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Image Prompt
              </label>
              <textarea
                value={localImagePrompt}
                onChange={(e) => setLocalImagePrompt(e.target.value)}
                onFocus={() => setTextareaFocused(true)}
                onBlur={() => setTextareaFocused(false)}
                rows={4}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
              <div className="flex gap-2 mt-2">
                {scene.imgStatus === 'loading' ? (
                  <button
                    onClick={() => onCancelImage('img', sceneIndex)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={handleRegenImage}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      scene.imgStatus === 'done'
                        ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                  >
                    {scene.imgStatus === 'done'
                      ? imagePromptDirty ? 'Regenerate Image' : 'Regenerate Image'
                      : scene.imgStatus === 'error' ? 'Retry Image' : 'Generate Image'}
                  </button>
                )}
              </div>
              {scene.imgStatus === 'error' && scene.imgError && (
                <p className="text-xs text-red-400 mt-1">{scene.imgError}</p>
              )}
            </div>

            {/* Video Prompt */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Video Prompt
              </label>
              <textarea
                value={localKlingPrompt}
                onChange={(e) => setLocalKlingPrompt(e.target.value)}
                onFocus={() => setTextareaFocused(true)}
                onBlur={() => setTextareaFocused(false)}
                rows={3}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
              <div className="flex gap-2 mt-2">
                {scene.vidStatus === 'loading' ? (
                  <button
                    onClick={() => onCancelVideo('vid', sceneIndex)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Cancel
                  </button>
                ) : scene.imgStatus === 'done' ? (
                  <button
                    onClick={handleGenVideo}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      scene.vidStatus === 'done'
                        ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                  >
                    {scene.vidStatus === 'done'
                      ? 'Regenerate Video'
                      : scene.vidStatus === 'error' ? 'Retry Video' : 'Generate Video'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-600 italic">Image required first</span>
                )}
              </div>
              {scene.vidStatus === 'error' && scene.vidError && (
                <p className="text-xs text-red-400 mt-1">{scene.vidError}</p>
              )}
            </div>

            {/* Voiceover */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Voiceover
              </label>
              {scene.audioStatus === 'done' && scene.audioUrl ? (
                <div className="mt-1">
                  <audio controls src={scene.audioUrl} className="w-full h-8" />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onGenerateAudio?.(sceneIndex)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Regenerate Audio
                    </button>
                  </div>
                </div>
              ) : scene.audioStatus === 'loading' ? (
                <div className="mt-1 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-purple-400">Generating voiceover...</span>
                  <button
                    onClick={() => onCancelAudio?.('aud', sceneIndex)}
                    className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors ml-auto"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-1">
                  <button
                    onClick={() => onGenerateAudio?.(sceneIndex)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      scene.audioStatus === 'error'
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                    }`}
                  >
                    {scene.audioStatus === 'error' ? 'Retry Audio' : 'Generate Audio'}
                  </button>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="mt-auto pt-2 border-t border-gray-800">
              <div className="flex gap-4 text-xs text-gray-500">
                <span>Image: <StatusBadge status={scene.imgStatus} /></span>
                <span>Video: <StatusBadge status={scene.vidStatus} /></span>
                <span>Audio: <StatusBadge status={scene.audioStatus || 'pending'} /></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'text-gray-500',
    loading: 'text-yellow-400',
    done: 'text-green-400',
    error: 'text-red-400',
  }
  const labels = {
    pending: 'Pending',
    loading: 'Generating...',
    done: 'Done',
    error: 'Error',
  }
  return <span className={styles[status] || 'text-gray-500'}>{labels[status] || status}</span>
}
