import { useState, useEffect, useRef } from 'react'
import { STAGES } from '../lib/constants'
import StageBar from './StageBar'
import StatsRow from './StatsRow'
import SceneCard from './SceneCard'
import ScriptStrip from './ScriptStrip'
import ActivityFeed from './ActivityFeed'
import SceneEditor from './SceneEditor'

export default function PipelinePanel({
  stage,
  scenes,
  onOpenMedia,
  isRunning,
  onCancel,
  onReset,
  activityEntries = [],
  onUpdateScene,
  onGenerateImage,
  onGenerateVideo,
  onGenerateAudio,
  onCancelImage,
  onCancelVideo,
  onCancelAudio,
}) {
  const totalScenes = scenes.length
  const imagesDone = scenes.filter((s) => s.imgStatus === 'done').length
  const videosDone = scenes.filter((s) => s.vidStatus === 'done').length
  const audioDone = scenes.filter((s) => s.audioStatus === 'done').length
  const [logExpanded, setLogExpanded] = useState(true)

  // viewingStep tracks which step the user is looking at (view-only, doesn't affect pipeline)
  const [viewingStep, setViewingStep] = useState(stage)
  const userNavigatedRef = useRef(false)

  // Auto-advance viewingStep with stage unless user manually navigated
  useEffect(() => {
    if (!userNavigatedRef.current) {
      setViewingStep(stage)
    }
    // Reset auto-advance when pipeline finishes
    if (stage === 'done') {
      userNavigatedRef.current = false
    }
  }, [stage])

  const handleStepClick = (stepId) => {
    userNavigatedRef.current = true
    setViewingStep(stepId)
  }

  // Determine what actions to show based on viewing step
  const showImageActions = viewingStep === 'images' || viewingStep === 'done'
  const showVideoActions = viewingStep === 'videos' || viewingStep === 'done'
  const showAudioActions = viewingStep === 'videos' || viewingStep === 'done'

  // Batch generate all pending for a type
  const handleBatchGenerateImages = () => {
    scenes.forEach((scene, i) => {
      if (scene.imgStatus === 'pending' || scene.imgStatus === 'error') {
        onGenerateImage?.(i)
      }
    })
  }

  const handleBatchGenerateVideos = () => {
    scenes.forEach((scene, i) => {
      if ((scene.vidStatus === 'pending' || scene.vidStatus === 'error') && scene.imgStatus === 'done') {
        onGenerateVideo?.(i)
      }
    })
  }

  const handleBatchGenerateAudio = () => {
    scenes.forEach((scene, i) => {
      if (scene.audioStatus === 'pending' || scene.audioStatus === 'error') {
        onGenerateAudio?.(i)
      }
    })
  }

  const pendingImages = scenes.filter((s) => s.imgStatus === 'pending' || s.imgStatus === 'error').length
  const pendingVideos = scenes.filter((s) => (s.vidStatus === 'pending' || s.vidStatus === 'error') && s.imgStatus === 'done').length
  const pendingAudio = scenes.filter((s) => !s.audioStatus || s.audioStatus === 'pending' || s.audioStatus === 'error').length

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Stage bar */}
      <div className="px-6 pt-4 pb-2 flex items-start justify-between">
        <StageBar currentStage={stage} viewingStep={viewingStep} onStepClick={handleStepClick} />
        {totalScenes > 0 && (
          <div className="flex gap-2 ml-4 shrink-0">
            {isRunning && (
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Cancel
              </button>
            )}
            {!isRunning && stage === 'done' && (
              <button
                onClick={onReset}
                className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {totalScenes === 0 ? (
        /* Ideas phase — full activity feed */
        <div className="flex-1 overflow-hidden px-6 pb-2">
          <ActivityFeed entries={activityEntries} mode="full" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="px-6 pb-2">
            <StatsRow total={totalScenes} imagesDone={imagesDone} videosDone={videosDone} audioDone={audioDone} />
          </div>

          {/* Activity log strip (collapsible) */}
          <div className="px-6 pb-2">
            <button
              onClick={() => setLogExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-400 transition-colors mb-1"
            >
              <span className={`transition-transform ${logExpanded ? 'rotate-90' : ''}`}>▶</span>
              Activity Log
              {activityEntries.length > 0 && (
                <span className="text-gray-600">({activityEntries.length})</span>
              )}
            </button>
            {logExpanded && (
              <div className="bg-gray-900/50 rounded-lg border border-gray-800/50">
                <ActivityFeed entries={activityEntries} mode="strip" />
              </div>
            )}
          </div>

          {/* Step-specific views */}
          {viewingStep === 'ideas' && (
            <div className="flex-1 overflow-hidden px-6 pb-2">
              <ActivityFeed entries={activityEntries} mode="full" />
            </div>
          )}

          {viewingStep === 'script' && (
            <SceneEditor
              scenes={scenes}
              onUpdateScene={onUpdateScene}
              onGenerateImage={onGenerateImage}
              onGenerateVideo={onGenerateVideo}
              onCancelImage={onCancelImage}
              onCancelVideo={onCancelVideo}
              isRunning={isRunning}
            />
          )}

          {(viewingStep === 'images' || viewingStep === 'videos' || viewingStep === 'done') && (
            <>
              {/* Batch action bar */}
              {!isRunning && (viewingStep === 'images' || viewingStep === 'videos' || viewingStep === 'done') && (
                <div className="px-6 pb-2 flex flex-wrap gap-2">
                  {viewingStep === 'images' && pendingImages > 0 && (
                    <button
                      onClick={handleBatchGenerateImages}
                      className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    >
                      Generate All Pending Images ({pendingImages})
                    </button>
                  )}
                  {viewingStep === 'videos' && pendingVideos > 0 && (
                    <button
                      onClick={handleBatchGenerateVideos}
                      className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    >
                      Generate All Pending Videos ({pendingVideos})
                    </button>
                  )}
                  {(viewingStep === 'videos' || viewingStep === 'done') && pendingAudio > 0 && onGenerateAudio && (
                    <button
                      onClick={handleBatchGenerateAudio}
                      className="text-xs px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                    >
                      Generate All Pending Audio ({pendingAudio})
                    </button>
                  )}
                </div>
              )}

              {/* Scene grid */}
              <div className="flex-1 overflow-y-auto px-6 pb-2 scrollbar-thin">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                  {scenes.map((scene, i) => (
                    <SceneCard
                      key={i}
                      scene={scene}
                      index={i}
                      onOpenImage={() => onOpenMedia(i, 'image')}
                      onOpenVideo={() => onOpenMedia(i, 'video')}
                      onGenerateImage={() => onGenerateImage?.(i)}
                      onGenerateVideo={() => onGenerateVideo?.(i)}
                      onGenerateAudio={() => onGenerateAudio?.(i)}
                      onCancelImage={() => onCancelImage?.('img', i)}
                      onCancelVideo={() => onCancelVideo?.('vid', i)}
                      onCancelAudio={() => onCancelAudio?.('aud', i)}
                      showImageActions={showImageActions}
                      showVideoActions={showVideoActions}
                      showAudioActions={showAudioActions}
                      isRunning={isRunning}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Script strip — shown when not on Script step */}
          {viewingStep !== 'script' && viewingStep !== 'ideas' && (
            <ScriptStrip sentences={scenes.map((s) => s.sentence)} />
          )}
        </>
      )}
    </div>
  )
}
