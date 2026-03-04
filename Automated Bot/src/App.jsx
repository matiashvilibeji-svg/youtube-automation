import { useState, useCallback, useEffect, useRef } from 'react'
import useApiKeys from './hooks/useApiKeys'
import useChat from './hooks/useChat'
import usePipeline from './hooks/usePipeline'
import useActivityLog from './hooks/useActivityLog'
import useProject from './hooks/useProject'
import ChatPanel from './components/ChatPanel'
import PipelinePanel from './components/PipelinePanel'
import SettingsModal from './components/SettingsModal'
import MediaDetailModal from './components/MediaDetailModal'

export default function App() {
  const { apiKeys } = useApiKeys()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mediaModal, setMediaModal] = useState(null) // { sceneIndex, mode } | null
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

  const { scenes, stage, isRunning, startPipeline, cancelPipeline, resetPipeline, updateScene, generateSingleImage, generateSingleVideo, generateSingleAudio, cancelSceneGeneration, initScenesOnly, generateImagesForScenes, generateVideosForScenes, generateAudioForScenes, updateScenePrompts } = usePipeline({
    apiKeys,
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

  const { messages, isLoading, send } = useChat({
    apiKeys,
    onPipelineData: handlePipelineData,
    onToolUse: handleToolUse,
    onMissingKeys: handleMissingKeys,
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
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={selectProject}
        onCreateProject={createProject}
        onDeleteProject={deleteProject}
      />

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
        onGenerateAudio={generateSingleAudio}
        onCancelImage={cancelSceneGeneration}
        onCancelVideo={cancelSceneGeneration}
        onCancelAudio={cancelSceneGeneration}
      />

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
          onGenerateAudio={generateSingleAudio}
          onCancelImage={cancelSceneGeneration}
          onCancelVideo={cancelSceneGeneration}
          onCancelAudio={cancelSceneGeneration}
          totalScenes={scenes.length}
          onNavigate={handleNavigateMedia}
        />
      )}
    </div>
  )
}
