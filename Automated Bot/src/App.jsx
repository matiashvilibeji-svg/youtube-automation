import { useState, useCallback, useEffect, useRef } from 'react'
import useApiKeys from './hooks/useApiKeys'
import useApiCredits from './hooks/useApiCredits'
import useChat from './hooks/useChat'
import usePipeline from './hooks/usePipeline'
import useActivityLog from './hooks/useActivityLog'
import useProject from './hooks/useProject'
import useVoiceSettings from './hooks/useVoiceSettings'
import ChatPanel from './components/ChatPanel'
import PipelinePanel from './components/PipelinePanel'
import YouTubeDownloader from './components/YouTubeDownloader'
import SettingsModal from './components/SettingsModal'
import MediaDetailModal from './components/MediaDetailModal'

export default function App() {
  const { apiKeys } = useApiKeys()
  const { credits, refreshCredits } = useApiCredits(apiKeys)
  const { voiceSettings, saveSettings: saveVoiceSettings, voices } = useVoiceSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mediaModal, setMediaModal] = useState(null) // { sceneIndex, mode } | null
  const [activeTab, setActiveTab] = useState('pipeline') // 'pipeline' | 'tools'
  const { entries: activityEntries, addEntry, clearEntries } = useActivityLog()
  const prevIsLoadingRef = useRef(false)

  const {
    projects,
    currentProjectId,
    selectProject,
    createProject,
    deleteProject,
    renameProject,
    refreshProjects,
    projectInstructions,
    saveProjectInstructions,
  } = useProject()

  const handleMissingKeys = useCallback(() => {
    addEntry('error', 'API key not configured. Add it to .env.local and restart.')
  }, [addEntry])

  // Auto-title: when pipeline generates, extract title from first sentence
  const handleAutoTitle = useCallback((pipelineData) => {
    if (!currentProjectId || !pipelineData.sentences?.length) return
    const first = pipelineData.sentences[0]
    const title = first.length > 40 ? first.slice(0, 40) + '...' : first
    renameProject(currentProjectId, title)
  }, [currentProjectId, renameProject])

  const handleStageChange = useCallback(() => {
    refreshProjects()
  }, [refreshProjects])

  const { scenes, stage, isRunning, transcriptAudio, startPipeline, cancelPipeline, resetPipeline, updateScene, generateSingleImage, generateSingleVideo, generateTranscriptAudio, cancelTranscriptAudio, cancelSceneGeneration, initScenesOnly, generateImagesForScenes, generateVideosForScenes, updateScenePrompts } = usePipeline({
    apiKeys,
    voiceSettings,
    onMissingKeys: handleMissingKeys,
    onActivity: addEntry,
    projectId: currentProjectId,
    onStageChange: handleStageChange,
  })

  const handlePipelineData = useCallback((data) => {
    addEntry('chat_pipeline', `Pipeline triggered — ${data.sentences.length} scenes`)
    handleAutoTitle(data)
    startPipeline(data)
  }, [startPipeline, addEntry, handleAutoTitle])

  const handleToolUse = useCallback(({ name, data }) => {
    switch (name) {
      case 'generate_script_only': {
        addEntry('chat_script', `Script generated — ${data.sentences.length} scenes`)
        handleAutoTitle(data)
        initScenesOnly(data)
        break
      }
      case 'generate_images': {
        const indices = data.all
          ? scenes.map((_, i) => i)
          : (data.sceneNumbers || []).map((n) => n - 1).filter((i) => i >= 0 && i < scenes.length)
        addEntry('chat_images', `Image generation requested for ${indices.length} scene(s)`)
        generateImagesForScenes(indices)
        break
      }
      case 'generate_videos': {
        const indices = data.all
          ? scenes.map((_, i) => i)
          : (data.sceneNumbers || []).map((n) => n - 1).filter((i) => i >= 0 && i < scenes.length)
        addEntry('chat_videos', `Video generation requested for ${indices.length} scene(s)`)
        generateVideosForScenes(indices)
        break
      }
      case 'update_scenes': {
        const updates = (data.updates || [])
          .map((u) => ({
            idx: u.sceneNumber - 1,
            ...(u.sentence && { sentence: u.sentence }),
            ...(u.imagePrompt && { imagePrompt: u.imagePrompt }),
            ...(u.klingPrompt && { klingPrompt: u.klingPrompt }),
          }))
          .filter((u) => u.idx >= 0 && u.idx < scenes.length)
        addEntry('chat_update', `Updated ${updates.length} scene(s)`)
        updateScenePrompts(updates)
        break
      }
    }
  }, [scenes, addEntry, handleAutoTitle, initScenesOnly, generateImagesForScenes, generateVideosForScenes, updateScenePrompts])

  const { messages, isLoading, send, clearMessages } = useChat({
    onPipelineData: handlePipelineData,
    onToolUse: handleToolUse,
    projectId: currentProjectId,
    scenes,
    stage,
    projectInstructions,
  })

  // Track isLoading transitions for chat_thinking / chat_responded
  useEffect(() => {
    if (isLoading && !prevIsLoadingRef.current) {
      addEntry('chat_thinking', 'Claude is thinking...')
    }
    if (!isLoading && prevIsLoadingRef.current) {
      addEntry('chat_responded', 'Claude responded')
    }
    prevIsLoadingRef.current = isLoading
  }, [isLoading, addEntry])

  const handleSend = useCallback((text) => {
    const preview = text.length > 50 ? text.slice(0, 50) + '...' : text
    addEntry('chat_sent', `You: "${preview}"`)
    send(text)
  }, [send, addEntry])

  const handleReset = useCallback(() => {
    resetPipeline()
    clearEntries()
  }, [resetPipeline, clearEntries])

  const handleClearResults = useCallback(() => {
    resetPipeline()
    clearMessages()
    clearEntries()
  }, [resetPipeline, clearMessages, clearEntries])

  const handleOpenMedia = useCallback((sceneIndex, mode) => {
    setMediaModal({ sceneIndex, mode })
  }, [])

  const handleNavigateMedia = useCallback((newIndex) => {
    setMediaModal((prev) => prev ? { ...prev, sceneIndex: newIndex } : null)
  }, [])

  // Close modal if scenes become empty (pipeline reset)
  useEffect(() => {
    if (mediaModal && scenes.length === 0) {
      setMediaModal(null)
    }
  }, [scenes.length, mediaModal])

  // Auto-create a project if none exists when user first sends a message
  const handleSendWithProject = useCallback(async (text) => {
    if (!currentProjectId) {
      const project = await createProject('Untitled Project')
      if (!project) return
      // Give React a tick to update before sending
      setTimeout(() => handleSend(text), 50)
      return
    }
    handleSend(text)
  }, [currentProjectId, createProject, handleSend])

  return (
    <div className="h-screen flex bg-gray-950 text-gray-100 overflow-hidden">
      <ChatPanel
        messages={messages}
        onSend={handleSendWithProject}
        isLoading={isLoading}
        onOpenSettings={() => setSettingsOpen(true)}
        onClearResults={handleClearResults}
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={selectProject}
        onCreateProject={createProject}
        onDeleteProject={deleteProject}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex border-b border-gray-800 bg-gray-900 shrink-0">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'pipeline'
                ? 'text-yellow-400 border-b-2 border-yellow-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'tools'
                ? 'text-yellow-400 border-b-2 border-yellow-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Tools
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'pipeline' ? (
          <PipelinePanel
            stage={stage}
            scenes={scenes}
            onOpenMedia={handleOpenMedia}
            isRunning={isRunning}
            onCancel={cancelPipeline}
            onReset={handleReset}
            activityEntries={activityEntries}
            onUpdateScene={updateScene}
            onGenerateImage={generateSingleImage}
            onGenerateVideo={generateSingleVideo}
            onCancelImage={cancelSceneGeneration}
            onCancelVideo={cancelSceneGeneration}
            transcriptAudio={transcriptAudio}
            onGenerateTranscriptAudio={generateTranscriptAudio}
            onCancelTranscriptAudio={cancelTranscriptAudio}
            voiceSettings={voiceSettings}
            onSaveVoiceSettings={saveVoiceSettings}
            voices={voices}
            credits={credits}
            onRefreshCredits={refreshCredits}
          />
        ) : (
          <YouTubeDownloader />
        )}
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        projectInstructions={projectInstructions}
        onSaveInstructions={saveProjectInstructions}
        currentProjectId={currentProjectId}
        projectTitle={projects.find((p) => p.id === currentProjectId)?.title}
      />

      {/* Media detail modal */}
      {mediaModal && scenes[mediaModal.sceneIndex] && (
        <MediaDetailModal
          scene={scenes[mediaModal.sceneIndex]}
          sceneIndex={mediaModal.sceneIndex}
          mode={mediaModal.mode}
          onClose={() => setMediaModal(null)}
          onUpdateScene={updateScene}
          onGenerateImage={generateSingleImage}
          onGenerateVideo={generateSingleVideo}
          onCancelImage={cancelSceneGeneration}
          onCancelVideo={cancelSceneGeneration}
          totalScenes={scenes.length}
          onNavigate={handleNavigateMedia}
        />
      )}
    </div>
  )
}
