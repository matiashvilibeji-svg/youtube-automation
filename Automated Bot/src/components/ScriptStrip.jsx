import { useState } from 'react'

export default function ScriptStrip({ sentences }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>Script ({sentences.length} sentences)</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-3 max-h-40 overflow-y-auto scrollbar-thin">
          <ol className="space-y-1">
            {sentences.map((s, i) => (
              <li key={i} className="text-xs text-gray-400 leading-relaxed">
                <span className="text-yellow-500/60 mr-1">[{i + 1}]</span>
                {s.replace(/^\[\d+\]\s*/, '')}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
