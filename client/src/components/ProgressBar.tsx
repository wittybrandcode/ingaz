interface ProgressBarProps {
  value: number
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export default function ProgressBar({ value, size = 'sm', showLabel = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const color = clamped >= 100 ? 'bg-green-500' : clamped >= 50 ? 'bg-amber-500' : 'bg-blue-500'
  const height = size === 'md' ? 'h-2' : 'h-1.5'

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} rounded-full bg-gray-200 overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-[0.6rem] font-bold shrink-0 ${color.replace('bg-', 'text-')}`}>
          {clamped}%
        </span>
      )}
    </div>
  )
}
