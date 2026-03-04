import useYoutubeDownload from '../hooks/useYoutubeDownload'

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function YouTubeDownloader() {
  const { url, setUrl, videoInfo, status, error, fetchInfo, downloadMp3, reset } =
    useYoutubeDownload()

  const handleSubmit = (e) => {
    e.preventDefault()
    fetchInfo()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted && (pasted.includes('youtube.com') || pasted.includes('youtu.be'))) {
      // Auto-fetch on paste if it looks like a YouTube URL
      setTimeout(() => fetchInfo(pasted), 0)
    }
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">YouTube MP3 Downloader</h2>

      {/* URL Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={handlePaste}
          placeholder="Paste YouTube URL..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!url.trim() || status === 'fetching'}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg text-sm font-medium hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'fetching' ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching
            </span>
          ) : (
            'Fetch'
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Video Info Card */}
      {videoInfo && (
        <div className="mb-4 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex gap-3 p-3">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt="Thumbnail"
                className="w-32 h-20 object-cover rounded flex-shrink-0"
              />
            )}
            <div className="flex flex-col justify-center min-w-0">
              <h3 className="text-sm font-medium text-gray-100 truncate" title={videoInfo.title}>
                {videoInfo.title}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {formatDuration(videoInfo.duration)} &middot; {videoInfo.uploader}
              </p>
            </div>
          </div>

          {/* Download Button */}
          <div className="px-3 pb-3">
            <button
              onClick={downloadMp3}
              disabled={status === 'downloading'}
              className="w-full py-2.5 bg-yellow-500 text-gray-900 rounded-lg text-sm font-semibold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {status === 'downloading' ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Downloading...
                </>
              ) : status === 'done' ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Downloaded!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download MP3
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Reset */}
      {(videoInfo || error) && (
        <button
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors self-center"
        >
          Clear &amp; start over
        </button>
      )}

      {/* Empty state */}
      {status === 'idle' && !error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-600 text-center">
            Paste a YouTube URL above to extract audio as MP3.
          </p>
        </div>
      )}
    </div>
  )
}
