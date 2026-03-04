import { useEffect, useRef } from 'react'

const TYPE_CONFIG = {
  chat_sent:          { icon: '→', color: 'text-blue-400' },
  chat_thinking:      { icon: '⟳', color: 'text-yellow-400 animate-pulse' },
  chat_responded:     { icon: '←', color: 'text-green-400' },
  chat_pipeline:      { icon: '▶', color: 'text-purple-400' },
  pipeline_init:      { icon: '▶', color: 'text-purple-400' },
  stage_change:       { icon: '◆', color: 'text-indigo-400' },
  image_loading:      { icon: '⟳', color: 'text-yellow-400 animate-pulse' },
  image_done:         { icon: '✓', color: 'text-green-400' },
  image_error:        { icon: '✗', color: 'text-red-400' },
  video_loading:      { icon: '⟳', color: 'text-yellow-400 animate-pulse' },
  video_done:         { icon: '✓', color: 'text-green-400' },
  video_error:        { icon: '✗', color: 'text-red-400' },
  pipeline_done:      { icon: '✓', color: 'text-green-400' },
  pipeline_cancelled: { icon: '■', color: 'text-orange-400' },
}

const DEFAULT_CONFIG = { icon: '•', color: 'text-gray-400' }

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function ActivityFeed({ entries = [], mode = 'full' }) {
  const scrollRef = useRef(null)

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  const isFull = mode === 'full'

  if (entries.length === 0) {
    return (
      <div className={`flex items-center justify-center ${isFull ? 'h-full' : 'h-full min-h-[60px]'}`}>
        <p className="text-gray-600 text-sm">Start chatting with Claude — activity will appear here</p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={`overflow-y-auto scrollbar-thin ${isFull ? 'h-full' : ''}`}
      style={!isFull ? { maxHeight: '160px' } : undefined}
    >
      <div className={`flex flex-col gap-0.5 ${isFull ? 'p-4' : 'p-2'}`}>
        {entries.map((entry) => {
          const config = TYPE_CONFIG[entry.type] || DEFAULT_CONFIG
          return (
            <div
              key={entry.id}
              className="flex items-start gap-2 text-xs animate-activity-fade-in"
            >
              <span className={`${config.color} w-4 text-center shrink-0 leading-5`}>
                {config.icon}
              </span>
              <span className="text-gray-500 shrink-0 leading-5 tabular-nums">
                {formatTime(entry.timestamp)}
              </span>
              <span className="text-gray-300 leading-5 min-w-0 break-words">
                {entry.message}
                {entry.duration && (
                  <span className="text-gray-500 ml-1">({entry.duration}s)</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
