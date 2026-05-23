import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useToast } from './Toast'
import type { MemberProfile } from '../store/memberStore'
import type { Project, Task } from '../types'
import { X, Loader2 } from 'lucide-react'

interface AssignModalProps {
  member: MemberProfile
  onClose: () => void
}

export default function AssignModal({ member, onClose }: AssignModalProps) {
  const { toast } = useToast()
  const [assignType, setAssignType] = useState<'task' | 'subtask'>('task')
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/projects').then(({ data }) => setProjects(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedProject) { setTasks([]); return }
    api.get(`/tasks/project/${selectedProject}`).then(({ data }) => setTasks(data)).catch(() => {})
  }, [selectedProject])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask) { toast('اختر المهمة أولاً', 'error'); return }
    setSubmitting(true)
    try {
      const url = assignType === 'task'
        ? `/tasks/${selectedTask}/assignees`
        : `/subtasks/${selectedTask}/assignees`
      await api.post(url, { user_id: member.id })
      toast(`تم تكليف ${member.name} بنجاح`)
      onClose()
    } catch {
      toast('فشل التكليف', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">تكليف: {member.name}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">نوع التكليف</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAssignType('task')}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${assignType === 'task' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                مهمة
              </button>
              <button type="button" onClick={() => setAssignType('subtask')}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${assignType === 'subtask' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                مهمة فرعية
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">المشروع</label>
            <select value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setSelectedTask('') }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
              <option value="">اختر المشروع</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {selectedProject && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{assignType === 'task' ? 'المهمة' : 'المهمة الفرعية'}</label>
              <select value={selectedTask} onChange={e => setSelectedTask(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                <option value="">اختر {assignType === 'task' ? 'المهمة' : 'المهمة الفرعية'}</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              إلغاء
            </button>
            <button type="submit" disabled={submitting || !selectedTask}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تكليف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
