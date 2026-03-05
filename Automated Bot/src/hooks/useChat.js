import { useState, useCallback, useRef, useEffect } from 'react'
import { sendMessage } from '../lib/claudeApi'
import { validatePipelineData, parsePipelineResponse } from '../lib/pipelineParser'
import { buildProjectContext } from '../lib/constants'
import { supabase } from '../lib/supabase'

export default function useChat({ onPipelineData, onToolUse, projectId, scenes, stage, projectInstructions }) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes
  const stageRef = useRef(stage)
  stageRef.current = stage
  const instructionsRef = useRef(projectInstructions)
  instructionsRef.current = projectInstructions

  // Load messages from DB when projectId changes
  useEffect(() => {
    if (!projectId || !supabase) {
      setMessages([])
      return
    }

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('role, content, is_pipeline')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (error) {
        console.error('Failed to load messages:', error)
        return
      }
      setMessages(
        (data || []).map((m) => ({
          role: m.role,
          content: m.content,
          isPipeline: m.is_pipeline,
        }))
      )
    })().catch((err) => console.error('Failed to load messages:', err))

    return () => { cancelled = true }
  }, [projectId])

  // Helper: persist a message to DB (fire-and-forget, internally safe)
  const saveMessage = useCallback(async (role, content, isPipeline = false) => {
    if (!supabase || !projectId) return
    try {
      const { error } = await supabase.from('messages').insert({
        project_id: projectId,
        role,
        content,
        is_pipeline: isPipeline,
      })
      if (error) console.error('Failed to save message:', error)
    } catch (err) {
      console.error('Message save network error:', err)
    }
  }, [projectId])

  // Detect @N scene references and append scene context to the message
  const enrichWithSceneRefs = useCallback((text) => {
    const matches = text.match(/@(\d+)/g)
    if (!matches || !scenesRef.current?.length) return text

    const seen = new Set()
    const sceneDetails = []
    for (const match of matches) {
      const num = parseInt(match.slice(1), 10)
      if (seen.has(num)) continue
      seen.add(num)
      const scene = scenesRef.current[num - 1]
      if (!scene) continue
      sceneDetails.push(
        `\n[Scene ${num} current data]\n` +
        `Sentence: ${scene.sentence || '(none)'}\n` +
        `Image prompt: ${scene.imagePrompt || '(none)'}\n` +
        `Kling prompt: ${scene.klingPrompt || '(none)'}`
      )
    }

    if (sceneDetails.length === 0) return text
    return text + '\n\n---' + sceneDetails.join('\n')
  }, [])

  const send = useCallback(async (text) => {
    const userMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // Enrich message with scene data if @N references are present
    const enrichedText = enrichWithSceneRefs(text)

    // Persist user message (original text, not enriched)
    saveMessage('user', text)

    abortRef.current = new AbortController()

    try {
      const enrichedUserMsg = { role: 'user', content: enrichedText }
      const conversationHistory = [...messagesRef.current, enrichedUserMsg].filter(
        (m) => !(m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('Error:'))
          && !m.isPipeline
      )
      const projectContext = buildProjectContext(scenesRef.current, stageRef.current)
      const {
        ideaInstructions, scriptInstructions, characterDescription,
        imageInstructions, videoInstructions, sampleInput, sampleOutput,
      } = instructionsRef.current || {}
      const response = await sendMessage(conversationHistory, abortRef.current.signal, {
        projectContext, ideaInstructions, scriptInstructions, characterDescription,
        imageInstructions, videoInstructions, sampleInput, sampleOutput,
      })

      // Handle tool_use responses
      if (response.toolUses && response.toolUses.length > 0) {
        let handled = false

        for (const toolUse of response.toolUses) {
          if (toolUse.name === 'generate_pipeline') {
            console.log('[Pipeline] Raw data from Claude:', JSON.stringify(toolUse.input).substring(0, 500))
            const validated = validatePipelineData(toolUse.input)
            if (validated) {
              const displayText = response.text || 'Pipeline generated — check the right panel'
              setMessages((prev) => [...prev, { role: 'assistant', content: displayText, isPipeline: true }])
              saveMessage('assistant', displayText, true)
              onPipelineData(validated)
              handled = true
            }
          } else if (toolUse.name === 'generate_script_only') {
            const validated = validatePipelineData(toolUse.input)
            if (validated) {
              const displayText = response.text || 'Script created — check the right panel'
              setMessages((prev) => [...prev, { role: 'assistant', content: displayText, isPipeline: true }])
              saveMessage('assistant', displayText, true)
              onToolUse?.({ name: toolUse.name, data: validated })
              handled = true
            }
          } else if (toolUse.name === 'update_scenes') {
            const displayText = response.text || 'Scenes updated — check the right panel'
            setMessages((prev) => [...prev, { role: 'assistant', content: displayText, isSceneUpdate: true }])
            saveMessage('assistant', displayText, false)
            onToolUse?.({ name: toolUse.name, data: toolUse.input })
            handled = true
          } else if (['generate_images', 'generate_videos'].includes(toolUse.name)) {
            const displayText = response.text || `Tool called: ${toolUse.name}`
            setMessages((prev) => [...prev, { role: 'assistant', content: displayText, isPipeline: true }])
            saveMessage('assistant', displayText, true)
            onToolUse?.({ name: toolUse.name, data: toolUse.input })
            handled = true
          }
        }

        if (!handled) {
          const errText = response.truncated
            ? 'Error: The response was too long and got cut off. Please try again — if the issue persists, ask for fewer scenes.'
            : (response.text || 'Error: Tool data was invalid. Please try again.')
          setMessages((prev) => [...prev, { role: 'assistant', content: errText }])
          saveMessage('assistant', errText)
        }
        return
      }

      // Normal text response — add to chat
      if (response.text) {
        const assistantMsg = { role: 'assistant', content: response.text }
        setMessages((prev) => [...prev, assistantMsg])
        saveMessage('assistant', response.text)

        // Fallback: check if Claude used the old ```pipeline format
        const fallbackData = parsePipelineResponse(response.text)
        if (fallbackData) {
          onPipelineData(fallbackData)
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      const errorMsg = { role: 'assistant', content: `Error: ${err.message}` }
      setMessages((prev) => [...prev, errorMsg])
      saveMessage('assistant', `Error: ${err.message}`)
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [onPipelineData, onToolUse, saveMessage, enrichWithSceneRefs])

  const clearMessages = useCallback(async () => {
    setMessages([])
    if (!supabase || !projectId) return
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('project_id', projectId)
      if (error) console.error('Failed to delete messages:', error)
    } catch (err) {
      console.error('Message delete network error:', err)
    }
  }, [projectId])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isLoading, send, cancel, clearMessages }
}
