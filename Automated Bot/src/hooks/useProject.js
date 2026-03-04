import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'vp-current-project'

const EMPTY_INSTRUCTIONS = {
  ideaInstructions: '', scriptInstructions: '', characterDescription: '',
  imageInstructions: '', videoInstructions: '',
  sampleInput: '', sampleOutput: '',
}

export default function useProject() {
  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null
  )
  const [loading, setLoading] = useState(true)
  const [projectInstructions, setProjectInstructions] = useState(EMPTY_INSTRUCTIONS)

  // Load project list from project_summaries view
  const loadProjects = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('project_summaries')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to load projects:', error)
      return
    }
    setProjects(data || [])
  }, [])

  // Initial load
  useEffect(() => {
    loadProjects()
      .then(() => setLoading(false))
      .catch((err) => { console.error('Failed to load projects:', err); setLoading(false) })
  }, [loadProjects])

  // Validate stored project ID still exists
  useEffect(() => {
    if (!loading && currentProjectId && projects.length > 0) {
      const exists = projects.some((p) => p.id === currentProjectId)
      if (!exists) {
        setCurrentProjectId(null)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [loading, currentProjectId, projects])

  const selectProject = useCallback((id) => {
    setCurrentProjectId(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const createProject = useCallback(async (title = 'Untitled Project') => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('projects')
      .insert({ title })
      .select()
      .single()

    if (error) {
      console.error('Failed to create project:', error)
      return null
    }

    await loadProjects()
    selectProject(data.id)
    return data
  }, [loadProjects, selectProject])

  const deleteProject = useCallback(async (id) => {
    if (!supabase) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete project:', error)
      return
    }

    if (currentProjectId === id) {
      selectProject(null)
    }
    await loadProjects()
  }, [currentProjectId, loadProjects, selectProject])

  const renameProject = useCallback(async (id, title) => {
    if (!supabase) return
    const { error } = await supabase
      .from('projects')
      .update({ title })
      .eq('id', id)

    if (error) {
      console.error('Failed to rename project:', error)
      return
    }
    await loadProjects()
  }, [loadProjects])

  const updateProjectStage = useCallback(async (id, stage) => {
    if (!supabase || !id) return
    const { error } = await supabase
      .from('projects')
      .update({ stage })
      .eq('id', id)

    if (error) {
      console.error('Failed to update project stage:', error)
    }
  }, [])

  // Load project instructions when currentProjectId changes
  useEffect(() => {
    if (!currentProjectId || !supabase) {
      setProjectInstructions(EMPTY_INSTRUCTIONS)
      return
    }

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('idea_instructions, script_instructions, character_description, image_instructions, video_instructions, sample_input, sample_output')
        .eq('id', currentProjectId)
        .single()

      if (cancelled) return
      if (error) {
        console.error('Failed to load project instructions:', error)
        setProjectInstructions(EMPTY_INSTRUCTIONS)
        return
      }
      setProjectInstructions({
        ideaInstructions: data.idea_instructions || '',
        scriptInstructions: data.script_instructions || '',
        characterDescription: data.character_description || '',
        imageInstructions: data.image_instructions || '',
        videoInstructions: data.video_instructions || '',
        sampleInput: data.sample_input || '',
        sampleOutput: data.sample_output || '',
      })
    })()

    return () => { cancelled = true }
  }, [currentProjectId])

  const saveProjectInstructions = useCallback(async (id, instructions) => {
    if (!supabase || !id) return
    const { error } = await supabase
      .from('projects')
      .update({
        idea_instructions: instructions.ideaInstructions,
        script_instructions: instructions.scriptInstructions,
        character_description: instructions.characterDescription,
        image_instructions: instructions.imageInstructions,
        video_instructions: instructions.videoInstructions,
        sample_input: instructions.sampleInput,
        sample_output: instructions.sampleOutput,
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to save project instructions:', error)
      return false
    }
    setProjectInstructions(instructions)
    return true
  }, [])

  return {
    projects,
    currentProjectId,
    loading,
    selectProject,
    createProject,
    deleteProject,
    renameProject,
    updateProjectStage,
    refreshProjects: loadProjects,
    projectInstructions,
    saveProjectInstructions,
  }
}
