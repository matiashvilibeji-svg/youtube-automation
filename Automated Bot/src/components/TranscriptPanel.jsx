import { useRef, useState, useCallback } from 'react'
import { downloadFile, downloadText } from '../lib/download'
import { ELEVENLABS_MODELS } from '../lib/constants'

export default function TranscriptPanel({
  scenes,
  transcriptAudio,
  onGenerate,
  onCancel,
  isRunning,
  voiceSettings,
  onSaveVoiceSettings,
  voices,
}) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(false)

  const status = transcriptAudio?.status || 'pending'
  const audioUrl = transcriptAudio?.url || null

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [])

  const updateSetting = useCallback((key, value) => {
    onSaveVoiceSettings?.({ ...voiceSettings, [key]: value })
  }, [voiceSettings, onSaveVoiceSettings])

  const handleVoiceChange = useCallback((voiceId) => {
    const voice = voices.find((v) => v.voice_id === voiceId)
    onSaveVoiceSettings?.({
      ...voiceSettings,
      voiceId,
      voiceName: voice?.name || voiceSettings?.voiceName || 'Unknown',
    })
  }, [voiceSettings, voices, onSaveVoiceSettings])

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-6 pb-2">
      {/* Voice Settings toggle */}
      <button
        onClick={handleToggleSettings}
        className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-400 transition-colors mb-2 self-start"
      >
        <span className={`transition-transform ${settingsExpanded ? 'rotate-90' : ''}`}>▶</span>
        Voice Settings
        {voiceSettings?.voiceName && (
          <span className="text-gray-600 ml-1">({voiceSettings.voiceName})</span>
        )}
      </button>

      {/* Voice Settings panel */}
      {settingsExpanded && (
        <div className="p-3 mb-3 bg-gray-900/80 rounded-lg border border-gray-800/50 space-y-3">
          {/* Voice select */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 w-24 shrink-0">Voice</label>
            <select
              value={voiceSettings?.voiceId || ''}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="flex-1 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500/50"
            >
              {voices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Model select */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 w-24 shrink-0">Model</label>
            <select
              value={voiceSettings?.modelId || ''}
              onChange={(e) => updateSetting('modelId', e.target.value)}
              className="flex-1 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500/50"
            >
              {ELEVENLABS_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Stability slider */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 w-24 shrink-0">Stability</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings?.stability ?? 0.5}
              onChange={(e) => updateSetting('stability', parseFloat(e.target.value))}
              className="flex-1 accent-purple-500 h-1"
            />
            <span className="text-[10px] text-gray-500 w-8 text-right">{(voiceSettings?.stability ?? 0.5).toFixed(2)}</span>
          </div>

          {/* Similarity Boost slider */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 w-24 shrink-0">Similarity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings?.similarityBoost ?? 0.75}
              onChange={(e) => updateSetting('similarityBoost', parseFloat(e.target.value))}
              className="flex-1 accent-purple-500 h-1"
            />
            <span className="text-[10px] text-gray-500 w-8 text-right">{(voiceSettings?.similarityBoost ?? 0.75).toFixed(2)}</span>
          </div>

          {/* Style slider */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 w-24 shrink-0">Style</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceSettings?.style ?? 0}
              onChange={(e) => updateSetting('style', parseFloat(e.target.value))}
              className="flex-1 accent-purple-500 h-1"
            />
            <span className="text-[10px] text-gray-500 w-8 text-right">{(voiceSettings?.style ?? 0).toFixed(2)}</span>
          </div>

          {/* Speaker Boost toggle */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 w-24 shrink-0">Speaker Boost</label>
            <button
              onClick={() => updateSetting('useSpeakerBoost', !voiceSettings?.useSpeakerBoost)}
              className={`w-8 h-4 rounded-full transition-colors relative ${
                voiceSettings?.useSpeakerBoost ? 'bg-purple-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                  voiceSettings?.useSpeakerBoost ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Audio controls bar */}
      <div className="flex items-center gap-3 mb-3 p-3 bg-gray-900/80 rounded-lg border border-gray-800/50">
        {status === 'done' && audioUrl ? (
          <>
            <button
              onClick={togglePlay}
              className="w-9 h-9 shrink-0 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center hover:bg-purple-500/30 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />
            <span className="text-xs text-purple-400">Transcript audio ready</span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => downloadFile(audioUrl, 'transcript-audio.mp3')}
                className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-300 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
                </svg>
                Download
              </button>
              <button
                onClick={onGenerate}
                className="text-xs px-3 py-1.5 bg-gray-800 text-gray-500 rounded-lg hover:bg-gray-700 hover:text-gray-400 transition-colors"
              >
                Regenerate
              </button>
            </div>
          </>
        ) : status === 'loading' ? (
          <>
            <div className="w-5 h-5 shrink-0 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-purple-300">Generating transcript audio...</span>
            <button
              onClick={onCancel}
              className="ml-auto text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-gray-400">
              {status === 'error' ? 'Audio generation failed.' : 'No audio generated yet.'}
            </span>
            <button
              onClick={onGenerate}
              disabled={isRunning}
              className={`ml-auto text-xs px-3 py-1.5 rounded-lg transition-colors ${
                status === 'error'
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {status === 'error' ? 'Retry' : 'Generate Audio'}
            </button>
          </>
        )}
      </div>

      {/* Transcript list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {scenes.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => {
                const text = scenes
                  .map((s, i) => `${i + 1}. ${(s.sentence || '').replace(/^\[\d+\]\s*/, '')}`)
                  .join('\n')
                downloadText(text, 'transcript.txt')
              }}
              className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
              </svg>
              Download Transcript
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          {scenes.map((scene, i) => {
            const text = (scene.sentence || '').replace(/^\[\d+\]\s*/, '')
            return (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2 bg-gray-900/40 rounded-lg border border-gray-800/30"
              >
                <span className="text-[10px] text-gray-600 font-mono pt-0.5 shrink-0 w-5 text-right">{i + 1}</span>
                <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
