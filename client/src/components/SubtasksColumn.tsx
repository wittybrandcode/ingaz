import { useState } from 'react'
import { Plus, ClipboardList } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import KanbanColumn from './KanbanColumn'
import SubtaskCard from './SubtaskCard'
import type { Subtask, Task } from '../types'

interface Props {
  subtasks: Subtask[]
  tasks: Task[]
  total: number
  selectedProject: any
  selectedTask: Task | null
  loadingMore: string
  hideCompleted: boolean
  onToggleHide: () => void
  onSelect: (type: string, item: any) => void
  onView: (item: Subtask) => void
  onCreated: (subtask: Subtask) => void
  onLoadMore: () => void
  bg: string
}

export default function SubtasksColumn({ subtasks, tasks, total, selectedProject, selectedTask, loadingMore, hideCompleted, onToggleHide, onSelect, onView, onCreated, onLoadMore, bg }: Props) {
  const user = useAuthStore(s => s.user)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [taskId, setTaskId] = useState<number | null>(null)

  const filteredSubtasks = (() => {
    if (!selectedTask) return []
    let list = subtasks.filter(s => s.task_id === selectedTask.id)
    if (hideCompleted) list = list.filter(s => s.status !== 'completed' && s.status !== 'cancelled')
    return list
  })()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const tid = taskId ?? selectedTask?.id
    if (!tid) return
    try {
      const { data } = await api.post('/subtasks', { task_id: tid, title: title.trim() })
      onCreated(data)
      setShowForm(false)
      setTitle('')
      setTaskId(null)
    } catch { /* toast handled by api interceptor */ }
  }

  return (
    <KanbanColumn header={
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-bold text-gray-600">المهام الفرعية</span>
          <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{filteredSubtasks.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {selectedProject && user?.is_manager && (
            <button onClick={() => { setShowForm(true); setTaskId(selectedTask?.id ?? null) }}
              className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة مهمة فرعية">
              <Plus className="w-3 h-3" />
            </button>
          )}
          <button onClick={onToggleHide}
            className={`px-1.5 py-0.5 rounded text-[0.55rem] font-medium transition-colors ${hideCompleted ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
            title={hideCompleted ? 'إظهار المنجز' : 'إخفاء المنجز'}>
            {hideCompleted ? 'إظهار' : 'إخفاء'}
          </button>
        </div>
      </div>
    } bg={bg}>
      {showForm && (
        <form onSubmit={handleCreate}
          className="mx-2 mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم المهمة الفرعية"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1" autoFocus />
          {!selectedTask && (
            <select value={taskId ?? ''} onChange={e => setTaskId(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1">
              <option value="">اختر المهمة</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
          <div className="flex gap-1">
            <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[0.6rem] font-medium hover:bg-indigo-700">إنشاء</button>
            <button type="button" onClick={() => { setShowForm(false); setTitle(''); setTaskId(null) }} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[0.6rem] hover:bg-gray-200">إلغاء</button>
          </div>
        </form>
      )}
      {!selectedTask && !showForm ? (
        <div className="text-center py-8 text-gray-400 text-xs">اختر مهمة لعرض المهام الفرعية</div>
      ) : filteredSubtasks.length === 0 && !showForm ? (
        <div className="text-center py-8 text-gray-400 text-xs">لا توجد مهام فرعية</div>
      ) : (
        filteredSubtasks.map((s, i) => (
          <SubtaskCard key={s.id} subtask={s}
            onSelect={onSelect}
            onView={() => onView(s)}
            index={i} />
        ))
      )}
      {subtasks.length < total && (
        <button onClick={onLoadMore} disabled={loadingMore === 'subtasks'}
          className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
          {loadingMore === 'subtasks' ? 'جاري...' : `عرض المزيد (${total - subtasks.length} متبقي)`}
        </button>
      )}
    </KanbanColumn>
  )
}
