import { useState, useEffect, useRef } from 'react'
import { Settings, Pencil, Snowflake, Trash2, CheckCircle2, Clock, Send, XCircle, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import { useToast } from './Toast'
import AvatarStack from './AvatarStack'
import type { Subtask } from '../types'

interface SubtaskCardProps {
  subtask: Subtask
  onSelect: (type: string, item: any) => void
  onView?: () => void
  index: number
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:     { label: 'معلّقة',   color: 'text-gray-600', bg: 'bg-gray-100', icon: AlertCircle },
  in_progress: { label: 'جارية',    color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
  submitted:   { label: 'مقدّمة',   color: 'text-purple-600', bg: 'bg-purple-50', icon: Send },
  approved:    { label: 'مكتملة',   color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
  rejected:    { label: 'مرفوضة',   color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
}

const statusBar: Record<string, string> = {
  pending:     'bg-gray-300',
  in_progress: 'bg-amber-400',
  submitted:   'bg-purple-400',
  approved:    'bg-green-400',
  rejected:    'bg-red-400',
}

export default function SubtaskCard({ subtask, onSelect, onView, index }: SubtaskCardProps) {
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(subtask.title)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const status = statusConfig[subtask.status] || statusConfig.pending
  const StatusIcon = status.icon

  return (
    <div
      className="card-hover rounded-xl bg-white anim-fade shadow-sm overflow-hidden"
      style={{
        animationDelay: `${index * 0.05}s`,
        borderBottom: `3px solid ${statusBar[subtask.status] ? statusBar[subtask.status].replace('bg-', '').replace('gray-300', '#d1d5db').replace('amber-400', '#f59e0b').replace('purple-400', '#a855f7').replace('green-400', '#22c55e').replace('red-400', '#ef4444') : '#d1d5db'}`,
      }}
    >
      <div className="p-4 cursor-pointer" onClick={() => onSelect('subtask', subtask)} onDoubleClick={onView}>
        <div className="flex justify-between items-start mb-2">
          {editing ? (
            <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded outline-none focus:ring-2 focus:ring-purple-200"
                style={{ fontFamily: 'inherit', fontSize: '0.75rem' }} />
              <button onClick={async () => { try { await api.put(`/subtasks/${subtask.id}`, { title: editTitle }); toast('تم التحديث'); setEditing(false) } catch { toast('فشل التحديث', 'error') } }}
                className="p-1 rounded bg-purple-500 text-white text-xs border-none cursor-pointer">✓</button>
              <button onClick={() => { setEditing(false); setEditTitle(subtask.title) }}
                className="p-1 rounded bg-gray-200 text-gray-600 text-xs border-none cursor-pointer">✕</button>
            </div>
          ) : (
            <h3 className="text-sm font-bold text-gray-900 leading-snug flex-1">{subtask.title}</h3>
          )}
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: r.bottom + 4, left: r.left }); setMenuOpen(true) }}
              className="w-7 h-7 rounded-full border-none flex items-center justify-center cursor-pointer shrink-0 hover:bg-gray-200 transition-all bg-gray-100 text-gray-400 hover:text-gray-600"
              title="إعدادات"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                className="w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 anim-fade"
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => { setEditing(true); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs border-none cursor-pointer transition-all hover:bg-purple-50 text-right bg-transparent text-gray-700">
                  <Pencil className="w-4 h-4 text-purple-500" /> تعديل
                </button>
                <button onClick={async () => { setMenuOpen(false); if (!confirm('هل أنت متأكد من تجميد هذه المهمة الفرعية؟')) return; try { await api.put(`/subtasks/${subtask.id}`, { status: 'pending' }); toast('تم تجميد المهمة') } catch { toast('فشل التجميد', 'error') } }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs border-none cursor-pointer transition-all hover:bg-blue-50 text-right bg-transparent text-gray-700">
                  <Snowflake className="w-4 h-4 text-blue-500" /> تجميد
                </button>
                <div className="h-px bg-gray-100 mx-3 my-1" />
                <button onClick={async () => { setMenuOpen(false); if (!confirm('هل أنت متأكد من حذف هذه المهمة الفرعية؟')) return; try { await api.delete(`/subtasks/${subtask.id}`); toast('تم الحذف'); onSelect('subtask', subtask) } catch { toast('فشل الحذف', 'error') } }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs border-none cursor-pointer transition-all hover:bg-red-50 text-right bg-transparent text-red-500">
                  <Trash2 className="w-4 h-4" /> حذف
                </button>
              </div>
            )}
          </div>
        </div>

        {subtask.description && (
          <p className="text-[0.7rem] text-gray-500 leading-relaxed mb-2.5 line-clamp-2">
            {subtask.description.replace(/<[^>]+>/g, '').trim()}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap min-h-6">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.55rem] font-bold ${status.color} ${status.bg}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {status.label}
          </span>
          {subtask.deadline && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.55rem] font-bold bg-gray-50 text-gray-500">
              <Clock className="w-2.5 h-2.5" />
              {new Date(subtask.deadline).toLocaleDateString('ar-SA-u-nu-latn')}
            </span>
          )}
          {subtask.assignees && subtask.assignees.length > 0 ? (
            <div className="mr-auto">
              <AvatarStack users={subtask.assignees} max={3} size="xs" />
            </div>
          ) : subtask.assigned_to_name ? (
            <div className="mr-auto">
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {subtask.assigned_to_avatar ? (
                  <img src={`/uploads/${subtask.assigned_to_avatar}`} alt={subtask.assigned_to_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[6px] font-bold text-gray-500">{subtask.assigned_to_name.charAt(0)}</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
