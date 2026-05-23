import { useState, useEffect } from 'react'
import { X, Pencil, Trash2, Loader2, ExternalLink, Calendar } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { useToast } from './Toast'
import { useFocusTrap } from '../lib/useFocusTrap'
import AssigneePicker from './AssigneePicker'
import TiptapEditor from './TiptapEditor'
import { sanitizeHTML } from '../lib/sanitize'
import type { Attachment, Assignee } from '../types'

interface SubtaskSettingsModalProps {
  subtask: {
    id: number
    task_id: number
    title: string
    description?: string | null
    deadline?: string | null
    status: string
    assignees?: Assignee[]
  }
  onClose: () => void
  onUpdate?: (subtask: any) => void
  onDelete?: (id: number) => void
}

const statusOptions = [
  { value: 'open', label: 'مفتوحة', color: 'text-gray-700', bg: 'bg-gray-100' },
  { value: 'completed', label: 'منفذة', color: 'text-green-700', bg: 'bg-green-100' },
  { value: 'cancelled', label: 'ملغية', color: 'text-red-700', bg: 'bg-red-100' },
  { value: 'deferred', label: 'مؤجلة', color: 'text-yellow-700', bg: 'bg-yellow-100' },
]

export default function SubtaskSettingsModal({ subtask, onClose, onUpdate, onDelete }: SubtaskSettingsModalProps) {
  const { toast } = useToast()
  const user = useAuthStore(s => s.user)
  const users = useAppStore(s => s.users)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [title, setTitle] = useState(subtask.title)
  const [desc, setDesc] = useState(subtask.description || '')
  const [deadline, setDeadline] = useState(subtask.deadline ? subtask.deadline.split('T')[0] : '')
  const [status, setStatus] = useState(subtask.status)

  useEffect(() => {
    api.get<Attachment[]>('/uploads', { params: { entity_type: 'subtask', entity_id: subtask.id } })
      .then(r => setAttachments(r.data))
      .catch(() => {})
  }, [subtask.id])

  useEffect(() => {
    api.get<Assignee[]>(`/subtasks/${subtask.id}/assignees`)
      .then(r => setAssignees(r.data))
      .catch(() => {})
  }, [subtask.id])

  const isManager = user?.is_manager

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put(`/subtasks/${subtask.id}`, { title, description: desc, deadline: deadline || null })
      onUpdate?.({ ...subtask, ...data })
      setEditMode(false)
      toast('تم تحديث المهمة الفرعية')
    } catch { toast('فشل التحديث', 'error') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة الفرعية؟')) return
    setDeleting(true)
    try {
      await api.delete(`/subtasks/${subtask.id}`)
      onDelete?.(subtask.id)
      onClose()
      toast('تم حذف المهمة الفرعية')
    } catch { toast('فشل الحذف', 'error') } finally { setDeleting(false) }
  }

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    try {
      await api.put(`/subtasks/${subtask.id}`, { status: newStatus })
      toast('تم تغيير الحالة')
    } catch { toast('فشل تغيير الحالة', 'error'); setStatus(subtask.status) }
  }

  const statusCfg = statusOptions.find(s => s.value === status) || statusOptions[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="subtask-settings-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeUp 0.25s ease both' }} ref={useFocusTrap(true)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="subtask-settings-title" className="font-bold text-gray-900 text-lg">{subtask.title}</h2>
          <div className="flex items-center gap-2">
            <a href={`/subtasks/${subtask.id}`} target="_blank" rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="فتح في صفحة منفصلة">
              <ExternalLink className="w-4 h-4 text-indigo-500" />
            </a>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status pill */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 ${statusCfg.bg} ${statusCfg.color} px-3 py-1 rounded-full text-sm font-medium`}>
              {statusCfg.label}
            </span>
            {isManager && status === 'open' && (
              <div className="flex gap-1">
                <button onClick={() => handleStatusChange('completed')}
                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors">
                  إنهاء
                </button>
                <button onClick={() => handleStatusChange('deferred')}
                  className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200 transition-colors">
                  تأجيل
                </button>
                <button onClick={() => handleStatusChange('cancelled')}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">
                  إلغاء
                </button>
              </div>
            )}
            {isManager && status === 'deferred' && (
              <button onClick={() => handleStatusChange('open')}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors">
                إعادة فتح
              </button>
            )}
          </div>

          {/* Deadline */}
          {deadline && !editMode && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(deadline).toLocaleDateString('ar-SA-u-nu-latn')}
            </div>
          )}

          {/* Edit / View */}
          {editMode ? (
            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200" />
              <TiptapEditor content={desc} onChange={setDesc} placeholder="وصف المهمة الفرعية..."
                uploadUrl={`/uploads?entity_type=subtask&entity_id=${subtask.id}`} />
              <label className="text-xs text-gray-500 font-medium">تاريخ التسليم</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm disabled:opacity-50">
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
              availableUsers={users}
              onAdd={async (userId) => {
                const { data } = await api.post<Assignee>(`/subtasks/${subtask.id}/assignees`, { user_id: userId })
                setAssignees(prev => [...prev, data])
              }}
              onRemove={async (userId) => {
                await api.delete(`/subtasks/${subtask.id}/assignees/${userId}`)
                setAssignees(prev => prev.filter(a => a.user_id !== userId))
              }}
              canAssign={isManager === 1}
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
                    <a href={`/uploads/${a.filename}`} download target="_blank" rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all rounded-lg">
                      <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
              className="p-2 rounded-full hover:bg-purple-50 transition-colors" title="تعديل">
              <Pencil className="w-4 h-4 text-purple-500" />
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="p-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-30" title="حذف">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
