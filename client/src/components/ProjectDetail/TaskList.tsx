import { useState } from 'react'
import { Plus, Paperclip } from 'lucide-react'
import FileUpload from '../FileUpload'
import type { Task } from '../../types'
import { ROLES } from '../../constants'

interface TaskListProps {
  tasks: Task[]
  selectedTaskId: number | null
  onSelectTask: (taskId: number) => void
  onCreateTask: (title: string, description: string, files: File[]) => Promise<void>
  canCreate: boolean
  userRole?: number
}

export default function TaskList({ tasks, selectedTaskId, onSelectTask, onCreateTask, canCreate, userRole }: TaskListProps) {
  const [taskForm, setTaskForm] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskFiles, setTaskFiles] = useState<File[]>([])
  const [creatingTask, setCreatingTask] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    setCreatingTask(true)
    const title = taskTitle; const desc = taskDesc; const files = taskFiles
    setTaskTitle(''); setTaskDesc(''); setTaskFiles([]); setTaskForm(false)
    try {
      await onCreateTask(title, desc, files)
    } finally { setCreatingTask(false) }
  }

  const isManager = userRole === ROLES.ADMIN || userRole === ROLES.DEPUTY

  return (
    <div className="lg:col-span-1 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">المهام</h2>
        {canCreate && (
          <button onClick={() => setTaskForm(true)}
            className="p-2 rounded-full text-indigo-600 hover:bg-indigo-50" title="إضافة مهمة">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {taskForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="عنوان المهمة"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" required />
          <input value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="وصف (اختياري)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
          <label className="flex items-center gap-1.5 text-xs text-indigo-600 cursor-pointer hover:text-indigo-800">
            <Paperclip className="w-3 h-3" /> إرفاق ملفات
            <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
              onChange={e => setTaskFiles(Array.from(e.target.files || []))} />
          </label>
          {taskFiles.length > 0 && (
            <div className="text-xs text-gray-500">{taskFiles.length} ملف محدد</div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={creatingTask} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">{creatingTask ? 'جاري...' : 'إضافة'}</button>
            <button type="button" onClick={() => { setTaskForm(false); setTaskFiles([]) }} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs">إلغاء</button>
          </div>
        </form>
      )}

      {tasks.length === 0 && !taskForm ? (
        <div className="text-center py-16 text-gray-400">
          {canCreate ? (
            <button onClick={() => setTaskForm(true)}
              className="inline-flex flex-col items-center gap-3 text-indigo-500 hover:text-indigo-700 transition-colors">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-indigo-400 flex items-center justify-center hover:bg-indigo-50">
                <Plus className="w-8 h-8" />
              </div>
              <span className="text-sm font-medium">إضافة مهمة جديدة</span>
            </button>
          ) : (
            <p>لا توجد مهام في هذا المشروع</p>
          )}
        </div>
      ) : tasks.map(t => {
        const pct = t.subtasks_count > 0 ? Math.round((t.completed_count / t.subtasks_count) * 100) : 0
        return (
          <div key={t.id} className={`rounded-lg border transition-colors ${selectedTaskId === t.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            <button onClick={() => onSelectTask(t.id)}
              className="w-full text-right p-3">
              <p className="font-medium text-sm text-gray-900">{t.title}</p>
              {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-500">{t.completed_count}/{t.subtasks_count}</span>
              </div>
            </button>
            {isManager && (
              <div className="px-3 pb-3" onClick={e => e.stopPropagation()}>
                <FileUpload entityType="task" entityId={t.id} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
