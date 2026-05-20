import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, CheckCheck, FolderKanban, UserPlus,
  CheckCircle2, XCircle, Send, ClipboardList, ExternalLink,
  AlertTriangle, MessageSquare, Snowflake, Clock, Award,
  Upload, Shield, Calendar, UserCheck, AtSign, Settings, Loader2
} from 'lucide-react'
import api from '../lib/api'
import socket from '../lib/socket'
import { useFocusTrap } from '../lib/useFocusTrap'
import type { Notification } from '../types'

const typeIcons: Record<string, React.ReactNode> = {
  project_created: <FolderKanban className="w-4 h-4 text-indigo-500" />,
  project_updated: <FolderKanban className="w-4 h-4 text-amber-500" />,
  project_archived: <FolderKanban className="w-4 h-4 text-gray-500" />,
  project_deleted: <FolderKanban className="w-4 h-4 text-red-500" />,
  project_completed: <Award className="w-4 h-4 text-green-500" />,
  task_created: <ClipboardList className="w-4 h-4 text-blue-500" />,
  task_updated: <ClipboardList className="w-4 h-4 text-amber-500" />,
  task_archived: <ClipboardList className="w-4 h-4 text-gray-500" />,
  subtask_created: <ClipboardList className="w-4 h-4 text-purple-500" />,
  subtask_assigned: <UserPlus className="w-4 h-4 text-green-500" />,
  assignment_changed: <UserCheck className="w-4 h-4 text-orange-500" />,
  submitted: <Send className="w-4 h-4 text-yellow-500" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  approved: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  rejected: <XCircle className="w-4 h-4 text-red-500" />,
  comment: <MessageSquare className="w-4 h-4 text-indigo-500" />,
  '@mention': <AtSign className="w-4 h-4 text-pink-500" />,
  deadline_approaching_24h: <Clock className="w-4 h-4 text-amber-500" />,
  deadline_approaching_6h: <Clock className="w-4 h-4 text-red-500" />,
  deadline_overdue: <AlertTriangle className="w-4 h-4 text-red-600" />,
  deadline_extended: <Calendar className="w-4 h-4 text-green-500" />,
  file_uploaded: <Upload className="w-4 h-4 text-cyan-500" />,
  user_joined: <UserPlus className="w-4 h-4 text-violet-500" />,
  role_changed: <Shield className="w-4 h-4 text-indigo-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-red-500" />,
  warning_responded: <MessageSquare className="w-4 h-4 text-blue-500" />,
  warning_cleared: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  warning_sustained: <XCircle className="w-4 h-4 text-red-500" />,
  warning_ignored: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  account_frozen: <Snowflake className="w-4 h-4 text-blue-500" />,
  account_unfrozen: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  daily_summary: <Calendar className="w-4 h-4 text-teal-500" />,
  new_login: <Shield className="w-4 h-4 text-yellow-500" />,
  password_changed: <Shield className="w-4 h-4 text-green-500" />,
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null)
  const [warningModal, setWarningModal] = useState<Notification | null>(null)
  const [responseText, setResponseText] = useState('')
  const [sending, setSending] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const notifTrapRef = useFocusTrap(!!selectedNotif)
  const warningTrapRef = useFocusTrap(!!warningModal)

  const loadedRef = useRef(false)

  const load = async () => {
    try {
      const { data } = await api.get<Notification[]>('/notifications')
      setNotifications(data)
      setUnread(data.filter((n: Notification) => !n.read).length)
      loadedRef.current = true
    } catch (e) { console.error('Failed to load notifications', e) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => {
      if (!socket.connected) load()
    }, 120000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (n: Notification) => {
      if (!loadedRef.current) return
      setNotifications(prev => [n, ...prev])
      if (!n.read) setUnread(c => c + 1)
    }
    socket.on('notification', handler)
    return () => { socket.off('notification', handler) }
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const markRead = async (id: number) => {
    try { await api.put(`/notifications/${id}/read`); setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n)); setUnread(c => Math.max(0, c - 1)) } catch (e) { console.error('markNotificationRead failed', e) }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try { await api.put('/notifications/read-all'); setNotifications(prev => prev.map(n => ({ ...n, read: 1 }))); setUnread(0) } catch (e) { console.error('markAllRead failed', e) }
    setMarkingAll(false)
  }

  const handleClick = (n: Notification) => {
    markRead(n.id)
    if (n.type === 'warning' && n.related_type === 'warning') {
      setWarningModal(n)
      setOpen(false)
    } else if (n.related_type === 'subtask' && n.related) {
      setSelectedNotif(n)
      setOpen(false)
    } else if (n.related_type === 'project' && n.related) {
      navigate(`/projects/${n.related_id}`)
      setOpen(false)
    } else if (n.type === 'account_frozen' || n.type === 'account_unfrozen') {
      if (n.type === 'account_frozen') navigate('/frozen')
      setOpen(false)
    }
  }

  const handleWarningRespond = async () => {
    if (!responseText.trim() || !warningModal?.related_id || sending) return
    setSending(true)
    try {
      await api.put(`/warnings/${warningModal.related_id}/respond`, { response_text: responseText.trim() })
      setWarningModal(null)
      setResponseText('')
    } finally { setSending(false) }
  }

  const goToSubtask = () => {
    if (selectedNotif?.related && selectedNotif.related_id) {
      navigate(`/subtasks/${selectedNotif.related_id}`)
      setSelectedNotif(null)
    }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `منذ ${mins} د`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `منذ ${hours} س`
    return `منذ ${Math.floor(hours / 24)} ي`
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">التنبيهات</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { navigate('/notifications/preferences'); setOpen(false) }}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" title="إعدادات التنبيهات">
                <Settings className="w-4 h-4" />
              </button>
              {unread > 0 && (
                <button onClick={markAllRead} disabled={markingAll}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                  {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />} تحديد الكل مقروء
                </button>
              )}
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">لا توجد تنبيهات</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(n => (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full text-right px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${n.read ? 'opacity-60' : ''}`}>
                  <span className="mt-0.5 shrink-0">{typeIcons[n.type] || <Bell className="w-4 h-4 text-gray-400" />}</span>
                  <div className="min-w-0">
                    <p className={`text-sm ${n.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedNotif && selectedNotif.related && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedNotif(null)}
          role="dialog" aria-modal="true" aria-labelledby="notif-detail-title">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}
            ref={notifTrapRef}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 id="notif-detail-title" className="font-bold text-gray-900">تفاصيل المهمة المسندة</h2>
              <button onClick={() => setSelectedNotif(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                <p className="text-xs text-indigo-500 font-medium">المشروع</p>
                <p className="font-semibold text-gray-900">{selectedNotif.related.project_title}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">المهمة</p>
                <p className="text-sm text-gray-800">{selectedNotif.related.task_title}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">المهمة الفرعية</p>
                <p className="text-sm font-medium text-gray-900">{selectedNotif.related.title}</p>
                {selectedNotif.related.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedNotif.related.description}</p>
                )}
              </div>

              {selectedNotif.related.deadline && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>⏰</span>
                  <span>الموعد النهائي: {new Date(selectedNotif.related.deadline).toLocaleDateString('ar-SA-u-nu-latn')}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={goToSubtask}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> استلام المهمة وعرض التفاصيل
              </button>
              <button onClick={() => setSelectedNotif(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm transition-colors">
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}

      {warningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setWarningModal(null)}
          role="dialog" aria-modal="true" aria-labelledby="warning-modal-title">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}
            ref={warningTrapRef}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 id="warning-modal-title" className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> رد على الإنذار
              </h2>
              <button onClick={() => setWarningModal(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-xs text-red-500 font-medium mb-1">سبب الإنذار</p>
                <p className="text-sm text-red-800">{warningModal.message}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">تقريرك</label>
                <textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                  placeholder="اكتب تقريرك وتوضيحك حول الإنذار..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={4} />
              </div>

              <div className="flex gap-2">
                <button onClick={handleWarningRespond} disabled={!responseText.trim() || sending}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {sending ? 'جاري الإرسال...' : <><Send className="w-4 h-4" /> إرسال التقرير</>}
                </button>
                <button onClick={() => setWarningModal(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm transition-colors">
                  تجاهل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
