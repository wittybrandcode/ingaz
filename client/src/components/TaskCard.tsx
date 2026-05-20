import { Settings, CheckSquare } from 'lucide-react'
import StatsPill from './StatsPill'
import AvatarStack from './AvatarStack'
import ProgressBar from './ProgressBar'

interface TaskCardProps {
  task: {
    id: number
    title: string
    description?: string | null
    subtasks_count: number
    approved_count?: number
    assignees?: { name: string; avatar?: string | null }[]
  }
  selected: boolean
  onSelect: () => void
  onSettings: () => void
  onView?: () => void
  index: number
}

export default function TaskCard({ task, selected, onSelect, onSettings, onView, index }: TaskCardProps) {
  const progress = task.subtasks_count > 0
    ? Math.round(((task.approved_count || 0) / task.subtasks_count) * 100)
    : 0

  return (
    <div
      className="card-hover rounded-xl p-4 bg-white anim-fade shadow-sm"
      style={{
        animationDelay: `${index * 0.05}s`,
        border: selected ? '2px solid #E5A700' : '2px solid transparent',
      }}
      onClick={onSelect}
      onDoubleClick={onView}
      tabIndex={0}
      role="button"
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onView?.() } }}
    >
      <div className="flex justify-end items-start mb-2">
        <button
          onClick={e => { e.stopPropagation(); onSettings() }}
          className="w-7 h-7 rounded-full border-none flex items-center justify-center cursor-pointer shrink-0 hover:bg-gray-200 transition-all bg-gray-100 text-gray-400 hover:text-gray-600"
          title="إعدادات"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-1.5 leading-snug">{task.title}</h3>

      {task.description && (
        <p className="text-[0.7rem] text-gray-500 leading-relaxed mb-2.5 line-clamp-2">
          {task.description.replace(/<[^>]+>/g, '').trim()}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap min-h-6 mb-2.5">
        <StatsPill icon={CheckSquare} count={task.subtasks_count || 0} label="مهام فرعية" color="purple" />
        {task.assignees && task.assignees.length > 0 && (
          <div className="mr-auto">
            <AvatarStack users={task.assignees} max={3} size="xs" />
          </div>
        )}
      </div>

      <ProgressBar value={progress} size="sm" showLabel />
    </div>
  )
}
