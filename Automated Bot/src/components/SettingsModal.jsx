import { useState, useEffect } from 'react'

const EMPTY_DRAFT = {
  ideaInstructions: '', scriptInstructions: '', characterDescription: '',
  imageInstructions: '', videoInstructions: '',
  sampleInput: '', sampleOutput: '',
}

const FIELDS = [
  {
    section: 'CREATIVE DIRECTION',
    fields: [
      { key: 'ideaInstructions', label: 'Idea & Brainstorming', rows: 3, placeholder: 'Focus on dramatic "what if" scenarios...' },
      { key: 'scriptInstructions', label: 'Script Writing', rows: 4, placeholder: 'Write in second person. Build tension...' },
    ],
  },
  {
    section: 'VISUAL IDENTITY',
    fields: [
      { key: 'characterDescription', label: 'Character Description', rows: 5, placeholder: 'A tall skeleton wearing a tattered medieval cloak...' },
      { key: 'imageInstructions', label: 'Image Prompt Philosophy', rows: 4, placeholder: 'Prefer cinematic wide shots. Use dramatic lighting...' },
      { key: 'videoInstructions', label: 'Video Animation Direction', rows: 3, placeholder: 'Slow deliberate camera movements. Atmospheric holds...' },
    ],
  },
  {
    section: 'FEW-SHOT EXAMPLE',
    fields: [
      { key: 'sampleInput', label: 'Sample Input', rows: 3, placeholder: 'Example user request...' },
      { key: 'sampleOutput', label: 'Sample Output', rows: 5, placeholder: 'Ideal Claude response...' },
    ],
  },
]

export default function SettingsModal({ isOpen, onClose, projectInstructions, onSaveInstructions, currentProjectId, projectTitle }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) setDraft({ ...EMPTY_DRAFT, ...projectInstructions })
  }, [isOpen, projectInstructions])

  if (!isOpen) return null

  const hasChanges = Object.keys(EMPTY_DRAFT).some(
    (k) => (draft[k] || '') !== (projectInstructions[k] || '')
  )

  const handleSave = async () => {
    if (!currentProjectId) return
    setSaving(true)
    await onSaveInstructions(currentProjectId, draft)
    setSaving(false)
    onClose()
  }

  const noProject = !currentProjectId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Project Settings</h2>
          {projectTitle && (
            <span className="text-sm text-gray-500 truncate ml-3 max-w-[200px]">{projectTitle}</span>
          )}
        </div>

        {noProject ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            No project selected. Create or select a project first.
          </p>
        ) : (
          <div className="space-y-4">
            {FIELDS.map(({ section, fields }, sIdx) => (
              <div key={section}>
                {sIdx > 0 && <hr className="border-gray-700 mb-4" />}
                <p className="text-[11px] font-semibold text-gray-500 tracking-widest mb-3">{section}</p>
                <div className="space-y-4">
                  {fields.map(({ key, label, rows, placeholder }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                      <textarea
                        rows={rows}
                        value={draft[key]}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-yellow-500 resize-y"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          {hasChanges && !noProject && (
            <span className="text-xs text-yellow-400 mr-auto">Unsaved changes</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={noProject || saving}
            className="px-4 py-2 text-sm bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
