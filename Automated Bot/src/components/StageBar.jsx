import { STAGES } from '../lib/constants'

export default function StageBar({ currentStage, viewingStep, onStepClick }) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage)

  return (
    <div className="flex items-center justify-center gap-1">
      {STAGES.map((stage, i) => {
        const isCompleted = i < currentIndex
        const isActive = i === currentIndex
        const isClickable = i <= currentIndex || (currentIndex >= 1 && i <= 4)
        const isViewing = viewingStep === stage.id

        return (
          <div key={stage.id} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                onClick={isClickable && onStepClick ? () => onStepClick(stage.id) : undefined}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted
                    ? 'bg-yellow-500 text-gray-900'
                    : isActive
                    ? 'border-2 border-yellow-500 text-yellow-400 animate-pulse-ring'
                    : 'border-2 border-gray-700 text-gray-600'
                } ${isClickable ? 'cursor-pointer hover:scale-110' : ''} ${
                  isViewing ? 'ring-2 ring-yellow-400/60' : ''
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stage.num
                )}
              </div>
              <span
                onClick={isClickable && onStepClick ? () => onStepClick(stage.id) : undefined}
                className={`text-[10px] mt-1 ${
                  isViewing ? 'text-yellow-400 font-semibold' : isActive ? 'text-yellow-400' : 'text-gray-600'
                } ${isClickable ? 'cursor-pointer' : ''}`}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 mb-4 ${
                  i < currentIndex ? 'bg-yellow-500' : 'bg-gray-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
