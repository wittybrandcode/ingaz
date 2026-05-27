import { useState } from 'react'
import { Plus, List } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import KanbanColumn from './KanbanColumn'
import ProjectCard from './ProjectCard'
import type { Project } from '../types'

interface Props {
  projects: Project[]
  total: number
  selectedId: number | null
  loadingMore: string
  onSelect: (item: Project) => void
  onSettings: (item: Project) => void
  onView: (item: Project) => void
  onCreated: (project: Project) => void
  onLoadMore: () => void
  bg: string
}

export default function ProjectsColumn({ projects, total, selectedId, loadingMore, onSelect, onSettings, onView, onCreated, onLoadMore, bg }: Props) {
  const user = useAuthStore(s => s.user)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const { data } = await api.post('/projects', { title: title.trim() })
      onCreated(data)
      setShowForm(false)
      setTitle('')
    } catch { /* toast handled by api interceptor */ }
  }

  return (
    <KanbanColumn header={
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-bold text-gray-600">المشاريع</span>
          <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{projects.length}</span>
        </div>
        {user?.is_manager && (
          <button onClick={() => setShowForm(true)}
            className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة مشروع">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
    } bg={bg}>
      {showForm && (
        <form onSubmit={handleCreate}
          className="mx-2 mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم المشروع"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1" autoFocus />
          <div className="flex gap-1">
            <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[0.6rem] font-medium hover:bg-indigo-700">إنشاء</button>
            <button type="button" onClick={() => { setShowForm(false); setTitle('') }} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[0.6rem] hover:bg-gray-200">إلغاء</button>
          </div>
        </form>
      )}
      {projects.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-xs">لا توجد مشاريع</div>
      ) : (
        projects.map((p, i) => (
          <ProjectCard key={p.id} project={p}
            selected={selectedId === p.id}
            onSelect={() => onSelect(p)}
            onSettings={() => onSettings(p)}
            onView={() => onView(p)}
            index={i}
            members={p.members} />
        ))
      )}
      {projects.length < total && (
        <button onClick={onLoadMore} disabled={loadingMore === 'projects'}
          className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
          {loadingMore === 'projects' ? 'جاري...' : `عرض المزيد (${total - projects.length} متبقي)`}
        </button>
      )}
    </KanbanColumn>
  )
}
