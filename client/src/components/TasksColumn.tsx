import { useState } from 'react'
import { Plus, ClipboardList } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import KanbanColumn from './KanbanColumn'
import TaskCard from './TaskCard'
import type { Task, Project } from '../types'

interface Props {
  tasks: Task[]
  total: number
  selectedProject: Project | null
  selectedId: number | null
  loadingMore: string
  onSelect: (item: Task) => void
  onSettings: (item: Task) => void
  onView: (item: Task) => void
  onCreated: (task: Task) => void
  onLoadMore: () => void
  bg: string
}

export default function TasksColumn({ tasks, total, selectedProject, selectedId, loadingMore, onSelect, onSettings, onView, onCreated, onLoadMore, bg }: Props) {
  const user = useAuthStore(s => s.user)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')

  const filteredTasks = selectedProject ? tasks.filter(t => t.project_id === selectedProject.id) : []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedProject) return
    try {
      const { data } = await api.post('/tasks', { project_id: selectedProject.id, title: title.trim() })
      onCreated(data)
      setShowForm(false)
      setTitle('')
    } catch { /* toast handled by api interceptor */ }
  }

  return (
    <KanbanColumn header={
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-bold text-gray-600">المهام</span>
          <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{filteredTasks.length}</span>
        </div>
        {selectedProject && user?.is_manager && (
          <button onClick={() => setShowForm(true)}
            className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة مهمة">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
    } bg={bg}>
      {showForm && selectedProject && (
        <form onSubmit={handleCreate}
          className="mx-2 mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم المهمة"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1" autoFocus />
          <div className="flex gap-1">
            <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[0.6rem] font-medium hover:bg-indigo-700">إنشاء</button>
            <button type="button" onClick={() => { setShowForm(false); setTitle('') }} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[0.6rem] hover:bg-gray-200">إلغاء</button>
          </div>
        </form>
      )}
      {!selectedProject ? (
        <div className="text-center py-8 text-gray-400 text-xs">اختر مشروعاً لعرض المهام</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-xs">لا توجد مهام في هذا المشروع</div>
      ) : (
        filteredTasks.map((t, i) => (
          <TaskCard key={t.id} task={t}
            selected={selectedId === t.id}
            onSelect={() => onSelect(t)}
            onSettings={() => onSettings(t)}
            onView={() => onView(t)}
            index={i} />
        ))
      )}
      {tasks.length < total && (
        <button onClick={onLoadMore} disabled={loadingMore === 'tasks'}
          className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
          {loadingMore === 'tasks' ? 'جاري...' : `عرض المزيد (${total - tasks.length} متبقي)`}
        </button>
      )}
    </KanbanColumn>
  )
}
