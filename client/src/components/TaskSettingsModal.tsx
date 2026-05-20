import { useState, useEffect } from 'react'
import { X, Pencil, Trash2, Loader2, Download, ExternalLink } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { useToast } from './Toast'
import { useFocusTrap } from '../lib/useFocusTrap'
import AssigneePicker from './AssigneePicker'
import TiptapEditor from './TiptapEditor'
import { sanitizeHTML } from '../lib/sanitize'
import { ROLES } from '../constants'
import type { Attachment, Assignee } from '../types'

interface TaskSettingsModalProps {
  task: {
    id: number
    title: string
    description?: string | null
    subtasks_count: number
    project_id?: number
    created_at?: string
  }
  onClose: () => void
  onUpdate?: (task: { id: number; title: string; description?: string | null; subtasks_count: number; project_id?: number; created_at?: string }) => void
  onDelete?: (id: number) => void
}

export default function TaskSettingsModal({ task, onClose, onUpdate, onDelete }: TaskSettingsModalProps) {
  const { toast } = useToast()
  const permissions = useAuthStore(s => s.permissions)
  const users = useAppStore(s => s.users)
  const roles = useAppStore(s => s.roles)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description || '')

  useEffect(() => {
    api.get<Attachment[]>('/uploads', { params: { entity_type: 'task', entity_id: task.id } })
      .then(r => setAttachments(r.data))
      .catch((e) => { console.error('Failed to load task attachments', e) })
  }, [task.id])

  useEffect(() => {
    api.get<Assignee[]>(`/tasks/${task.id}/assignees`)
      .then(r => setAssignees(r.data))
      .catch((e) => { console.error('Failed to load assignees', e) })
  }, [task.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put(`/tasks/${task.id}`, { title, description: desc })
      onUpdate?.({ ...task, ...data })
      setEditMode(false)
      toast('تم تحديث المهمة')
    } catch { toast('فشل التحديث', 'error') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) return
    setDeleting(true)
    try {
      await api.delete(`/tasks/${task.id}`)
      onDelete?.(task.id)
      onClose()
      toast('تم حذف المهمة')
    } catch { toast('فشل الحذف', 'error') } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="task-settings-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeUp 0.25s ease both' }} ref={useFocusTrap(true)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="task-settings-title" className="font-bold text-gray-900 text-lg">{task.title}</h2>
          <div className="flex items-center gap-2">
            {task.project_id && (
              <a href={`/projects/${task.project_id}`} target="_blank" rel="noopener noreferrer"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="فتح في صفحة منفصلة">
                <ExternalLink className="w-4 h-4 text-indigo-500" />
              </a>
            )}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats capsules */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#fef3c7', color: '#d97706' }}>
              <span>📋</span> {task.subtasks_count} مهام فرعية
            </div>
            {task.created_at && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                <span>📅</span> {new Date(task.created_at).toLocaleDateString('ar-SA-u-nu-latn')}
              </div>
            )}
          </div>

          {/* Title / Edit */}
          {editMode ? (
            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" />
              <TiptapEditor content={desc} onChange={setDesc} placeholder="وصف المهمة..."
                uploadUrl={`/uploads?entity_type=task&entity_id=${task.id}`} />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm disabled:opacity-50">
                  {saving ? 'جاري...' : 'حفظ'}
                </button>
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">إلغاء</button>
              </div>
            </div>
          ) : (
            <>
              {desc && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(desc) }} />
                </div>
              )}
            </>
          )}

          {/* Assignees */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">المكلفون</p>
            <AssigneePicker
              assignees={assignees.map(a => ({ user_id: a.user_id, name: a.name, avatar: a.avatar }))}
              availableUsers={users.filter(u => {
                if (u.role_id !== ROLES.EMPLOYEE) return false
                const role = roles.find(r => r.id === u.role_id)
                const perms = role?.permissions ?? []
                if (!perms.includes('subtasks.submit')) return false
                if (!perms.includes('comments.create')) return false
                return true
              })}
              onAdd={async (userId) => {
                const { data } = await api.post<Assignee>(`/tasks/${task.id}/assignees`, { user_id: userId })
                setAssignees(prev => [...prev, data])
              }}
              onRemove={async (userId) => {
                await api.delete(`/tasks/${task.id}/assignees/${userId}`)
                setAssignees(prev => prev.filter(a => a.user_id !== userId))
              }}
              canAssign={permissions.includes('tasks.assign')}
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">المرفقات</p>
              <div className="grid grid-cols-3 gap-2">
                {attachments.map(a => (
                  <div key={a.id} className="relative group">
                    {a.mime_type?.startsWith('image/') ? (
                      <img src={`/uploads/${a.filename}`} alt={a.original_name}
                        className="w-full h-20 object-cover rounded-lg" />
                    ) : (
                      <div className="h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 p-2 text-center">
                        {a.original_name}
                      </div>
                    )}
                    <a href={`/uploads/${a.filename}`} download
                      className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all rounded-lg">
                      <Download className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-all" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMode(!editMode)}
              className="p-2 rounded-full hover:bg-amber-50 transition-colors" title="تعديل">
              <Pencil className="w-4 h-4 text-amber-500" />
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="p-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-30" title="حذف">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
            </button>
          </div>
          {attachments.length > 0 && (
            <a href={`/uploads/${attachments[0].filename}`} download
              className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="تحميل">
              <Download className="w-4 h-4 text-gray-500" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
