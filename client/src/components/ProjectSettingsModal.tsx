import { useState, useEffect } from 'react'
import { X, Pencil, Archive, Trash2, Loader2, Download, FileSpreadsheet } from 'lucide-react'
import api from '../lib/api'
import { useToast } from './Toast'
import { useFocusTrap } from '../lib/useFocusTrap'
import AssigneePicker from './AssigneePicker'
import TiptapEditor from './TiptapEditor'
import { sanitizeHTML } from '../lib/sanitize'
import type { Project, ProjectMember, Attachment, Task, Subtask } from '../types'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { ROLES } from '../constants'

interface ProjectSettingsModalProps {
  project: Project
  onClose: () => void
  onUpdate?: (project: Project) => void
  onDelete?: (id: number) => void
}

export default function ProjectSettingsModal({ project, onClose, onUpdate, onDelete }: ProjectSettingsModalProps) {
  const { toast } = useToast()
  const permissions = useAuthStore(s => s.permissions)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [title, setTitle] = useState(project.title)
  const [desc, setDesc] = useState(project.description || '')
  const [members, setMembers] = useState<ProjectMember[]>([])
  const users = useAppStore(s => s.users)
  const loadUsers = useAppStore(s => s.loadUsers)
  const roles = useAppStore(s => s.roles)

  useEffect(() => {
    api.get<Attachment[]>('/uploads', { params: { entity_type: 'project', entity_id: project.id } })
      .then(r => setAttachments(r.data))
      .catch((e) => { console.error('Failed to load project attachments', e) })
    api.get<ProjectMember[]>(`/projects/${project.id}/members`)
      .then(r => setMembers(r.data))
      .catch((e) => { console.error('Failed to load members', e) })
    loadUsers()
  }, [project.id, loadUsers])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put(`/projects/${project.id}`, { title, description: desc })
      onUpdate?.({ ...project, ...data })
      setEditMode(false)
      toast('تم تحديث المشروع')
    } catch { toast('فشل التحديث', 'error') } finally { setSaving(false) }
  }

  const handleArchive = async () => {
    if (!confirm('هل أنت متأكد من أرشفة هذا المشروع؟')) return
    setArchiving(true)
    try {
      await api.post(`/projects/${project.id}/archive`)
      onDelete?.(project.id)
      onClose()
      toast('تمت أرشفة المشروع')
    } catch { toast('فشلت الأرشفة', 'error') } finally { setArchiving(false) }
  }

  const handleDelete = async () => {
    if (!confirm('سيتم حذف المشروع بشكل نهائي. هل أنت متأكد؟')) return
    setDeleting(true)
    try {
      await api.delete(`/projects/${project.id}/permanent`)
      onDelete?.(project.id)
      onClose()
      toast('تم حذف المشروع')
    } catch { toast('فشل الحذف', 'error') } finally { setDeleting(false) }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const { data: tasks } = await api.get<Task[]>(`/tasks/project/${project.id}`)
      const taskIds = tasks.map(t => t.id)
      const allSubtasks: Record<number, Subtask[]> = {}
      if (taskIds.length > 0) {
        const { data: subs } = await api.get<Subtask[]>(`/subtasks/by-tasks`, { params: { task_ids: taskIds.join(',') } })
        for (const s of subs) {
          if (!allSubtasks[s.task_id]) allSubtasks[s.task_id] = []
          allSubtasks[s.task_id].push(s)
        }
      }

      const rows = [['المهمة', 'المهمة الفرعية', 'الحالة', 'المسؤول', 'تاريخ التسليم', 'تاريخ الإنشاء']]
      for (const t of tasks) {
        const subs = allSubtasks[t.id] || []
        if (subs.length === 0) {
          rows.push([t.title, '', '', '', '', new Date(t.created_at).toLocaleDateString('ar-SA-u-nu-latn')])
        }
        for (const s of subs) {
          rows.push([
            t.title,
            s.title,
            s.status,
            s.assigned_to_name || '',
            s.deadline ? new Date(s.deadline).toLocaleDateString('ar-SA-u-nu-latn') : '',
            new Date(s.created_at).toLocaleDateString('ar-SA-u-nu-latn'),
          ])
        }
      }

      const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
      const bom = '\uFEFF'
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.title.replace(/\s+/g, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('تم تصدير CSV')
    } catch { toast('فشل التصدير', 'error') } finally { setExporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="project-settings-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeUp 0.25s ease both' }} ref={useFocusTrap(true)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="project-settings-title" className="font-bold text-gray-900 text-lg">{project.title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats capsules */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#ede9fe', color: '#7c3aed' }}>
              <span>📋</span> {project.tasks_count} مهام
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#d1fae5', color: '#059669' }}>
              <span>✅</span> تقدم
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#fef3c7', color: '#d97706' }}>
              <span>📅</span> {new Date(project.created_at).toLocaleDateString('ar-SA-u-nu-latn')}
            </div>
          </div>

          {/* Title / Edit */}
          {editMode ? (
            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200" />
              <TiptapEditor content={desc} onChange={setDesc} placeholder="وصف المشروع..."
                uploadUrl={`/uploads?entity_type=project&entity_id=${project.id}`} />
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

          {/* Members */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">أعضاء المشروع</p>
            <AssigneePicker
              assignees={members.map(m => ({ user_id: m.user_id, name: m.name, avatar: m.avatar }))}
              availableUsers={users.filter(u => {
                if (u.role_id !== ROLES.EMPLOYEE) return false
                const role = roles.find(r => r.id === u.role_id)
                const perms = role?.permissions ?? []
                if (!perms.includes('subtasks.create')) return false
                if (!perms.includes('subtasks.submit')) return false
                if (!perms.includes('comments.create')) return false
                return true
              })}
              onAdd={async (userId) => {
                await api.post(`/projects/${project.id}/members`, { user_id: userId })
                const { data: updated } = await api.get<ProjectMember[]>(`/projects/${project.id}/members`)
                setMembers(updated)
              }}
              onRemove={async (userId) => {
                await api.delete(`/projects/${project.id}/members/${userId}`)
                setMembers(prev => prev.filter(m => m.user_id !== userId))
              }}
              canAssign={permissions.includes('projects.assign')}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMode(!editMode)}
              className="p-2 rounded-full hover:bg-purple-50 transition-colors" title="تعديل">
              <Pencil className="w-4 h-4 text-purple-500" />
            </button>
            <button onClick={handleArchive} disabled={archiving}
              className="p-2 rounded-full hover:bg-amber-50 transition-colors disabled:opacity-30" title="أرشفة">
              {archiving ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Archive className="w-4 h-4 text-amber-500" />}
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="p-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-30" title="حذف">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} disabled={exporting}
              className="p-2 rounded-full hover:bg-green-50 transition-colors disabled:opacity-30" title="تصدير CSV">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />}
            </button>
            {attachments.length > 0 && (
              <a href={`/uploads/${attachments[0].filename}`} download
                className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="تحميل">
                <Download className="w-4 h-4 text-gray-500" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
