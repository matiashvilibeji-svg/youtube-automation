import { useState, useCallback, useRef, useEffect } from 'react'
import { generateAndPollImage } from '../lib/nanoBananaApi'
import { generateAndPollVideo } from '../lib/klingApi'
import { generateSpeech } from '../lib/elevenLabsApi'
import { IMAGE_BATCH_SIZE, VIDEO_BATCH_SIZE } from '../lib/constants'
import { supabase } from '../lib/supabase'

export default function usePipeline({ apiKeys, onMissingKeys, onActivity, projectId, onStageChange }) {
  const [scenes, setScenes] = useState([])
  const scenesRef = useRef(scenes)
  const [stage, setStage] = useState('ideas')
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef(null)
  const videoSemaphoreRef = useRef(0)
  const [transcriptAudio, setTranscriptAudio] = useState({ status: 'pending', url: null })
  const transcriptAudioAbortRef = useRef(null)
  const sceneAbortRefs = useRef(new Map()) // per-scene AbortControllers keyed by 'img-{idx}' / 'vid-{idx}'

  // Wrap setScenes to keep ref in sync
  const setScenesAndRef = useCallback((valueOrUpdater) => {
    setScenes((prev) => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater
      scenesRef.current = next
      return next
    })
  }, [])

  // Load scenes + stage from DB when projectId changes
  useEffect(() => {
    if (!projectId || !supabase) {
      setScenesAndRef([])
      setStage('ideas')
      return
    }

    let cancelled = false
    ;(async () => {
      // Load project stage
      const { data: project } = await supabase
        .from('projects')
        .select('stage')
        .eq('id', projectId)
        .single()

      if (cancelled) return
      if (project) setStage(project.stage)

      // Load scenes
      const { data: sceneRows, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })

      if (cancelled) return
      if (error) {
        console.error('Failed to load scenes:', error)
        return
      }

      setScenesAndRef(
        (sceneRows || []).map((s) => ({
          sentence: s.sentence,
          imagePrompt: s.image_prompt,
          klingPrompt: s.kling_prompt,
          imgStatus: s.img_status,
          vidStatus: s.vid_status,
          imageUrl: s.image_url,
          videoUrl: s.video_url,
          audioStatus: s.audio_status || 'pending',
          audioUrl: s.audio_url || null,
        }))
      )
    })().catch((err) => console.error('Failed to load pipeline data:', err))

    return () => { cancelled = true }
  }, [projectId])

  // Helper: update a single scene in both React state and DB
  const updateScene = useCallback((idx, fields) => {
    setScenesAndRef((prev) => prev.map((s, i) => (i === idx ? { ...s, ...fields } : s)))

    if (!supabase || !projectId) return
    // Map React field names to DB column names
    const dbFields = {}
    if ('imgStatus' in fields) dbFields.img_status = fields.imgStatus
    if ('vidStatus' in fields) dbFields.vid_status = fields.vidStatus
    if ('imageUrl' in fields) dbFields.image_url = fields.imageUrl
    if ('videoUrl' in fields) dbFields.video_url = fields.videoUrl
    if ('sentence' in fields) dbFields.sentence = fields.sentence
    if ('imagePrompt' in fields) dbFields.image_prompt = fields.imagePrompt
    if ('klingPrompt' in fields) dbFields.kling_prompt = fields.klingPrompt
    if ('audioStatus' in fields) dbFields.audio_status = fields.audioStatus
    if ('audioUrl' in fields) dbFields.audio_url = fields.audioUrl

    if (Object.keys(dbFields).length > 0) {
      supabase
        .from('scenes')
        .update(dbFields)
        .eq('project_id', projectId)
        .eq('position', idx)
        .then(({ error }) => {
          if (error) console.error(`Failed to update scene ${idx}:`, error)
        })
        .catch((err) => console.error('Scene update network error:', err))
    }
  }, [projectId])

  // Helper: update stage in both React state and DB
  const updateStage = useCallback((newStage) => {
    setStage(newStage)
    onStageChange?.(newStage)
    if (supabase && projectId) {
      supabase
        .from('projects')
        .update({ stage: newStage })
        .eq('id', projectId)
        .then(({ error }) => {
          if (error) console.error('Failed to update stage:', error)
        })
        .catch((err) => console.error('Stage update network error:', err))
    }
  }, [projectId, onStageChange])

  // --- Per-scene generation methods ---

  const generateSingleImage = useCallback(async (idx) => {
    if (!apiKeys.nanoBanana) { onMissingKeys(); return }

    // Abort any existing generation for this scene
    const key = `img-${idx}`
    sceneAbortRefs.current.get(key)?.abort()
    const controller = new AbortController()
    sceneAbortRefs.current.set(key, controller)

    // When regenerating an image, reset the video too (it was based on old image)
    updateScene(idx, { imgStatus: 'loading', vidStatus: 'pending', videoUrl: null })
    onActivity?.('image_loading', `Scene ${idx + 1} image generating...`, idx)

    try {
      const currentPrompt = scenesRef.current[idx]?.imagePrompt
      if (!currentPrompt || typeof currentPrompt !== 'string') {
        console.warn(`Scene ${idx}: missing or invalid imagePrompt`, currentPrompt)
        throw new Error(`Scene ${idx + 1} has no image prompt`)
      }
      const { imageUrl } = await generateAndPollImage(apiKeys.nanoBanana, currentPrompt, controller.signal)
      updateScene(idx, { imgStatus: 'done', imageUrl })
      onActivity?.('image_done', `Scene ${idx + 1} image done`, idx)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error(`Image gen failed for scene ${idx}:`, err)
      updateScene(idx, { imgStatus: 'error', imgError: err.message })
      onActivity?.('image_error', `Scene ${idx + 1} image failed: ${err.message}`, idx)
    } finally {
      sceneAbortRefs.current.delete(key)
    }
  }, [apiKeys.nanoBanana, onMissingKeys, onActivity, updateScene])

  const generateSingleVideo = useCallback(async (idx) => {
    if (!apiKeys.klingAccessKey || !apiKeys.klingSecretKey) { onMissingKeys(); return }

    const key = `vid-${idx}`
    sceneAbortRefs.current.get(key)?.abort()
    const controller = new AbortController()
    sceneAbortRefs.current.set(key, controller)

    // Read current scene state
    const scene = scenesRef.current[idx]

    if (scene?.imgStatus !== 'done' || !scene?.imageUrl) {
      onActivity?.('video_error', `Scene ${idx + 1}: image required first`, idx)
      return
    }

    updateScene(idx, { vidStatus: 'loading' })
    onActivity?.('video_loading', `Scene ${idx + 1} video generating...`, idx)

    try {
      const { videoUrl } = await generateAndPollVideo(apiKeys.klingAccessKey, apiKeys.klingSecretKey, scene.imageUrl, scene.klingPrompt, controller.signal)
      updateScene(idx, { vidStatus: 'done', videoUrl })
      onActivity?.('video_done', `Scene ${idx + 1} video done`, idx)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error(`Video gen failed for scene ${idx}:`, err)
      updateScene(idx, { vidStatus: 'error', vidError: err.message })
      onActivity?.('video_error', `Scene ${idx + 1} video failed: ${err.message}`, idx)
    } finally {
      sceneAbortRefs.current.delete(key)
    }
  }, [apiKeys.klingAccessKey, apiKeys.klingSecretKey, onMissingKeys, onActivity, updateScene])

  const generateTranscriptAudio = useCallback(async () => {
    if (!apiKeys.elevenLabs) return

    // Abort any existing transcript audio generation
    transcriptAudioAbortRef.current?.abort()
    const controller = new AbortController()
    transcriptAudioAbortRef.current = controller

    // Revoke existing blob URL to avoid memory leaks
    setTranscriptAudio((prev) => {
      if (prev.url && prev.url.startsWith('blob:')) URL.revokeObjectURL(prev.url)
      return { status: 'loading', url: null }
    })

    updateStage('audio')
    onActivity?.('audio_loading', 'Generating transcript audio...')

    try {
      // Combine all sentences into one transcript, stripping [N] prefixes
      const fullText = scenesRef.current
        .map((s) => (s.sentence || '').replace(/^\[\d+\]\s*/, ''))
        .filter(Boolean)
        .join(' ')

      if (!fullText) throw new Error('No sentence text to generate audio from')

      const { audioUrl } = await generateSpeech(apiKeys.elevenLabs, fullText, undefined, controller.signal)
      setTranscriptAudio({ status: 'done', url: audioUrl })
      onActivity?.('audio_done', 'Transcript audio done')
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Transcript audio gen failed:', err)
      setTranscriptAudio({ status: 'error', url: null })
      onActivity?.('audio_error', `Transcript audio failed: ${err.message}`)
    } finally {
      transcriptAudioAbortRef.current = null
    }
  }, [apiKeys.elevenLabs, onActivity, updateStage])

  const cancelSceneGeneration = useCallback((type, idx) => {
    const key = `${type}-${idx}`
    const controller = sceneAbortRefs.current.get(key)
    if (controller) {
      controller.abort()
      sceneAbortRefs.current.delete(key)
      const statusField = type === 'img' ? 'imgStatus' : 'vidStatus'
      updateScene(idx, { [statusField]: 'pending' })
      const typeLabel = type === 'img' ? 'image' : 'video'
      onActivity?.(`${typeLabel}_cancelled`, `Scene ${idx + 1} ${typeLabel} cancelled`, idx)
    }
  }, [updateScene, onActivity])

  const cancelTranscriptAudio = useCallback(() => {
    transcriptAudioAbortRef.current?.abort()
    transcriptAudioAbortRef.current = null
    setTranscriptAudio({ status: 'pending', url: null })
    onActivity?.('audio_cancelled', 'Transcript audio cancelled')
  }, [onActivity])

  // --- Granular pipeline methods ---

  const initScenesOnly = useCallback(async (pipelineData) => {
    const newScenes = pipelineData.sentences.map((sentence, i) => ({
      sentence,
      imagePrompt: pipelineData.imagePrompts[i],
      klingPrompt: pipelineData.klingPrompts[i],
      imgStatus: 'pending',
      vidStatus: 'pending',
      audioStatus: 'pending',
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
    }))

    // Delete existing scenes if re-generating
    if (supabase && projectId) {
      await supabase.from('scenes').delete().eq('project_id', projectId)
    }

    setScenesAndRef(newScenes)
    updateStage('script')
    onActivity?.('script_init', `Script created — ${newScenes.length} scenes`)

    // Bulk insert into DB
    if (supabase && projectId) {
      const rows = newScenes.map((s, i) => ({
        project_id: projectId,
        position: i,
        sentence: s.sentence,
        image_prompt: s.imagePrompt,
        kling_prompt: s.klingPrompt,
        img_status: 'pending',
        vid_status: 'pending',
        audio_status: 'pending',
      }))
      const { error } = await supabase.from('scenes').insert(rows)
      if (error) console.error('Failed to insert scenes:', error)
    }
  }, [projectId, updateStage, onActivity])

  const generateImagesForScenes = useCallback(async (indices) => {
    if (!apiKeys.nanoBanana) { onMissingKeys(); return }

    updateStage('images')
    onActivity?.('stage_change', `Generating images for ${indices.length} scene(s)`)

    // Process in batches
    const batches = []
    for (let i = 0; i < indices.length; i += IMAGE_BATCH_SIZE) {
      batches.push(indices.slice(i, i + IMAGE_BATCH_SIZE))
    }

    for (const batch of batches) {
      await Promise.all(batch.map((idx) => generateSingleImage(idx)))
    }
  }, [apiKeys.nanoBanana, onMissingKeys, onActivity, updateStage, generateSingleImage])

  const generateVideosForScenes = useCallback(async (indices) => {
    if (!apiKeys.klingAccessKey || !apiKeys.klingSecretKey) { onMissingKeys(); return }

    // Filter to scenes with completed images
    const currentScenes = scenesRef.current

    const validIndices = indices.filter((idx) => currentScenes[idx]?.imgStatus === 'done' && currentScenes[idx]?.imageUrl)

    if (validIndices.length === 0) {
      onActivity?.('video_error', 'No scenes with completed images to generate videos for')
      return
    }

    updateStage('videos')
    onActivity?.('stage_change', `Generating videos for ${validIndices.length} scene(s) — one at a time`)

    // Process videos ONE AT A TIME to respect Kling concurrency limits
    for (const idx of validIndices) {
      // Re-check image readiness right before starting (state may have changed)
      const scene = scenesRef.current[idx]
      if (scene?.imgStatus !== 'done' || !scene?.imageUrl) {
        onActivity?.('video_error', `Scene ${idx + 1}: skipped — image not ready`, idx)
        continue
      }
      await generateSingleVideo(idx)
    }
  }, [apiKeys.klingAccessKey, apiKeys.klingSecretKey, onMissingKeys, onActivity, updateStage, generateSingleVideo])

  // generateAudioForScenes is now just generateTranscriptAudio (single call for whole transcript)

  const updateScenePrompts = useCallback((updates) => {
    for (const { idx, ...fields } of updates) {
      updateScene(idx, fields)
    }
    onActivity?.('scenes_updated', `Updated ${updates.length} scene(s)`)
  }, [updateScene, onActivity])

  const startPipeline = useCallback(async (pipelineData) => {
    // Check for required keys
    if (!apiKeys.nanoBanana || !apiKeys.klingAccessKey || !apiKeys.klingSecretKey) {
      onMissingKeys()
      return
    }

    const abortController = new AbortController()
    abortRef.current = abortController
    const signal = abortController.signal

    // Initialize scenes
    const newScenes = pipelineData.sentences.map((sentence, i) => ({
      sentence,
      imagePrompt: pipelineData.imagePrompts[i],
      klingPrompt: pipelineData.klingPrompts[i],
      imgStatus: 'pending',
      vidStatus: 'pending',
      audioStatus: 'pending',
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
    }))

    setScenesAndRef(newScenes)
    updateStage('script')
    setIsRunning(true)
    onActivity?.('pipeline_init', `Pipeline started — ${newScenes.length} scenes`)

    // Bulk insert scenes into DB
    if (supabase && projectId) {
      const rows = newScenes.map((s, i) => ({
        project_id: projectId,
        position: i,
        sentence: s.sentence,
        image_prompt: s.imagePrompt,
        kling_prompt: s.klingPrompt,
        img_status: 'pending',
        vid_status: 'pending',
        audio_status: 'pending',
      }))
      const { error } = await supabase.from('scenes').insert(rows)
      if (error) console.error('Failed to insert scenes:', error)
    }

    // Small delay so user sees the script stage
    await new Promise((r) => setTimeout(r, 800))
    if (signal.aborted) return

    // --- SEQUENTIAL SCENE PROCESSING (1 image → 1 video at a time) ---
    updateStage('images')
    onActivity?.('stage_change', 'Stage: generating scenes sequentially')

    for (let idx = 0; idx < newScenes.length; idx++) {
      if (signal.aborted) break

      // 1. Generate image
      updateScene(idx, { imgStatus: 'loading' })
      onActivity?.('image_loading', `Scene ${idx + 1} image generating...`, idx)
      try {
        const { imageUrl } = await generateAndPollImage(apiKeys.nanoBanana, newScenes[idx].imagePrompt, signal)
        updateScene(idx, { imgStatus: 'done', imageUrl })
        onActivity?.('image_done', `Scene ${idx + 1} image done`, idx)
      } catch (err) {
        if (err.name === 'AbortError') break
        console.error(`Image gen failed for scene ${idx}:`, err)
        updateScene(idx, { imgStatus: 'error', imgError: err.message })
        onActivity?.('image_error', `Scene ${idx + 1} image failed: ${err.message}`, idx)
        continue
      }

      if (signal.aborted) break

      // 2. Generate video (uses captured imageUrl, not scenesRef — avoids React state race)
      updateStage('videos')
      updateScene(idx, { vidStatus: 'loading' })
      onActivity?.('video_loading', `Scene ${idx + 1} video generating...`, idx)
      try {
        const { videoUrl } = await generateAndPollVideo(apiKeys.klingAccessKey, apiKeys.klingSecretKey, imageUrl, newScenes[idx].klingPrompt, signal)
        updateScene(idx, { vidStatus: 'done', videoUrl })
        onActivity?.('video_done', `Scene ${idx + 1} video done`, idx)
      } catch (err) {
        if (err.name === 'AbortError') break
        console.error(`Video gen failed for scene ${idx}:`, err)
        updateScene(idx, { vidStatus: 'error', vidError: err.message })
        onActivity?.('video_error', `Scene ${idx + 1} video failed: ${err.message}`, idx)
      }

      // Switch back to images stage for next scene's image
      if (idx < newScenes.length - 1 && !signal.aborted) {
        updateStage('images')
      }
    }

    // --- AUDIO STAGE (after all videos) ---
    if (!signal.aborted && apiKeys.elevenLabs) {
      await generateTranscriptAudio()
    }

    if (!signal.aborted) {
      updateStage('done')
      setIsRunning(false)
      onActivity?.('pipeline_done', 'Pipeline complete')
    }
  }, [apiKeys.nanoBanana, apiKeys.klingAccessKey, apiKeys.klingSecretKey, apiKeys.elevenLabs, onMissingKeys, onActivity, projectId, updateScene, updateStage, generateTranscriptAudio])

  const cancelPipeline = useCallback(() => {
    abortRef.current?.abort()
    setIsRunning(false)
    onActivity?.('pipeline_cancelled', 'Pipeline cancelled')
  }, [onActivity])

  const resetPipeline = useCallback(async () => {
    abortRef.current?.abort()
    transcriptAudioAbortRef.current?.abort()
    // Revoke transcript audio blob URL
    setTranscriptAudio((prev) => {
      if (prev.url && prev.url.startsWith('blob:')) URL.revokeObjectURL(prev.url)
      return { status: 'pending', url: null }
    })
    setScenesAndRef([])
    setStage('ideas')
    setIsRunning(false)

    // Delete scenes from DB and reset project stage
    if (supabase && projectId) {
      await supabase.from('scenes').delete().eq('project_id', projectId)
      await supabase.from('projects').update({ stage: 'ideas' }).eq('id', projectId)
    }
  }, [projectId])

  return { scenes, stage, isRunning, transcriptAudio, startPipeline, cancelPipeline, resetPipeline, setScenes: setScenesAndRef, updateScene, generateSingleImage, generateSingleVideo, generateTranscriptAudio, cancelTranscriptAudio, cancelSceneGeneration, initScenesOnly, generateImagesForScenes, generateVideosForScenes, updateScenePrompts }
}
