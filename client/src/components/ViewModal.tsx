import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, ExternalLink, Settings, Calendar, User, ListTodo, CheckSquare, Clock, AlertCircle, CheckCircle2, XCircle, MessageSquare } from 'lucide-react'
import api from '../lib/api'
import { sanitizeHTML } from '../lib/sanitize'
import { useFocusTrap } from '../lib/useFocusTrap'
import Avatar from './Avatar'
import StatsPill from './StatsPill'
import type { Attachment } from '../types'

interface ViewItem {
  type: 'project' | 'task' | 'subtask'
  data: any
}

interface ViewModalProps {
  item: ViewItem | null
  onClose: () => void
  onSettings?: () => void
}

const statusLabels: Record<string, string> = {
  open: 'مفتوحة', completed: 'منفذة', cancelled: 'ملغية',
  deferred: 'مؤجلة', active: 'نشط',
}

const statusColors: Record<string, string> = {
  open: '#9CA3AF', completed: '#10B981', cancelled: '#EF4444',
  deferred: '#F59E0B', active: '#4A90D9',
}

function Description({ text }: { text?: string | null }) {
  if (!text) return null
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1 font-medium">الوصف</p>
      <div className="text-sm text-gray-800 leading-relaxed [&_a]:text-indigo-600 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }} />
    </div>
  )
}

function ProjectView({ data, onSettings }: { data: any; onSettings?: () => void }) {
  const total = data.subtasks_count || data.tasks_count || 0
  const completed = data.completed_count || 0
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {data.created_by_name && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <User className="w-3.5 h-3.5" />
            {data.created_by_name}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(data.created_at).toLocaleDateString('ar-SA-u-nu-latn')}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <StatsPill icon={ListTodo} count={data.tasks_count || 0} label="مهام" color="blue" />
        <StatsPill icon={CheckSquare} count={data.subtasks_count || 0} label="مهام فرعية" color="green" />
      </div>

      <div className="bg-gray-50 rounded-xl p-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-500 font-medium">تقدم المشروع</span>
          <span className="text-xs font-bold">{progress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: progress >= 100 ? '#22c55e' : progress >= 50 ? '#eab308' : '#4A90D9' }} />
        </div>
      </div>

      <Description text={data.description} />

      {onSettings && (
        <button onClick={onSettings}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border-none cursor-pointer hover:bg-indigo-100 transition-colors">
          <Settings className="w-4 h-4" />
          إعدادات المشروع
        </button>
      )}
    </div>
  )
}

function TaskView({ data, onSettings }: { data: any; onSettings?: () => void }) {
  const progress = data.subtasks_count > 0 ? Math.round(((data.completed_count || 0) / data.subtasks_count) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {data.project_id && (
          <span className="text-xs text-gray-400">#{data.project_id}</span>
        )}
        {data.created_by_name && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <User className="w-3.5 h-3.5" />
            {data.created_by_name}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(data.created_at).toLocaleDateString('ar-SA-u-nu-latn')}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <StatsPill icon={CheckSquare} count={data.subtasks_count || 0} label="مهام فرعية" color="purple" />
      </div>

      <div className="bg-gray-50 rounded-xl p-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-500 font-medium">تقدم المهمة</span>
          <span className="text-xs font-bold">{progress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: progress >= 100 ? '#22c55e' : progress >= 50 ? '#eab308' : '#4A90D9' }} />
        </div>
      </div>

      <Description text={data.description} />

      {onSettings && (
        <button onClick={onSettings}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold border-none cursor-pointer hover:bg-amber-100 transition-colors">
          <Settings className="w-4 h-4" />
          إعدادات المهمة
        </button>
      )}
    </div>
  )
}

function SubtaskView({ data, onSettings }: { data: any; onSettings?: () => void }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(true)

  useEffect(() => {
    setLoadingAttachments(true)
    api.get<Attachment[]>('/uploads', { params: { entity_type: 'subtask', entity_id: data.id } })
      .then(r => setAttachments(r.data))
      .catch(() => {})
      .finally(() => setLoadingAttachments(false))
  }, [data.id])

  const statusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    open: Clock, completed: CheckCircle2, cancelled: XCircle, deferred: AlertCircle,
  }
  const Icon = statusIcon[data.status] || AlertCircle

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: statusColors[data.status] || '#9CA3AF' }}>
          <Icon className="w-3 h-3" />
          {statusLabels[data.status] || data.status}
        </span>
        {data.deadline && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(data.deadline).toLocaleDateString('ar-SA-u-nu-latn')}
          </span>
        )}
      </div>

      {data.assigned_to_name && (
        <div className="flex items-center gap-2">
          <Avatar name={data.assigned_to_name} avatar={data.assigned_to_avatar} size="sm" />
          <span className="text-sm text-gray-700">{data.assigned_to_name}</span>
        </div>
      )}

      <Description text={data.description} />

      {data.assignees && data.assignees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.assignees.map((a: any) => (
            <div key={a.user_id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1">
              <Avatar name={a.name} avatar={a.avatar} size="sm" />
              <span className="text-xs text-gray-700">{a.name}</span>
            </div>
          ))}
        </div>
      )}

      {loadingAttachments ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : attachments.length > 0 ? (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">المرفقات ({attachments.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {attachments.map(a => (
              a.mime_type?.startsWith('image/') ? (
                <img key={a.id} src={`/uploads/${a.filename}`} alt={a.original_name}
                  className="w-full h-20 object-cover rounded-lg" />
              ) : (
                <div key={a.id} className="h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 p-2 text-center break-all">
                  {a.original_name}
                </div>
              )
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Link to={`/subtasks/${data.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold no-underline hover:bg-indigo-100 transition-colors">
          <MessageSquare className="w-4 h-4" />
          التعليقات
        </Link>
        {onSettings && (
          <button onClick={onSettings}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-sm font-bold border-none cursor-pointer hover:bg-purple-100 transition-colors">
            <Settings className="w-4 h-4" />
            الإعدادات
          </button>
        )}
      </div>
    </div>
  )
}

export default function ViewModal({ item, onClose, onSettings }: ViewModalProps) {
  const focusTrapRef = useFocusTrap(!!item)

  if (!item) return null

  const { type, data } = item

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="view-modal-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeUp 0.25s ease both' }} ref={focusTrapRef}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="view-modal-title" className="font-bold text-gray-900 text-lg ml-4 line-clamp-1">{data.title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <a href={`/${type}s/${data.id}`} target="_blank" rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="فتح في صفحة منفصلة">
              <ExternalLink className="w-4 h-4 text-indigo-500" />
            </a>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {type === 'project' && <ProjectView data={data} onSettings={onSettings} />}
          {type === 'task' && <TaskView data={data} onSettings={onSettings} />}
          {type === 'subtask' && <SubtaskView data={data} onSettings={onSettings} />}
        </div>
      </div>
    </div>
  )
}
