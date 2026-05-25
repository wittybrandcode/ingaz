import { useState, useEffect } from 'react'
import api from '../lib/api'
import type { MemberProfile } from '../store/memberStore'
import ProfileAvatar, { warningsBadge, notificationBadge, onlineBadge, assignBadge } from './ProfileAvatar'
import { X, Loader2, ListTodo, FolderKanban, AlertTriangle, Clock, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'

interface MemberActiveTask {
  id: number; title: string
  project_id: number; project_title: string
  status: string; deadline: string | null
}

interface MemberActivity {
  id: number; action: string; details: string; created_at: string
}

interface MemberDetailModalProps {
  member: MemberProfile
  onClose: () => void
}

export default function MemberDetailModal({ member, onClose }: MemberDetailModalProps) {
  const [tasks, setTasks] = useState<MemberActiveTask[]>([])
  const [activity, setActivity] = useState<MemberActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/members/${member.id}/tasks`).then(r => setTasks(r.data)).catch(() => {}),
      api.get(`/members/${member.id}/activity`).then(r => setActivity(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [member.id])

  const stats = [
    { label: 'مهام نشطة', value: member.active_tasks, icon: ListTodo, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'مشاريع', value: member.projects_count, icon: FolderKanban, color: 'bg-purple-50 text-purple-600' },
    { label: 'إنذارات', value: member.warnings_count, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <>
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <ProfileAvatar name={member.name} avatar={member.avatar} size="lg" badges={[
                  notificationBadge(member.unread_count),
                  warningsBadge(member.warnings_count),
                  assignBadge([]),
                  onlineBadge(member.online),
                ].filter(Boolean) as any} />
                <div>
                  <h3 className="font-semibold text-gray-900">{member.name}</h3>
                  <p className="text-sm text-gray-500">{member.role_name || '—'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {stats.map(s => (
                  <div key={s.label} className={`${s.color} rounded-lg p-3 text-center`}>
                    <s.icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-lg font-bold">{s.value}</p>
                    <p className="text-xs">{s.label}</p>
                  </div>
                ))}
              </div>

              {tasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4" />
                    المهام الحالية
                  </h4>
                  <div className="space-y-2">
                    {tasks.map(t => (
                      <Link key={t.id} to={`/projects/${t.project_id}`}
                        className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{t.title}</p>
                          <span className="text-xs text-gray-400">{t.project_title}</span>
                        </div>
                        {t.deadline && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(t.deadline).toLocaleDateString('ar-SA-u-nu-latn')}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {activity.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    آخر النشاطات
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activity.map(a => (
                      <div key={a.id} className="text-sm text-gray-600 p-2 rounded-lg bg-gray-50">
                        <p>{a.details || a.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(a.created_at).toLocaleString('ar-SA-u-nu-latn')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tasks.length === 0 && activity.length === 0 && (
                <p className="text-center text-gray-400 py-4">لا توجد بيانات إضافية</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
