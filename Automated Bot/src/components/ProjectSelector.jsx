import { useState, useRef, useEffect } from 'react'

const STAGE_COLORS = {
  ideas: 'bg-gray-600',
  script: 'bg-blue-500',
  images: 'bg-purple-500',
  videos: 'bg-orange-500',
  done: 'bg-green-500',
}

export default function ProjectSelector({
  projects,
  currentProjectId,
  onSelect,
  onCreate,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const dropdownRef = useRef(null)

  const currentProject = projects.find((p) => p.id === currentProjectId)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
        setConfirmDelete(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleCreate = async () => {
    setIsOpen(false)
    await onCreate()
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (confirmDelete === id) {
      setConfirmDelete(null)
      setIsOpen(false)
      await onDelete(id)
    } else {
      setConfirmDelete(id)
    }
  }

  const handleSelect = (id) => {
    onSelect(id)
    setIsOpen(false)
    setConfirmDelete(null)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors max-w-[160px] truncate"
        title={currentProject?.title || 'No project selected'}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.06-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <span className="truncate">
          {currentProject ? currentProject.title : 'Select project'}
        </span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* New project button */}
          <button
            onClick={handleCreate}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-yellow-400 hover:bg-gray-800 transition-colors border-b border-gray-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>

          {/* Project list */}
          <div className="max-h-60 overflow-y-auto scrollbar-thin">
            {projects.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-600 text-center">No projects yet</p>
            )}
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                  p.id === currentProjectId
                    ? 'bg-yellow-500/10 text-yellow-200'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STAGE_COLORS[p.stage] || 'bg-gray-600'}`} />
                  <span className="truncate">{p.title}</span>
                  {p.total_scenes > 0 && (
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {p.total_scenes}s
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, p.id)}
                  className={`shrink-0 ml-2 transition-colors ${
                    confirmDelete === p.id
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                  title={confirmDelete === p.id ? 'Click again to confirm' : 'Delete project'}
                >
                  {confirmDelete === p.id ? (
                    <span className="text-[10px] font-medium">Delete?</span>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
